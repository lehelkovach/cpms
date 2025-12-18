import { randomUUID } from "node:crypto";
import { generateConceptDraft } from "./generator.js";
import { lintConcept } from "./compiler.js";
import { ALLOWED_EVALUATORS } from "./compiler.js";

const SCHEMA_VERSION = "0.1.0";

const DEFAULT_SIGNAL_TEMPLATE = {
  signal_id: "signal-1",
  description: "Describe the evidence signal and why it matters.",
  evaluator: "dom.attr_in",
  mode: "fuzzy",
  weight: 1.0,
  params: {
    attr: "autocomplete",
    values: ["email", "username"]
  }
};

const DEFAULT_RESOLUTION = {
  score_model: { type: "hybrid_logit", prior_logit: -1.0, calibration: "sigmoid", epsilon: 1e-6 },
  decision: { policy: "winner_take_all", min_conf: 0.75, min_margin: 0.1, confirm_threshold: 0.9 }
};

export const ConceptSchemaLanguage = {
  version: SCHEMA_VERSION,
  description: "CPMS concept prototypes model matchable UI affordances. The schema encodes fuzzy evidence, scoring, metadata, and provenance.",
  properties: {
    kind: { type: "string", required: true, const: "cpms.concept", description: "Discriminator so downstream tools understand the payload." },
    uuid: { type: "string", required: true, description: "Durable identity for the concept. Use UUIDv4." },
    version: { type: "string", required: true, description: "Semver-style version string for this revision." },
    labels: { type: "string[]", required: true, description: "Human-readable labels and synonyms. First entry is canonical." },
    prototype_of: { type: "string", required: true, description: "Ontology/type identifier (e.g. type:email_field)." },
    extends: { type: "string[]", required: true, description: "Inheritance references (concept UUIDs) or empty array." },
    signals: { type: "Signal[]", required: true, description: "Evidence emitting evaluators. Each signal must describe evaluator + weighting." },
    resolution: { type: "object", required: true, description: "Scoring + decision policy parameters." },
    llm_embedding: { type: "number[] | null", required: false, description: "Optional vector used for retrieval." },
    status: { type: "string", required: true, description: "Workflow status (draft/active/etc.)." },
    meta: { type: "object", required: true, description: "Free-form metadata (source, provenance, notes)." }
  },
  signal_modes: {
    fuzzy: {
      required_fields: ["weight"],
      description: "Logit-style additive evidence. Positive weight pushes towards a match.",
      fields: {
        evaluator: { type: "string", enum: [...ALLOWED_EVALUATORS] },
        weight: { type: "number", range: [-10, 10] },
        when: { type: "object", description: "Evaluator-specific parameters (e.g., attr/value lookups)." }
      }
    },
    bayes: {
      required_fields: ["llr_when_true", "llr_when_false"],
      description: "Log-likelihood ratios for Bayesian scorers.",
      fields: {
        evaluator: { type: "string", enum: [...ALLOWED_EVALUATORS] },
        llr_when_true: { type: "number", range: [-20, 20] },
        llr_when_false: { type: "number", range: [-20, 20] }
      }
    }
  },
  allowed_evaluators: [...ALLOWED_EVALUATORS]
};

/**
 * Describe the current schema language + allowed evaluators.
 */
export function describeConceptSchemaLanguage() {
  return ConceptSchemaLanguage;
}

/**
 * Provide a ready-to-edit template so agents/LLMs can fill in details.
 */
export function buildConceptSchemaTemplate(intent = {}) {
  const labels = Array.isArray(intent.labels) && intent.labels.length > 0 ? intent.labels : ["concept:prototype@0.1.0"];
  const template = generateConceptDraft({
    labels,
    prototype_of: intent.prototype_of ?? "type:prototype",
    extends: Array.isArray(intent.extends) ? intent.extends : [],
    signals: intent.signals ?? [structuredClone(DEFAULT_SIGNAL_TEMPLATE)],
    version: intent.version ?? SCHEMA_VERSION,
    resolution: intent.resolution ?? structuredClone(DEFAULT_RESOLUTION),
    embedding: intent.embedding ?? null,
    meta: intent.meta ?? { instructions: "Document the provenance + reasoning for this prototype." }
  });

  // Keep the UUID stable if provided to support idempotent retries.
  if (intent.uuid) template.uuid = intent.uuid;
  if (intent.status) template.status = intent.status;

  return template;
}

/**
 * Validate that a concept obeys the schema language.
 * Returns lint warnings/errors without throwing.
 */
export function validateConceptSchema(concept) {
  const normalized = structuredClone(concept ?? {});

  if (!normalized.uuid) {
    normalized.uuid = randomUUID();
  }
  if (!normalized.kind) {
    normalized.kind = "cpms.concept";
  }

  const report = lintConcept(normalized);
  return { ok: report.errors.length === 0, report, concept: normalized };
}
