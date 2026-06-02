import { describe, it, expect } from "vitest";
import { KNOWN_EVALUATOR_NAMES, REGISTRY } from "../src/engine/evaluators.js";

describe("dom.type_is evaluator", () => {
  const evalType = (candidate, params) => REGISTRY.eval("dom.type_is", candidate, params);

  it("matches direct dom.type value", () => {
    const result = evalType({ dom: { type: "password" } }, { type: "password" });
    expect(result).toBe(1);
  });

  it("matches dom.attrs.type case-insensitively", () => {
    const result = evalType({ dom: { attrs: { type: "Email" } } }, { type: "email" });
    expect(result).toBe(1);
  });

  it("accepts an array of types", () => {
    const result = evalType({ dom: { type: "text" } }, { types: ["email", "text"] });
    expect(result).toBe(1);
  });

  it("returns 0 when no match found", () => {
    const result = evalType({ dom: { type: "search" } }, { type: "password" });
    expect(result).toBe(0);
  });
});

describe("dom.text_contains_any evaluator", () => {
  const evalText = (candidate, params) => REGISTRY.eval("dom.text_contains_any", candidate, params);

  it("matches button text and array nearby text", () => {
    expect(evalText({ dom: { text: "Complete purchase" } }, { terms: ["purchase"] })).toBe(1);
    expect(evalText({ dom: { nearby_text: ["Name on card", "Card number"] } }, { terms: ["card number"] })).toBe(1);
  });

  it("normalizes punctuation, spaces, hyphens, and common aliases", () => {
    expect(evalText({ dom: { label_text: "E-mail address" } }, { terms: ["email"] })).toBe(1);
    expect(evalText({ dom: { label_text: "User name" } }, { terms: ["username"] })).toBe(1);
    expect(evalText({ dom: { attrs: { name: "account_login" } } }, { terms: ["login"] })).toBe(1);
  });
});

describe("signal evaluator allowlist", () => {
  it("registers required agent-facing evaluators", () => {
    expect(KNOWN_EVALUATOR_NAMES).toEqual(expect.arrayContaining([
      "dom.attr_equals",
      "dom.attr_in",
      "dom.attr_contains_any",
      "dom.text_contains_any",
      "dom.role_is",
      "dom.tag_is",
      "dom.input_type_is",
      "dom.label_contains_any",
      "dom.near_text_contains_any",
      "dom.xpath_matches",
      "dom.css_path_contains",
      "a11y.role_is",
      "a11y.name_contains_any",
      "vision.ocr_contains_any",
      "vision.spatial_relation",
      "mobile.resource_id_contains_any",
      "mobile.content_desc_contains_any",
      "mobile.class_is",
      "mobile.text_contains_any",
      "semantic.embedding_similarity"
    ]));
  });

  it("fails closed for unknown evaluators", () => {
    expect(() => REGISTRY.eval("dom.not_real", {}, {})).toThrow("Unknown evaluator");
  });
});
