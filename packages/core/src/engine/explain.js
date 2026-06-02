import { evalSignalDetailed, normalizeEvaluatorName } from "./evaluators.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p, eps) => {
  const pp = clamp(p, eps, 1 - eps);
  return Math.log(pp / (1 - pp));
};

export function matchConceptExplain(concept, obs) {
  const m = concept.resolution.score_model ?? {};
  const d = concept.resolution.decision ?? {};
  const eps = m.epsilon ?? 1e-4;
  const prior = m.prior_logit ?? 0;

  const traces = (obs.candidates ?? []).map((cand) => {
    let L = prior;
    const sigTraces = [];

    for (const sig of concept.signals ?? []) {
      const evaluated = evalSignalDetailed(sig, cand);
      const raw = clamp(evaluated.score, 0, 1);
      const mode = sig.mode ?? "fuzzy";

      let contrib = 0;
      if (mode === "fuzzy") {
        const w = sig.weight ?? 1.0;
        contrib = w * logit(raw, eps);
      } else {
        contrib = raw >= 0.5 ? (sig.llr_when_true ?? 0) : (sig.llr_when_false ?? 0);
      }
      L += contrib;

      sigTraces.push({
        signal_id: sig.signal_id,
        evaluator: normalizeEvaluatorName(sig.evaluator),
        original_evaluator: sig.evaluator,
        mode,
        raw,
        matched: raw >= 0.5,
        weight: mode === "fuzzy" ? (sig.weight ?? 1.0) : undefined,
        llr_when_true: mode === "bayes" ? (sig.llr_when_true ?? 0) : undefined,
        llr_when_false: mode === "bayes" ? (sig.llr_when_false ?? 0) : undefined,
        contribution: contrib,
        raw_values: evaluated.evidence?.raw_values ?? [],
        normalized_values: evaluated.evidence?.normalized_values ?? [],
        normalized_terms: evaluated.evidence?.normalized_terms ?? [],
        matched_terms: evaluated.evidence?.matched_terms ?? []
      });
    }

    const p = m.calibration === "none" ? L : sigmoid(L);
    return { candidate_id: cand.candidate_id, prior_logit: prior, total_logit: L, p, signals: sigTraces };
  });

  traces.sort((a, b) => b.p - a.p);
  const best = traces[0];
  const second = traces[1];
  const margin = best && second ? best.p - second.p : (best ? best.p : 0);

  const min_conf = d.min_conf ?? 0;
  const min_margin = d.min_margin ?? 0;
  const confirm_threshold = d.confirm_threshold ?? 0.90;

  const accepted = !!best && best.p >= min_conf && margin >= min_margin;
  const needs_confirmation = !accepted || (best?.p ?? 0) < confirm_threshold;
  const reason = !best
    ? "no_candidates"
    : best.p < min_conf
      ? "below_min_conf"
      : margin < min_margin
        ? "below_min_margin"
        : needs_confirmation
          ? "below_confirmation_threshold"
          : "accepted";

  return {
    concept_id: concept.concept_id,
    score: best?.p ?? 0,
    p: best?.p ?? 0,
    accepted,
    needs_confirmation,
    needs_user_confirmation: needs_confirmation,
    reason,
    best: best ? { candidate_id: best.candidate_id, p: best.p } : undefined,
    runner_up: second ? { candidate_id: second.candidate_id, p: second.p } : undefined,
    margin,
    candidates: traces
  };
}
