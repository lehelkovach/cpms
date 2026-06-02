import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  matchConcept,
  validateCpmsJson
} from "../src/index.js";

const examplesDir = resolve(import.meta.dirname, "../../../examples");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function exampleFiles(kind) {
  return readdirSync(resolve(examplesDir, kind))
    .filter((file) => file.endsWith(".json"))
    .map((file) => resolve(examplesDir, kind, file));
}

describe("CPMS JSON Schemas", () => {
  it("validates all shipped concept examples", () => {
    for (const file of exampleFiles("concepts")) {
      const result = validateCpmsJson("ConceptPrototype", readJson(file));
      expect(result.errors, file).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });

  it("validates all shipped pattern and observation examples", () => {
    for (const file of exampleFiles("patterns")) {
      expect(validateCpmsJson("PatternPrototype", readJson(file)).errors, file).toEqual([]);
    }
    for (const file of exampleFiles("observations")) {
      expect(validateCpmsJson("Observation", readJson(file)).errors, file).toEqual([]);
    }
  });

  it("validates concrete request payload components", () => {
    for (const file of exampleFiles("requests")) {
      const payload = readJson(file);
      expect(validateCpmsJson("PatternPrototype", payload.pattern).errors, file).toEqual([]);
      expect(validateCpmsJson("Observation", payload.observation).errors, file).toEqual([]);
      for (const concept of payload.concepts) {
        expect(validateCpmsJson("ConceptPrototype", concept).errors, file).toEqual([]);
      }
    }
  });

  it("rejects invalid evaluator names with useful paths", () => {
    const result = validateCpmsJson("ConceptPrototype", {
      concept_id: "concept:bad@1.0.0",
      signals: [{ signal_id: "bad", evaluator: "dom.not_real", mode: "fuzzy", weight: 1 }],
      resolution: {}
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("$.signals[0].evaluator");
  });

  it("validates the match result response shape", () => {
    const concept = readJson(resolve(examplesDir, "concepts/login.email.json"));
    const observation = readJson(resolve(examplesDir, "observations/login.observation.json"));
    const result = matchConcept(concept, observation);
    expect(validateCpmsJson("MatchResult", result).errors).toEqual([]);
  });
});
