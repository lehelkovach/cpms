import fs from "node:fs";
import path from "node:path";

export function makeStore({ dir }) {
  fs.mkdirSync(dir, { recursive: true });
  const file = (kind) => path.join(dir, `${kind}.jsonl`);

  function append(kind, obj) {
    fs.appendFileSync(file(kind), JSON.stringify(obj) + "\n", "utf-8");
  }

  function list(kind) {
    const p = file(kind);
    if (!fs.existsSync(p)) return [];
    const lines = fs.readFileSync(p, "utf-8").trim().split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  }

  function latestByUuid(kind, uuid) {
    for (const row of [...list(kind)].reverse()) {
      if (row.uuid === uuid) return row;
    }
    return null;
  }

  function latestById(kind, id) {
    for (const row of [...list(kind)].reverse()) {
      if (objectId(row, kind) === id || row.uuid === id) return row;
    }
    return null;
  }

  return { append, list, latestByUuid, latestById };
}

function objectId(row, kind) {
  if (kind === "concept") return row.concept_id ?? row.labels?.[0] ?? row.uuid ?? null;
  if (kind === "pattern") return row.pattern_id ?? row.labels?.[0] ?? row.uuid ?? null;
  return row.id ?? row.uuid ?? null;
}
