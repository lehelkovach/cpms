import { KNOWN_EVALUATOR_NAMES, normalizeEvaluatorName } from "../engine/evaluators.js";

// Very lightweight compiler: normalize + soft-lint + drop unknown evaluators.
// Unknown evaluators fail closed by being excluded from compiled active signals.

const DEFAULT_RANGES = {
  weight: [-10, 10],
  llr: [-20, 20],
  prior_logit: [-10, 10]
};

export const ALLOWED_EVALUATORS = new Set(KNOWN_EVALUATOR_NAMES);

export function lintConcept(concept) {
  const warnings = [];
  const errors = [];

  if (!concept || concept.kind !== "cpms.concept") errors.push("kind must be cpms.concept");
  if (!concept?.uuid) errors.push("uuid missing");
  if (!Array.isArray(concept?.labels) || concept.labels.length === 0) errors.push("labels[] required");
  if (!concept?.resolution) warnings.push("resolution missing; defaults recommended");
  if (!Array.isArray(concept?.signals)) warnings.push("signals should be an array");

  for (const s of concept?.signals ?? []) {
    const evaluator = normalizeEvaluatorName(s?.evaluator);
    if (!s?.evaluator) warnings.push(`signal ${s?.signal_id ?? "?"} missing evaluator`);
    if (s?.evaluator && !ALLOWED_EVALUATORS.has(evaluator)) {
      warnings.push(`unknown evaluator '${s.evaluator}' (will be ignored by compiler)`);
    }
    if (s?.evaluator && evaluator !== s.evaluator) {
      warnings.push(`evaluator '${s.evaluator}' is deprecated; normalized to '${evaluator}'`);
    }
    if (s?.mode === "fuzzy" && typeof s.weight === "number" && !Number.isFinite(s.weight)) {
      warnings.push(`signal '${s.signal_id}' weight is not finite`);
    }
    if (s?.mode === "bayes") {
      for (const k of ["llr_when_true", "llr_when_false"]) {
        if (typeof s?.[k] === "number" && !Number.isFinite(s[k])) warnings.push(`signal '${s.signal_id}' ${k} not finite`);
      }
    }
  }

  return { warnings, errors };
}

export function compileConcept(concept) {
  const report = lintConcept(concept);
  const normalized = structuredClone(concept);

  const clamp = (v, [a, b]) => Math.max(a, Math.min(b, v));

  if (normalized?.resolution?.score_model?.prior_logit != null) {
    const v = normalized.resolution.score_model.prior_logit;
    if (typeof v === "number" && Number.isFinite(v)) {
      normalized.resolution.score_model.prior_logit = clamp(v, DEFAULT_RANGES.prior_logit);
    }
  }

  const kept = [];
  const dropped = [];

  for (const s of normalized?.signals ?? []) {
    const evaluator = normalizeEvaluatorName(s?.evaluator);
    if (s?.evaluator && !ALLOWED_EVALUATORS.has(evaluator)) {
      dropped.push({ signal_id: s.signal_id ?? null, reason: "unknown_evaluator", evaluator: s.evaluator });
      continue;
    }
    if (s?.evaluator) s.evaluator = evaluator;
    if (s?.mode === "fuzzy" && typeof s.weight === "number" && Number.isFinite(s.weight)) {
      s.weight = clamp(s.weight, DEFAULT_RANGES.weight);
    }
    if (s?.mode === "bayes") {
      for (const k of ["llr_when_true", "llr_when_false"]) {
        if (typeof s?.[k] === "number" && Number.isFinite(s[k])) s[k] = clamp(s[k], DEFAULT_RANGES.llr);
      }
    }
    kept.push(s);
  }

  normalized.signals = kept;

  return { concept: normalized, report: { ...report, dropped_signals: dropped } };
}
