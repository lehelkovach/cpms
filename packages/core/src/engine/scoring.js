import { evalSignal } from "./evaluators.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p, eps) => {
  const pp = clamp(p, eps, 1 - eps);
  return Math.log(pp / (1 - pp));
};

/** Hybrid logit score, optionally sigmoid-calibrated */
export function scorePair(concept, cand) {
  const m = concept.resolution.score_model;
  const eps = m.epsilon ?? 1e-4;
  let L = m.prior_logit ?? 0;

  for (const sig of concept.signals ?? []) {
    const raw = clamp(evalSignal(sig, cand), 0, 1);
    const mode = sig.mode ?? "fuzzy";
    if (mode === "fuzzy") {
      const w = sig.weight ?? 1.0;
      L += w * logit(raw, eps);
    } else {
      L += raw >= 0.5 ? (sig.llr_when_true ?? 0) : (sig.llr_when_false ?? 0);
    }
  }
  return m.calibration === "none" ? L : sigmoid(L);
}
