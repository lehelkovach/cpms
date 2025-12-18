import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

function defaultDir() {
  return path.resolve(process.cwd(), ".cpms-graph");
}

function encodeBasicAuth(value) {
  return Buffer.from(value, "utf-8").toString("base64");
}

function makeFileGraphStore({ dir = defaultDir() } = {}) {
  const conceptsPath = path.join(dir, "concepts.jsonl");

  return {
    async persistConcept(concept) {
      await fsp.mkdir(dir, { recursive: true });
      const row = { ...concept, persisted_at: new Date().toISOString(), store: "file" };
      await fsp.appendFile(conceptsPath, JSON.stringify(row) + "\n", "utf-8");
      return { ok: true, mode: "file", path: conceptsPath };
    }
  };
}

function makeArangoGraphStore({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation required for Arango graph store");
  }

  const url = process.env.ARANGO_URL ?? "http://localhost:8529";
  const db = process.env.ARANGO_DB ?? "_system";
  const collection = process.env.ARANGO_COLLECTION ?? "cpms_concepts";
  const auth = process.env.ARANGO_AUTH;

  const endpoint = `${url}/_db/${db}/_api/document/${collection}`;

  return {
    async persistConcept(concept) {
      try {
        const headers = { "content-type": "application/json" };
        if (auth) headers.authorization = `Basic ${encodeBasicAuth(auth)}`;
        const res = await fetchImpl(endpoint, { method: "POST", headers, body: JSON.stringify(concept) });
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, mode: "arango", error: `HTTP ${res.status}`, detail: text };
        }
        const data = await res.json();
        return { ok: true, mode: "arango", document: data };
      } catch (error) {
        return { ok: false, mode: "arango", error: error.message };
      }
    }
  };
}

export function makeGraphStore(options = {}) {
  const mode = (options.mode ?? process.env.CPMS_GRAPH_STORE ?? "file").toLowerCase();

  if (mode === "arango") {
    return makeArangoGraphStore(options);
  }

  const dir = options.dir ?? defaultDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return makeFileGraphStore({ dir });
}
