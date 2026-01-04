import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { z } from "zod";
import {
  matchConcept,
  matchConceptExplain,
  matchPatternGreedyRepair,
  generateConceptDraft,
  generatePatternDraft,
  compileConcept,
  describeConceptSchemaLanguage,
  buildConceptSchemaTemplate,
  validateConceptSchema
} from "@lehelkovach/cpms-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { makeStore } from "./store.js";
import { makeGraphStore } from "./graphStore.js";
import { buildObservationFromHtml, loadDefaultLoginPattern } from "./observationBuilder.js";

/**
 * Build a Fastify app so it can be used by both the CLI server entrypoint and tests.
 */
export async function buildApp(options = {}) {
  const { logger = true, store: storeOverride, graphStore: graphStoreOverride } = options;
  const app = Fastify({ logger });

  const store = storeOverride ?? makeStore({ dir: new URL("../data/", import.meta.url).pathname });
  const graphStore = graphStoreOverride ?? makeGraphStore();

  await app.register(swagger, { openapi: { info: { title: "CPMS API", version: "0.1.0" } } });
  await app.register(swaggerUI, { routePrefix: "/docs" });

  app.get("/health", async () => ({ ok: true }));

  const MatchReq = z.object({ concept: z.any(), observation: z.any() });

  app.post("/cpms/match", async (req, reply) => {
    const parsed = MatchReq.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
    const { concept, observation } = parsed.data;
    return { result: matchConcept(concept, observation) };
  });

  app.post("/cpms/match_explain", async (req, reply) => {
    const parsed = MatchReq.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
    const { concept, observation } = parsed.data;
    return { result: matchConcept(concept, observation), explain: matchConceptExplain(concept, observation) };
  });

  const MatchPatternReq = z.object({ pattern: z.any(), concepts: z.array(z.any()), observation: z.any() });

  app.post("/cpms/match_pattern", async (req, reply) => {
    const parsed = MatchPatternReq.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
    const { pattern, concepts, observation } = parsed.data;
    return { result: matchPatternGreedyRepair(pattern, concepts, observation) };
  });

  // --- CPMS Schema Language support ---
  app.get("/cpms/schema/concepts/language", async () => ({
    schema: describeConceptSchemaLanguage(),
    template: buildConceptSchemaTemplate()
  }));

  app.post("/cpms/schema/concepts/template", async (req, reply) => {
    const intent = req.body ?? {};
    try {
      const template = buildConceptSchemaTemplate(intent);
      return { ok: true, template };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error.message });
    }
  });

  const ConceptPersistReq = z.object({ concept: z.any() });

  app.post("/cpms/schema/concepts/persist", async (req, reply) => {
    const parsed = ConceptPersistReq.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: parsed.error.format() });
    const { concept } = parsed.data;

    const validation = validateConceptSchema(concept);
    if (!validation.ok) return reply.code(400).send({ ok: false, lint: validation.report });

    const compiled = compileConcept(validation.concept);
    store.append("concept", compiled.concept);

    const graph = await graphStore.persistConcept(compiled.concept);
    const ok = validation.ok && graph.ok;
    const statusCode = ok ? 200 : 502;

    if (!ok) reply.code(statusCode);
    return { ok, concept: compiled.concept, lint: validation.report, graph };
  });

  // --- CPMS Schema Generator Commands (LLM-callable) ---
  app.post("/cpms/concepts/draft", async (req, _reply) => {
    const draft = generateConceptDraft(req.body);
    const compiled = compileConcept(draft);
    store.append("concept", compiled.concept);
    return { ok: true, concept: compiled.concept, report: compiled.report };
  });

  app.post("/cpms/patterns/draft", async (req, _reply) => {
    const pattern = generatePatternDraft(req.body);
    store.append("pattern", pattern);
    return { ok: true, pattern };
  });

  app.post("/cpms/activate", async (req, _reply) => {
    const { kind, uuid } = req.body ?? {};
    if (!kind || !uuid) return { ok: false, error: "kind + uuid required" };
    const row = store.latestByUuid(kind, uuid);
    if (!row) return { ok: false, error: "not found" };
    const active = { ...row, status: "active", activated_at: new Date().toISOString() };
    store.append(kind, active);
    return { ok: true, active };
  });

  // --- High-level form detection endpoint for agent integration ---
  const DetectFormReq = z.object({
    html: z.string(),
    screenshot_path: z.string().optional(),
    screenshot: z.string().optional(), // base64 encoded
    url: z.string().optional(),
    dom_snapshot: z.any().optional(),
    observation: z.any().optional() // Allow pre-built observation
  });

  app.post("/cpms/detect_form", async (req, reply) => {
    const parsed = DetectFormReq.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
    
    const { html, screenshot_path, screenshot, url, dom_snapshot, observation: providedObservation } = parsed.data;
    
    try {
      // Build observation from HTML + screenshot
      let observation = providedObservation;
      if (!observation) {
        // Use screenshot_path if provided, otherwise try screenshot (base64)
        const screenshotPath = screenshot_path || (screenshot ? writeTempScreenshot(screenshot) : null);
        observation = buildObservationFromHtml(html, screenshotPath, url, dom_snapshot);
      }
      
      // Load default login pattern and concepts
      const { pattern, concepts } = loadDefaultLoginPattern();
      
      // Match pattern
      const matchResult = matchPatternGreedyRepair(pattern, concepts, observation);
      
      // Transform to agent-expected format
      const response = transformMatchResultToAgentFormat(matchResult, pattern, concepts, observation);
      
      return response;
    } catch (error) {
      return reply.code(500).send({ error: error.message, stack: error.stack });
    }
  });

  return app;
}

