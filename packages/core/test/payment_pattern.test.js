import { describe, it, expect } from "vitest";
import { matchPatternGreedyRepair } from "../src/engine/patternMatch.js";

const paymentPattern = {
  pattern_id: "pattern:payment@1.0.0",
  includes: [
    "concept:card_name@1.0.0",
    "concept:card_number@1.0.0",
    "concept:card_expiry@1.0.0",
    "concept:card_cvv@1.0.0",
    "concept:submit_payment@1.0.0"
  ],
  strategy: { type: "greedy_repair", top_k: 5, max_repairs: 10 },
  constraints: [
    { type: "required_concepts", params: { ids: ["concept:card_name@1.0.0", "concept:card_number@1.0.0", "concept:card_expiry@1.0.0", "concept:card_cvv@1.0.0"] } }
  ]
};

const paymentConcepts = [
  {
    concept_id: "concept:card_name@1.0.0",
    concept_type: "type:cardholder_name",
    signals: [
      { signal_id: "ac", applies_to: ["dom"], evaluator: "dom.attr_in", params: { attr: "autocomplete", values: ["cc-name", "cc-full-name"] }, mode: "bayes", llr_when_true: 2.6, llr_when_false: 0 },
      { signal_id: "terms", applies_to: ["dom"], evaluator: "dom.text_contains_any", params: { terms: ["name on card", "cardholder", "card holder", "card name"] }, mode: "fuzzy", weight: 1.0 }
    ],
    resolution: { score_model: { type: "hybrid_logit", prior_logit: -0.8, epsilon: 1e-4, calibration: "sigmoid" }, decision: { policy: "winner_take_all", min_conf: 0.7, min_margin: 0.1, confirm_threshold: 0.9 } }
  },
  {
    concept_id: "concept:card_number@1.0.0",
    concept_type: "type:card_number",
    signals: [
      { signal_id: "ac", applies_to: ["dom"], evaluator: "dom.attr_in", params: { attr: "autocomplete", values: ["cc-number", "card-number"] }, mode: "bayes", llr_when_true: 3.0, llr_when_false: 0 },
      { signal_id: "type", applies_to: ["dom"], evaluator: "dom.type_is", params: { types: ["text", "tel", "number"] }, mode: "fuzzy", weight: 0.6 },
      { signal_id: "terms", applies_to: ["dom"], evaluator: "dom.text_contains_any", params: { terms: ["card number", "credit card", "debit card"] }, mode: "fuzzy", weight: 1.3 }
    ],
    resolution: { score_model: { type: "hybrid_logit", prior_logit: -0.7, epsilon: 1e-4, calibration: "sigmoid" }, decision: { policy: "winner_take_all", min_conf: 0.75, min_margin: 0.1, confirm_threshold: 0.9 } }
  },
  {
    concept_id: "concept:card_expiry@1.0.0",
    concept_type: "type:card_expiry",
    signals: [
      { signal_id: "ac", applies_to: ["dom"], evaluator: "dom.attr_in", params: { attr: "autocomplete", values: ["cc-exp", "cc-exp-month", "cc-exp-year"] }, mode: "bayes", llr_when_true: 2.8, llr_when_false: 0 },
      { signal_id: "terms", applies_to: ["dom"], evaluator: "dom.text_contains_any", params: { terms: ["expiry", "expiration", "exp date", "mm / yy"] }, mode: "fuzzy", weight: 1.1 }
    ],
    resolution: { score_model: { type: "hybrid_logit", prior_logit: -0.8, epsilon: 1e-4, calibration: "sigmoid" }, decision: { policy: "winner_take_all", min_conf: 0.7, min_margin: 0.1, confirm_threshold: 0.9 } }
  },
  {
    concept_id: "concept:card_cvv@1.0.0",
    concept_type: "type:card_cvv",
    signals: [
      { signal_id: "ac", applies_to: ["dom"], evaluator: "dom.attr_in", params: { attr: "autocomplete", values: ["cc-csc", "cc-cvv", "cc-cvc"] }, mode: "bayes", llr_when_true: 3.0, llr_when_false: 0 },
      { signal_id: "terms", applies_to: ["dom"], evaluator: "dom.text_contains_any", params: { terms: ["cvv", "cvc", "security code", "card code"] }, mode: "fuzzy", weight: 1.2 }
    ],
    resolution: { score_model: { type: "hybrid_logit", prior_logit: -0.9, epsilon: 1e-4, calibration: "sigmoid" }, decision: { policy: "winner_take_all", min_conf: 0.72, min_margin: 0.1, confirm_threshold: 0.9 } }
  },
  {
    concept_id: "concept:submit_payment@1.0.0",
    concept_type: "type:submit_payment_button",
    signals: [
      { signal_id: "role", applies_to: ["dom"], evaluator: "dom.role_is", params: { role: "button" }, mode: "fuzzy", weight: 0.7 },
      { signal_id: "terms", applies_to: ["dom"], evaluator: "dom.text_contains_any", params: { terms: ["pay", "complete purchase", "place order", "confirm payment"] }, mode: "fuzzy", weight: 1.4 }
    ],
    resolution: { score_model: { type: "hybrid_logit", prior_logit: -0.6, epsilon: 1e-4, calibration: "sigmoid" }, decision: { policy: "winner_take_all", min_conf: 0.65, min_margin: 0.1, confirm_threshold: 0.9 } }
  }
];

const paymentObservation = {
  page_id: "fixture:payment",
  candidates: [
    { candidate_id: "cand_card_name", dom: { label_text: "Name on card", attrs: { autocomplete: "cc-name", name: "cardName" }, placeholder: "Full name" } },
    { candidate_id: "cand_card_number", dom: { type: "text", label_text: "Card number", attrs: { autocomplete: "cc-number", name: "cardNumber" }, placeholder: "1234 5678 9012 3456" } },
    { candidate_id: "cand_expiry", dom: { label_text: "Expiry date", attrs: { autocomplete: "cc-exp", name: "cardExp" }, placeholder: "MM / YY" } },
    { candidate_id: "cand_cvv", dom: { label_text: "Security code", attrs: { autocomplete: "cc-csc", name: "cardCvv" }, placeholder: "CVV" } },
    { candidate_id: "cand_pay", dom: { role: "button", text: "Pay now", attrs: { id: "payNow" } } }
  ]
};

describe("payment pattern greedy match", () => {
  it("assigns each payment concept to the payment form fixture", () => {
    const { assigned, trace } = matchPatternGreedyRepair(paymentPattern, paymentConcepts, paymentObservation);
    expect(assigned["concept:card_name@1.0.0"]).toBe("cand_card_name");
    expect(assigned["concept:card_number@1.0.0"]).toBe("cand_card_number");
    expect(assigned["concept:card_expiry@1.0.0"]).toBe("cand_expiry");
    expect(assigned["concept:card_cvv@1.0.0"]).toBe("cand_cvv");
    expect(assigned["concept:submit_payment@1.0.0"]).toBe("cand_pay");
    expect(trace.missing_required).toEqual([]);
  });
});
