import { randomUUID } from "node:crypto";

export type ConceptDraftInput = {
  labels: string[];
  prototype_of?: string;
  extends?: string[];
  version?: string;
  signals?: any[];
  resolution?: any;
  embedding?: any | null;
  meta?: Record<string, any>;
};

export type PatternDraftInput = {
  labels: string[];
  includes: string[];
  version?: string;
  strategy?: any;
  constraints?: any[];
  meta?: Record<string, any>;
};

export function generateConceptDraft(input: ConceptDraftInput) {
  const {
    labels,
    prototype_of,
    extends: extendsTypes = [],
    version = "0.1.0",
    signals = [],
    resolution,
    embedding = null,
    meta = {}
  } = input ?? ({} as any);

  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error("labels[] required");
  }

  return {
    kind: "cpms.concept",
    uuid: randomUUID(),
    version,
    labels,
    prototype_of: prototype_of ?? "type:unknown",
    extends: extendsTypes,
    signals,
    resolution: resolution ?? {
      score_model: { type: "hybrid_logit", prior_logit: -1.0, calibration: "sigmoid", epsilon: 1e-6 },
      decision: { policy: "winner_take_all", min_conf: 0.75, min_margin: 0.1, confirm_threshold: 0.9 }
    },
    llm_embedding: embedding,
    status: "draft",
    meta
  };
}

export function generatePatternDraft(input: PatternDraftInput) {
  const {
    labels,
    includes,
    version = "0.1.0",
    strategy,
    constraints = [],
    meta = {}
  } = input ?? ({} as any);

  if (!Array.isArray(labels) || labels.length === 0) throw new Error("labels[] required");
  if (!Array.isArray(includes) || includes.length === 0) throw new Error("includes[] required");

  return {
    kind: "cpms.pattern",
    uuid: randomUUID(),
    version,
    labels,
    includes,
    strategy: strategy ?? { type: "greedy_repair", top_k: 5, max_repairs: 10 },
    constraints,
    status: "draft",
    meta
  };
}