/**
 * Transform CPMS match_pattern result to agent-expected format.
 */
function transformMatchResultToAgentFormat(matchResult, pattern, concepts, observation) {
  const conceptMap = new Map(concepts.map(c => [c.concept_id, c]));
  const candidateMap = new Map(observation.candidates.map(c => [c.candidate_id, c]));
  
  const fields = [];
  let overallConfidence = 1.0;
  
  // Map assigned concepts to fields
  for (const [conceptId, candidateId] of Object.entries(matchResult.assigned || {})) {
    const concept = conceptMap.get(conceptId);
    const candidate = candidateMap.get(candidateId);
    
    if (!concept || !candidate) continue;
    
    // Determine field type from concept
    let fieldType = "unknown";
    if (concept.concept_id.includes("email")) fieldType = "email";
    else if (concept.concept_id.includes("password")) fieldType = "password";
    else if (concept.concept_id.includes("submit")) fieldType = "submit";
    
    // Build selector from candidate DOM attributes
    const selector = buildSelector(candidate);
    const xpath = buildXPath(candidate, observation);
    
    // Get confidence from trace
    const traceEntry = matchResult.trace?.rankings?.find(r => r.concept_id === conceptId);
    const confidence = traceEntry ? (traceEntry.bestP || 0.5) : 0.5;
    overallConfidence = Math.min(overallConfidence, confidence);
    
    fields.push({
      type: fieldType,
      selector: selector,
      xpath: xpath,
      confidence: confidence,
      signals: {
        concept_id: conceptId,
        candidate_id: candidateId,
        attributes: candidate.dom?.attrs || {}
      }
    });
  }
  
  // Determine form type
  let formType = "unknown";
  const hasEmail = fields.some(f => f.type === "email");
  const hasPassword = fields.some(f => f.type === "password");
  if (hasEmail && hasPassword) formType = "login";
  
  return {
    form_type: formType,
    fields: fields,
    confidence: overallConfidence,
    pattern_id: pattern.pattern_id,
    assigned: matchResult.assigned,
    unassigned: matchResult.unassigned || []
  };
}

/**
 * Build CSS selector from candidate DOM attributes.
 */
function buildSelector(candidate) {
  const attrs = candidate.dom?.attrs || {};
  const selectors = [];
  
  if (attrs.id) {
    selectors.push(`#${attrs.id}`);
  }
  if (attrs.name) {
    selectors.push(`[name="${attrs.name}"]`);
  }
  if (attrs.type) {
    selectors.push(`[type="${attrs.type}"]`);
  }
  if (attrs.role) {
    selectors.push(`[role="${attrs.role}"]`);
  }
  
  return selectors.join(", ") || "input, button";
}

/**
 * Build XPath from candidate (simplified).
 */
function buildXPath(candidate, observation) {
  // Simplified XPath - in real implementation, would need full DOM tree
  const attrs = candidate.dom?.attrs || {};
  if (attrs.id) {
    return `//*[@id="${attrs.id}"]`;
  }
  if (attrs.name) {
    return `//*[@name="${attrs.name}"]`;
  }
  return "//input | //button";
}

/**
 * Write base64 screenshot to temp file and return path.
 */
function writeTempScreenshot(base64Data) {
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `cpms-screenshot-${Date.now()}.png`);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}
