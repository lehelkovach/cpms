import { describe, expect, it } from "vitest";
import {
  NoShogoMemoryAdapter,
  NoopMemoryAdapter,
  buildConceptResolver,
  remapPattern
} from "../src/index.js";

describe("concept alias and version resolver", () => {
  const oldConcept = {
    concept_id: "concept:email@1.0.0",
    deprecated_by: "concept:login_identifier@1.1.0",
    signals: [],
    resolution: {}
  };
  const currentConcept = {
    concept_id: "concept:login_identifier@1.1.0",
    compatible_with: ["concept:email@1.0.0", "concept:username@1.0.0"],
    signals: [],
    resolution: {}
  };

  it("maps deprecated and compatible concept IDs to the current concept", () => {
    const resolver = buildConceptResolver({ concepts: [oldConcept, currentConcept] });
    expect(resolver.resolveId("concept:email@1.0.0")).toBe("concept:login_identifier@1.1.0");
    expect(resolver.resolveId("concept:username@1.0.0")).toBe("concept:login_identifier@1.1.0");
  });

  it("remaps pattern includes and required constraints", () => {
    const resolver = buildConceptResolver({ concepts: [oldConcept, currentConcept] });
    const remapped = remapPattern({
      pattern_id: "pattern:login@1.0.0",
      includes: ["concept:email@1.0.0"],
      constraints: [{ type: "required_concepts", params: { ids: ["concept:email@1.0.0"] } }]
    }, resolver);

    expect(remapped.includes).toEqual(["concept:login_identifier@1.1.0"]);
    expect(remapped.constraints[0].params.ids).toEqual(["concept:login_identifier@1.1.0"]);
  });
});

describe("memory adapter boundary", () => {
  it("captures events in the no-op adapter without side effects", async () => {
    const adapter = new NoopMemoryAdapter();
    const event = {
      type: "concept.matched",
      concept_id: "concept:email@1.0.0",
      observation_id: "obs:fixture",
      result: { accepted: true }
    };

    await expect(adapter.emit(event)).resolves.toEqual({ ok: true, mode: "noop" });
    expect(adapter.events).toEqual([event]);
  });

  it("converts CPMS events into NoShogo graph-friendly stubs", async () => {
    const adapter = new NoShogoMemoryAdapter({ namespace: "test" });
    const result = await adapter.emit({
      type: "concept.matched",
      concept_id: "concept:email@1.0.0",
      observation_id: "obs:fixture",
      result: { accepted: true }
    });

    expect(result.mode).toBe("stub");
    expect(result.event.nodes).toEqual(expect.arrayContaining([
      { kind: "Concept", id: "concept:email@1.0.0" },
      { kind: "Observation", id: "obs:fixture" }
    ]));
  });
});
