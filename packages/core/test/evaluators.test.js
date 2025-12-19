import { describe, it, expect } from "vitest";
import { REGISTRY } from "../src/engine/evaluators.js";

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
