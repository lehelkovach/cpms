import fs from "node:fs";
import path from "node:path";

export function makeStore({ dir }) {
  fs.mkdirSync(dir, { recursive: true });
  const file = (kind) => path.join(dir, `${kind}.jsonl`);

  function append(kind, obj) {
    fs.appendFileSync(file(kind), JSON.stringify(obj) + "\n", "utf-8");
  }

  function latestByUuid(kind, uuid) {
    const p = file(kind);
    if (!fs.existsSync(p)) return null;
    const lines = fs.readFileSync(p, "utf-8").trim().split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const row = JSON.parse(lines[i]);
      if (row.uuid === uuid) return row;
    }
    return null;
  }

  return { append, latestByUuid };
}
