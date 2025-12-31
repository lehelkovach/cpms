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

  it("sends basic auth and returns document metadata on success", async () => {
    const originalEnv = { ...process.env };
    const restore = (key) => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    };

    try {
      process.env.ARANGO_AUTH = "user:pass";
      process.env.ARANGO_URL = "http://arango:8529";
      process.env.ARANGO_DB = "_system";
      process.env.ARANGO_COLLECTION = "cpms_concepts";

      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ _id: "cpms_concepts/123" })
      });
      const store = makeGraphStore({ mode: "arango", fetchImpl });
      const res = await store.persistConcept({ uuid: "test-uuid", kind: "cpms.concept" });

      expect(res.ok).toBe(true);
      expect(res.document._id).toBe("cpms_concepts/123");

      const [url, options] = fetchImpl.mock.calls[0];
      expect(url).toBe("http://arango:8529/_db/_system/_api/document/cpms_concepts");
      expect(options.headers.authorization).toMatch(/^Basic /);
    } finally {
      ["ARANGO_AUTH", "ARANGO_URL", "ARANGO_DB", "ARANGO_COLLECTION"].forEach(restore);
    }
  });
});
