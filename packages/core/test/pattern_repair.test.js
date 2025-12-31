import { describe, it, expect } from "vitest";
import { matchPatternGreedyRepair } from "../src/engine/patternMatch.js";

const conceptA = {
  concept_id: "concept:A@1.0.0",
  signals: [
    { signal_id: "shared", evaluator: "dom.attr_in", params: { attr: "tag", values: ["shared-match"] }, mode: "bayes", llr_when_true: 0.95, llr_when_false: 0 },
    { signal_id: "alt", evaluator: "dom.attr_in", params: { attr: "tag", values: ["alt-a"] }, mode: "bayes", llr_when_true: 0.6, llr_when_false: 0 }
  ],
  resolution: { score_model: { type: "hybrid_logit", prior_logit: 0, calibration: "none" }, decision: { policy: "winner_take_all", min_conf: 0.5, min_margin: 0.01, confirm_threshold: 0.9 } }
};

const conceptB = {
  concept_id: "concept:B@1.0.0",
  signals: [
    { signal_id: "shared", evaluator: "dom.attr_in", params: { attr: "tag", values: ["shared-match"] }, mode: "bayes", llr_when_true: 0.8, llr_when_false: 0 },
    { signal_id: "alt", evaluator: "dom.attr_in", params: { attr: "tag", values: ["alt-b"] }, mode: "bayes", llr_when_true: 0.3, llr_when_false: 0 }
  ],
  resolution: { score_model: { type: "hybrid_logit", prior_logit: 0, calibration: "none" }, decision: { policy: "winner_take_all", min_conf: 0.5, min_margin: 0.01, confirm_threshold: 0.9 } }
};

const pattern = {
  pattern_id: "pattern:swap-demo@1.0.0",
  includes: [conceptA.concept_id, conceptB.concept_id],
  strategy: { type: "greedy_repair", top_k: 3, max_repairs: 5 }
};

const observation = {
  page_id: "fixture:swap-demo",
  candidates: [
    { candidate_id: "shared", dom: { attrs: { tag: "shared-match" } } },
    { candidate_id: "alt-a", dom: { attrs: { tag: "alt-a" } } },
    { candidate_id: "alt-b", dom: { attrs: { tag: "alt-b" } } }
  ]
};

describe("pattern matching repair loop", () => {
  it("swaps assignments when it improves total score and respects min_conf", () => {
    const { assigned, trace } = matchPatternGreedyRepair(pattern, [conceptA, conceptB], observation);
    expect(assigned[conceptA.concept_id]).toBe("alt-a");
    expect(assigned[conceptB.concept_id]).toBe("shared");
    expect(trace.repairs.some((r) => r.type === "swap")).toBe(true);
  });
});
