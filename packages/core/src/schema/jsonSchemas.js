import { EVALUATOR_ALIASES } from "../engine/evaluators.js";
import { ALLOWED_EVALUATORS } from "./compiler.js";

const idPattern = "^(concept|pattern):[^@]+@[0-9]+\\.[0-9]+\\.[0-9]+$";
const allowedEvaluatorNames = [...new Set([...ALLOWED_EVALUATORS, ...Object.keys(EVALUATOR_ALIASES)])].sort();

export const SignalSpecSchema = {
  $id: "https://cpms.dev/schemas/signal-spec.schema.json",
  type: "object",
  required: ["signal_id", "evaluator", "mode"],
  additionalProperties: true,
  properties: {
    signal_id: { type: "string", minLength: 1 },
    applies_to: { type: "array", items: { type: "string" } },
    evaluator: { type: "string", enum: allowedEvaluatorNames },
    params: { type: "object" },
    mode: { type: "string", enum: ["fuzzy", "bayes"] },
    weight: { type: "number" },
    llr_when_true: { type: "number" },
    llr_when_false: { type: "number" }
  }
};

export const ConceptPrototypeSchema = {
  $id: "https://cpms.dev/schemas/concept-prototype.schema.json",
  type: "object",
  required: ["concept_id", "signals", "resolution"],
  additionalProperties: true,
  properties: {
    concept_id: { type: "string", pattern: "^concept:" },
    concept_type: { type: "string" },
    deprecated_by: { type: "string", pattern: "^concept:" },
    alias_of: { type: "string", pattern: "^concept:" },
    compatible_with: { type: "array", items: { type: "string", pattern: "^concept:" } },
    signals: { type: "array", minItems: 1, items: { $ref: SignalSpecSchema.$id } },
    resolution: { type: "object" }
  }
};

export const PatternPrototypeSchema = {
  $id: "https://cpms.dev/schemas/pattern-prototype.schema.json",
  type: "object",
  required: ["pattern_id", "includes"],
  additionalProperties: true,
  properties: {
    pattern_id: { type: "string", pattern: "^pattern:" },
    includes: { type: "array", minItems: 1, items: { type: "string", pattern: "^concept:" } },
    strategy: { type: "object" },
    constraints: { type: "array" }
  }
};

export const CandidateSchema = {
  $id: "https://cpms.dev/schemas/candidate.schema.json",
  type: "object",
  required: ["candidate_id"],
  additionalProperties: true,
  properties: {
    candidate_id: { type: "string", minLength: 1 },
    dom: { type: "object" },
    a11y: { type: "object" },
    vision: { type: "object" },
    mobile: { type: "object" }
  }
};

export const ObservationSchema = {
  $id: "https://cpms.dev/schemas/observation.schema.json",
  type: "object",
  required: ["page_id", "candidates"],
  additionalProperties: true,
  properties: {
    page_id: { type: "string", minLength: 1 },
    timestamp: { type: "string" },
    url: { type: "string" },
    candidates: { type: "array", items: { $ref: CandidateSchema.$id } }
  }
};

export const MatchResultSchema = {
  $id: "https://cpms.dev/schemas/match-result.schema.json",
  type: "object",
  required: ["accepted", "needs_confirmation", "score", "p", "margin", "reason"],
  additionalProperties: true,
  properties: {
    concept_id: { type: "string" },
    score: { type: "number" },
    p: { type: "number" },
    margin: { type: "number" },
    accepted: { type: "boolean" },
    needs_confirmation: { type: "boolean" },
    reason: { type: "string" },
    best: { type: ["object", "null"] },
    runner_up: { type: ["object", "null"] },
    ranked: { type: "array" },
    candidates: { type: "array" }
  }
};

export const PatchSchema = {
  $id: "https://cpms.dev/schemas/patch.schema.json",
  type: "object",
  required: ["target", "op", "evidence"],
  additionalProperties: true,
  properties: {
    target: { type: "string", pattern: idPattern },
    op: {
      type: "string",
      enum: [
        "add_synonym",
        "add_signal",
        "adjust_weight",
        "add_negative_signal",
        "add_exemplar_reference",
        "deprecate_alias",
        "create_draft_version",
        "promote_draft"
      ]
    },
    signal: { type: "object" },
    evidence: { type: "object" }
  }
};

export const VersionManifestSchema = {
  $id: "https://cpms.dev/schemas/version-manifest.schema.json",
  type: "object",
  required: ["schema_version", "objects"],
  additionalProperties: true,
  properties: {
    schema_version: { type: "string" },
    objects: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "version"],
        properties: {
          id: { type: "string", pattern: idPattern },
          version: { type: "string" },
          deprecated_by: { type: "string" },
          alias_of: { type: "string" },
          compatible_with: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
};

export const CPMS_JSON_SCHEMAS = {
  ConceptPrototype: ConceptPrototypeSchema,
  PatternPrototype: PatternPrototypeSchema,
  Observation: ObservationSchema,
  Candidate: CandidateSchema,
  SignalSpec: SignalSpecSchema,
  MatchResult: MatchResultSchema,
  Patch: PatchSchema,
  VersionManifest: VersionManifestSchema
};

const schemaById = new Map(Object.values(CPMS_JSON_SCHEMAS).map((schema) => [schema.$id, schema]));

export function validateCpmsJson(schemaName, value) {
  const schema = CPMS_JSON_SCHEMAS[schemaName];
  if (!schema) throw new Error(`Unknown CPMS schema: ${schemaName}`);
  const errors = [];
  validateAgainstSchema(value, schema, "$", errors);
  return { ok: errors.length === 0, errors };
}

function validateAgainstSchema(value, schema, path, errors) {
  if (schema.$ref) {
    return validateAgainstSchema(value, schemaById.get(schema.$ref), path, errors);
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${path} must be ${types.join(" or ")}`);
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(", ")}`);
  }

  if (typeof value === "string" && schema.minLength && value.length < schema.minLength) {
    errors.push(`${path} must have length >= ${schema.minLength}`);
  }

  if (typeof value === "string" && schema.pattern && !(new RegExp(schema.pattern).test(value))) {
    errors.push(`${path} must match ${schema.pattern}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateAgainstSchema(item, schema.items, `${path}[${index}]`, errors));
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (value[required] === undefined) errors.push(`${path}.${required} is required`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (value[key] !== undefined) validateAgainstSchema(value[key], childSchema, `${path}.${key}`, errors);
    }
  }
}

function matchesType(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "null") return value === null;
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "object") return value != null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}
