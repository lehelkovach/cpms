import { describe, it, expect } from "vitest";
import { scorePair } from "../src/engine/scoring.js";
import { winnerTakeAll } from "../src/engine/decision.js";

const concept = {
  signals: [
    { signal_id: "ac", evaluator: "dom.attr_in", params: { attr: "autocomplete", values: ["email"] }, mode: "bayes", llr_when_true: 2, llr_when_false: -1 },
    { signal_id: "type", evaluator: "dom.type_is", params: { types: ["email"] }, mode: "fuzzy", weight: 0.5 }
  ],
  resolution: { score_model: { type: "hybrid_logit", prior_logit: -0.5, epsilon: 1e-3, calibration: "none" }, decision: { policy: "winner_take_all", min_conf: 0.6, min_margin: 0.05, confirm_threshold: 0.8 } }
};

const goodCandidate = { dom: { attrs: { autocomplete: "email", type: "email" }, type: "email" } };
const badCandidate = { dom: { attrs: { autocomplete: "text", type: "text" }, type: "text" } };

describe("scorePair", () => {
  it("adds fuzzy and bayesian evidence", () => {
    const goodScore = scorePair(concept, goodCandidate);
    const badScore = scorePair(concept, badCandidate);
    expect(goodScore).toBeGreaterThan(0);
    expect(badScore).toBeLessThan(0);
  });

  it("calibrates to probability-like output with sigmoid", () => {
    const calibrated = {
      ...concept,
      resolution: { ...concept.resolution, score_model: { ...concept.resolution.score_model, calibration: "sigmoid" } }
    };
    const goodScore = scorePair(calibrated, goodCandidate);
    const badScore = scorePair(calibrated, badCandidate);
    expect(goodScore).toBeGreaterThan(0.9);
    expect(badScore).toBeLessThan(0.2);
  });
});

describe("winnerTakeAll", () => {
  it("accepts the best candidate when confidence and margin are high enough", () => {
    const scored = [{ id: "a", p: 0.95 }, { id: "b", p: 0.6 }];
    const decision = winnerTakeAll(concept, scored);
    expect(decision.accepted).toBe(true);
    expect(decision.needs_user_confirmation).toBe(false);
    expect(decision.best?.candidate_id).toBe("a");
    expect(decision.margin).toBeCloseTo(0.35, 1);
  });

  it("requests confirmation when margin is too small", () => {
    const scored = [{ id: "a", p: 0.65 }, { id: "b", p: 0.62 }];
    const decision = winnerTakeAll(concept, scored);
    expect(decision.accepted).toBe(false);
    expect(decision.needs_user_confirmation).toBe(true);
  });
});
