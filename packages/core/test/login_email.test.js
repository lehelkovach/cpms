import { describe, it, expect } from "vitest";
import { matchConceptExplain } from "../src/engine/explain.js";
import { matchConcept } from "../src/engine/match.js";

const concept = {
  concept_id: "concept:email@1.0.0",
  concept_type: "type:email_field",
  signals: [
    { signal_id: "ac", applies_to: ["dom"], evaluator: "dom.attr_in",
      params: { attr: "autocomplete", values: ["email","username"] }, mode: "bayes", llr_when_true: 3, llr_when_false: 0 },
    { signal_id: "terms", applies_to: ["dom"], evaluator: "dom.text_contains_any",
      params: { terms: ["email","e-mail","username"] }, mode: "fuzzy", weight: 1.2 }
  ],
  resolution: {
    score_model: { type: "hybrid_logit", prior_logit: -1, epsilon: 1e-4, calibration: "sigmoid" },
    decision: { policy: "winner_take_all", min_conf: 0.75, min_margin: 0.10, confirm_threshold: 0.90 }
  }
};

const obs = {
  page_id: "fixture:login",
  candidates: [
    { candidate_id: "cand_email", dom: { attrs: { autocomplete: "email", name: "email" }, label_text: "Email" } },
    { candidate_id: "cand_pass", dom: { attrs: { autocomplete: "current-password", name: "password" }, label_text: "Password" } }
  ]
};

const localizedObservation = {
  page_id: "fixture:login_multilingual",
  candidates: [
    {
      candidate_id: "cand_localized_email",
      dom: {
        label_text: "Correo electrónico",
        placeholder: "tu@ejemplo.com",
        nearby_text: ["✉️", "Requerido"],
        attrs: { id: "correo", name: "correo" }
      }
    },
    {
      candidate_id: "cand_username",
      dom: {
        label_text: "Nombre de usuario",
        placeholder: "juan23",
        attrs: { id: "usuario", name: "usuario" }
      }
    }
  ]
};

describe("matchConceptExplain(email)", () => {
  it("selects cand_email", () => {
    const ex = matchConceptExplain(concept, obs);
    expect(ex.best.candidate_id).toBe("cand_email");
  });

  it("emits deterministic explanation traces with normalized evidence", () => {
    const ex = matchConceptExplain(concept, obs);
    const stableTrace = {
      concept_id: ex.concept_id,
      accepted: ex.accepted,
      needs_confirmation: ex.needs_confirmation,
      reason: ex.reason,
      best: ex.best?.candidate_id,
      candidates: ex.candidates.map((candidate) => ({
        candidate_id: candidate.candidate_id,
        p: Number(candidate.p.toFixed(6)),
        signals: candidate.signals.map((signal) => ({
          signal_id: signal.signal_id,
          evaluator: signal.evaluator,
          matched: signal.matched,
          raw_values: signal.raw_values,
          normalized_values: signal.normalized_values,
          matched_terms: signal.matched_terms
        }))
      }))
    };

    expect(stableTrace).toMatchInlineSnapshot(`
      {
        "accepted": true,
        "best": "cand_email",
        "candidates": [
          {
            "candidate_id": "cand_email",
            "p": 0.999998,
            "signals": [
              {
                "evaluator": "dom.attr_in",
                "matched": true,
                "matched_terms": [
                  "email",
                ],
                "normalized_values": [
                  "email",
                ],
                "raw_values": [
                  "email",
                ],
                "signal_id": "ac",
              },
              {
                "evaluator": "dom.text_contains_any",
                "matched": true,
                "matched_terms": [
                  "email",
                  "mail",
                ],
                "normalized_values": [
                  "email",
                  "email",
                  "email",
                ],
                "raw_values": [
                  "Email",
                  "email",
                  "email",
                ],
                "signal_id": "terms",
              },
            ],
          },
          {
            "candidate_id": "cand_pass",
            "p": 0.000006,
            "signals": [
              {
                "evaluator": "dom.attr_in",
                "matched": false,
                "matched_terms": [],
                "normalized_values": [
                  "current password",
                ],
                "raw_values": [
                  "current-password",
                ],
                "signal_id": "ac",
              },
              {
                "evaluator": "dom.text_contains_any",
                "matched": false,
                "matched_terms": [],
                "normalized_values": [
                  "password",
                  "password",
                  "current password",
                ],
                "raw_values": [
                  "Password",
                  "password",
                  "current-password",
                ],
                "signal_id": "terms",
              },
            ],
          },
        ],
        "concept_id": "concept:email@1.0.0",
        "needs_confirmation": false,
        "reason": "accepted",
      }
    `);
  });

  it("needs feedback to handle multilingual cues", () => {
    const naiveConcept = {
      ...concept,
      labels: ["concept:email_localized@1.0.0"],
      signals: [
        {
          signal_id: "ac",
          applies_to: ["dom"],
          evaluator: "dom.attr_in",
          params: { attr: "autocomplete", values: ["email", "username"] },
          mode: "bayes",
          llr_when_true: 3,
          llr_when_false: 0
        },
        {
          signal_id: "terms",
          applies_to: ["dom"],
          evaluator: "dom.text_contains_any",
          params: { terms: ["email", "e-mail", "username"] },
          mode: "fuzzy",
          weight: 1.2
        }
      ]
    };

    const naiveResult = matchConcept(naiveConcept, localizedObservation);
    expect(naiveResult.accepted).toBe(false);
    expect(naiveResult.best?.candidate_id).toBe("cand_localized_email");

    const improvedConcept = structuredClone(naiveConcept);
    improvedConcept.signals = [
      ...improvedConcept.signals,
      {
        signal_id: "multilingual_terms",
        applies_to: ["dom"],
        evaluator: "dom.text_contains_any",
        params: { terms: ["correo", "メール", "почта", "郵便", "✉"] },
        mode: "fuzzy",
        weight: 1.5
      }
    ];

    const improvedResult = matchConcept(improvedConcept, localizedObservation);
    expect(improvedResult.accepted).toBe(true);
    expect(improvedResult.best?.candidate_id).toBe("cand_localized_email");
    expect(improvedResult.best?.p ?? 0).toBeGreaterThan(0.75);
  });
});
