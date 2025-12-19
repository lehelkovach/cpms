import { describe, it, expect } from "vitest";
import {
  describeConceptSchemaLanguage,
  buildConceptSchemaTemplate,
  validateConceptSchema,
  compileConcept
} from "../src/index.js";

describe("concept schema language", () => {
  it("describes required properties", () => {
    const schema = describeConceptSchemaLanguage();
    expect(schema.version).toBeDefined();
    expect(schema.properties.labels.required).toBe(true);
    expect(schema.allowed_evaluators.length).toBeGreaterThan(0);
  });

  it("builds a template honoring intent overrides", () => {
    const template = buildConceptSchemaTemplate({ labels: ["concept:test@1.0.0"], prototype_of: "type:test" });
    expect(template.labels[0]).toBe("concept:test@1.0.0");
    expect(template.prototype_of).toBe("type:test");
    expect(template.llm_embedding_meta).toBeTruthy();
    expect(template.llm_embedding_meta.version).toBe("2024-05-01");
  });

  it("validates concepts and reports compiler findings", () => {
    const template = buildConceptSchemaTemplate();
    const validation = validateConceptSchema(template);
    expect(validation.ok).toBe(true);

    const compiled = compileConcept(validation.concept);
    expect(compiled.concept.signals.length).toBeGreaterThan(0);
  });
});
