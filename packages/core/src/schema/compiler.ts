const DEFAULT_RANGES = {
  weight: [-10, 10] as const,
  llr: [-20, 20] as const,
  prior_logit: [-10, 10] as const
};

// Expand this allowlist as you implement evaluators.
export const ALLOWED_EVALUATORS = new Set<string>([
  "dom.attr_in",
  "dom.text_contains_any",
  "dom.role_is",
  "dom.type_is"
]);

export function lintConcept(concept: any) {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!concept || concept.kind !== "cpms.concept") errors.push("kind must be cpms.concept");
  if (!concept?.uuid) errors.push("uuid missing");
  if (!Array.isArray(concept?.labels) || concept.labels.length === 0) errors.push("labels[] required");
  if (!concept?.resolution) warnings.push("resolution missing; defaults recommended");
  if (!Array.isArray(concept?.signals)) warnings.push("signals should be an array");

  for (const s of concept?.signals ?? []) {
    if (!s?.evaluator) warnings.push(`signal ${s?.signal_id ?? "?"} missing evaluator`);
    if (s?.evaluator && !ALLOWED_EVALUATORS.has(s.evaluator)) {
      warnings.push(`unknown evaluator '${s.evaluator}' (will be ignored by compiler)`);
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

export function compileConcept(concept: any) {
  const report = lintConcept(concept);
  const normalized = structuredClone(concept);

  const clamp = (v: number, [a, b]: readonly [number, number]) => Math.max(a, Math.min(b, v));

  if (normalized?.resolution?.score_model?.prior_logit != null) {
    const v = normalized.resolution.score_model.prior_logit;
    if (typeof v === "number" && Number.isFinite(v)) {
      normalized.resolution.score_model.prior_logit = clamp(v, DEFAULT_RANGES.prior_logit);
    }
  }

  const kept: any[] = [];
  const dropped: any[] = [];

  for (const s of normalized?.signals ?? []) {
    if (s?.evaluator && !ALLOWED_EVALUATORS.has(s.evaluator)) {
      dropped.push({ signal_id: s.signal_id ?? null, reason: "unknown_evaluator", evaluator: s.evaluator });
      continue;
    }
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
