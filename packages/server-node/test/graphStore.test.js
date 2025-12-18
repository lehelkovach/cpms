import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeGraphStore } from "../src/graphStore.js";

describe("graph store", () => {
  it("persists concepts to a JSONL file when in file mode", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cpms-graph-"));
    const store = makeGraphStore({ mode: "file", dir });

    const result = await store.persistConcept({ uuid: "test-uuid", kind: "cpms.concept" });
    expect(result.ok).toBe(true);

    const file = path.join(dir, "concepts.jsonl");
    const payload = fs.readFileSync(file, "utf-8").trim();
    expect(payload).toContain("\"test-uuid\"");
  });

  it("returns an error when ArangoHTTP responds with failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom"
    });
    const store = makeGraphStore({ mode: "arango", fetchImpl });
    const res = await store.persistConcept({ uuid: "test-uuid", kind: "cpms.concept" });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("HTTP 500");
  });
});
