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
import { makeStore } from "./store.js";
import { makeGraphStore } from "./graphStore.js";

const app = Fastify({ logger: true });

// CPMS draft storage (file-backed v0)
const store = makeStore({ dir: new URL("../data/", import.meta.url).pathname });
const graphStore = makeGraphStore();


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
const host = process.env.CPMS_API_HOST ?? "0.0.0.0";
const port = Number(process.env.CPMS_API_PORT ?? "8787");
app.listen({ host, port });
