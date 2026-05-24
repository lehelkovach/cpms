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
import { buildObservationFromHtml, loadDefaultPatterns } from "./observationBuilder.js";

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
    html: z.string().optional(),
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
    if (!html && !providedObservation && !dom_snapshot) {
      return reply.code(400).send({ error: "html, observation, or dom_snapshot is required" });
    }

    try {
      let observation = providedObservation;
      if (!observation) {
        const screenshotPath = screenshot_path || (screenshot ? writeTempScreenshot(screenshot) : null);
        observation = buildObservationFromHtml(html ?? "", screenshotPath, url, dom_snapshot);
      }

      const detections = loadDefaultPatterns().map(({ pattern, concepts }) => {
        const matchResult = matchPatternGreedyRepair(pattern, concepts, observation);
        return transformMatchResultToAgentFormat(matchResult, pattern, concepts, observation);
      });

      return selectBestDetection(detections);
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
  const traceByConcept = new Map((matchResult.trace?.rankings ?? []).map(r => [r.concept_id, r]));

  const fields = [];
  const confidences = [];

  for (const [conceptId, candidateId] of Object.entries(matchResult.assigned || {})) {
    const concept = conceptMap.get(conceptId);
    const candidate = candidateMap.get(candidateId);
    if (!concept || !candidate) continue;

    const selector = buildSelector(candidate);
    const xpath = buildXPath(candidate, observation);
    const traceEntry = traceByConcept.get(conceptId);
    const confidence = traceEntry ? (traceEntry.bestP || 0.5) : 0.5;
    confidences.push(confidence);

    fields.push({
      type: inferFieldType(concept),
      selector,
      xpath,
      confidence,
      signals: {
        concept_id: conceptId,
        candidate_id: candidateId,
        attributes: candidate.dom?.attrs || {}
      }
    });
  }

  const requiredConcepts = getRequiredConceptIds(pattern);
  const requiredAssigned = requiredConcepts.filter(conceptId => matchResult.assigned?.[conceptId]);
  const requiredCompleteness = requiredConcepts.length ? requiredAssigned.length / requiredConcepts.length : 1;
  const assignedCount = Object.keys(matchResult.assigned || {}).length;
  const patternCompleteness = pattern.includes?.length ? assignedCount / pattern.includes.length : 0;
  const overallConfidence = confidences.length ? Math.min(...confidences) : 0;
  const score = (requiredCompleteness * 0.7) + (patternCompleteness * 0.2) + (overallConfidence * 0.1);

  return {
    form_type: requiredCompleteness === 1 ? inferFormType(pattern) : "unknown",
    fields,
    confidence: overallConfidence,
    score,
    pattern_id: pattern.pattern_id,
    assigned: matchResult.assigned,
    unassigned: matchResult.unassigned || [],
    required: {
      assigned: requiredAssigned,
      missing: requiredConcepts.filter(conceptId => !matchResult.assigned?.[conceptId])
    }
  };
}

function selectBestDetection(detections) {
  const sorted = [...detections].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.confidence - a.confidence;
  });
  return sorted[0] ?? {
    form_type: "unknown",
    fields: [],
    confidence: 0,
    score: 0,
    pattern_id: null,
    assigned: {},
    unassigned: []
  };
}

function getRequiredConceptIds(pattern) {
  const required = (pattern.constraints ?? [])
    .filter(constraint => constraint.type === "required_concepts")
    .flatMap(constraint => constraint.params?.ids ?? []);
  return required.length ? required : (pattern.includes ?? []);
}

function inferFormType(pattern) {
  return pattern.pattern_id?.match(/^pattern:([^@]+)/)?.[1] ?? "unknown";
}

function inferFieldType(concept) {
  const source = String(concept.concept_type || "") + " " + String(concept.concept_id || "");
  if (source.includes("submit")) return "submit";
  if (source.includes("card_name") || source.includes("cardholder")) return "card_name";
  if (source.includes("card_number")) return "card_number";
  if (source.includes("card_expiry") || source.includes("expiry")) return "card_expiry";
  if (source.includes("card_cvv") || source.includes("cvv")) return "card_cvv";
  if (source.includes("email")) return "email";
  if (source.includes("password")) return "password";
  return "unknown";
}

/**
 * Build CSS selector from candidate DOM attributes.
 */
function buildSelector(candidate) {
  const attrs = candidate.dom?.attrs || {};
  const tag = candidate.dom?.tag || "input";
  
  if (attrs.id) {
    return `#${cssEscapeIdent(attrs.id)}`;
  }
  if (attrs.name) {
    return `${tag}[name="${cssEscapeString(attrs.name)}"]`;
  }
  if (attrs.autocomplete) {
    return `${tag}[autocomplete="${cssEscapeString(attrs.autocomplete)}"]`;
  }
  if (attrs["aria-label"]) {
    return `${tag}[aria-label="${cssEscapeString(attrs["aria-label"])}"]`;
  }
  if (attrs.type) {
    return `${tag}[type="${cssEscapeString(attrs.type)}"]`;
  }
  if (candidate.dom?.role) {
    return `[role="${cssEscapeString(candidate.dom.role)}"]`;
  }
  
  return tag === "button" ? "button" : "input, textarea, select, button";
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
  if (attrs["aria-label"]) {
    return `//*[@aria-label="${attrs["aria-label"]}"]`;
  }
  return "//input | //button";
}

function cssEscapeIdent(value) {
  return String(value).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

function cssEscapeString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
