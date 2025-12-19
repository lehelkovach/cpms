import { describe, it, expect } from "vitest";
import { generateConceptDraft, generatePatternDraft, compileConcept } from "../src/index.js";

describe("schema generator/compiler", () => {
  it("generates a concept draft with uuid + labels", () => {
    const c = generateConceptDraft({ labels: ["card number"], prototype_of: "type:card_number_field" });
    expect(typeof c.uuid).toBe("string");
    expect(c.labels[0]).toBe("card number");
    expect(c.status).toBe("draft");
     expect(c.llm_embedding_meta).toBeTruthy();
     expect(c.llm_embedding_meta.version).toBe("2024-05-01");
  });

  it("compiler drops unknown evaluators but does not fail", () => {
    const c = generateConceptDraft({
      labels: ["email"],
      signals: [{ signal_id: "x", evaluator: "dom.not_real", mode: "fuzzy", weight: 999 }]
    });
    const out = compileConcept(c);
    expect(out.concept.signals.length).toBe(0);
    expect(out.report.dropped_signals.length).toBe(1);
  });

  it("generates a pattern draft", () => {
    const p = generatePatternDraft({ labels: ["login form"], includes: ["uuid-a", "uuid-b"] });
    expect(typeof p.uuid).toBe("string");
    expect(p.includes.length).toBe(2);
    expect(p.status).toBe("draft");
  });
});
