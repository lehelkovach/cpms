bash -euxo pipefail <<'BASH'
ROOT="$(pwd)"

# ---- 1) packages/core: generator + compiler (TS, nodenext-friendly exports) ----
mkdir -p packages/core/src/schema

cat > packages/core/src/schema/generator.ts <<'EOF'
import { randomUUID } from "node:crypto";

export type ConceptDraftInput = {
  labels: string[];
  prototype_of?: string;
  extends?: string[];
  version?: string;
  signals?: any[];
  resolution?: any;
  embedding?: any | null;
  meta?: Record<string, any>;
};

export type PatternDraftInput = {
  labels: string[];
  includes: string[];
  version?: string;
  strategy?: any;
  constraints?: any[];
  meta?: Record<string, any>;
};

export function generateConceptDraft(input: ConceptDraftInput) {
  const {
    labels,
    prototype_of,
    extends: extendsTypes = [],
    version = "0.1.0",
    signals = [],
    resolution,
    embedding = null,
    meta = {}
  } = input ?? ({} as any);

  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error("labels[] required");
  }

  return {
    kind: "cpms.concept",
    uuid: randomUUID(),
    version,
    labels,
    prototype_of: prototype_of ?? "type:unknown",
    extends: extendsTypes,
    signals,
    resolution: resolution ?? {
      score_model: { type: "hybrid_logit", prior_logit: -1.0, calibration: "sigmoid", epsilon: 1e-6 },
      decision: { policy: "winner_take_all", min_conf: 0.75, min_margin: 0.1, confirm_threshold: 0.9 }
    },
    llm_embedding: embedding,
    status: "draft",
    meta
  };
}

export function generatePatternDraft(input: PatternDraftInput) {
  const {
    labels,
    includes,
    version = "0.1.0",
    strategy,
    constraints = [],
    meta = {}
  } = input ?? ({} as any);

  if (!Array.isArray(labels) || labels.length === 0) throw new Error("labels[] required");
  if (!Array.isArray(includes) || includes.length === 0) throw new Error("includes[] required");

  return {
    kind: "cpms.pattern",
    uuid: randomUUID(),
    version,
    labels,
    includes,
    strategy: strategy ?? { type: "greedy_repair", top_k: 5, max_repairs: 10 },
    constraints,
    status: "draft",
    meta
  };
}
EOF

cat > packages/core/src/schema/compiler.ts <<'EOF'
const DEFAULT_RANGES = {
  weight: [-10, 10] as const,
  llr: [-20, 20] as const,
  prior_logit: [-10, 10] as const
};

// Expand this allowlist as you implement evaluators.
export const ALLOWED_EVALUATORS = new Set<string>([
  "dom.attr_in",
  "dom.text_contains_any",
  "dom.role_is",
  "dom.type_is"
]);

export function lintConcept(concept: any) {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!concept || concept.kind !== "cpms.concept") errors.push("kind must be cpms.concept");
  if (!concept?.uuid) errors.push("uuid missing");
  if (!Array.isArray(concept?.labels) || concept.labels.length === 0) errors.push("labels[] required");
  if (!concept?.resolution) warnings.push("resolution missing; defaults recommended");
  if (!Array.isArray(concept?.signals)) warnings.push("signals should be an array");

  for (const s of concept?.signals ?? []) {
    if (!s?.evaluator) warnings.push(`signal ${s?.signal_id ?? "?"} missing evaluator`);
    if (s?.evaluator && !ALLOWED_EVALUATORS.has(s.evaluator)) {
      warnings.push(`unknown evaluator '${s.evaluator}' (will be ignored by compiler)`);
    }
    if (s?.mode === "fuzzy" && typeof s.weight === "number" && !Number.isFinite(s.weight)) {
      warnings.push(`signal '${s.signal_id}' weight is not finite`);
    }
    if (s?.mode === "bayes") {
      for (const k of ["llr_when_true", "llr_when_false"]) {
        if (typeof s?.[k] === "number" && !Number.isFinite(s[k])) warnings.push(`signal '${s.signal_id}' ${k} not finite`);
      }
    }
  }

  return { warnings, errors };
}

export function compileConcept(concept: any) {
  const report = lintConcept(concept);
  const normalized = structuredClone(concept);

  const clamp = (v: number, [a, b]: readonly [number, number]) => Math.max(a, Math.min(b, v));

  if (normalized?.resolution?.score_model?.prior_logit != null) {
    const v = normalized.resolution.score_model.prior_logit;
    if (typeof v === "number" && Number.isFinite(v)) {
      normalized.resolution.score_model.prior_logit = clamp(v, DEFAULT_RANGES.prior_logit);
    }
  }

  const kept: any[] = [];
  const dropped: any[] = [];

  for (const s of normalized?.signals ?? []) {
    if (s?.evaluator && !ALLOWED_EVALUATORS.has(s.evaluator)) {
      dropped.push({ signal_id: s.signal_id ?? null, reason: "unknown_evaluator", evaluator: s.evaluator });
      continue;
    }
    if (s?.mode === "fuzzy" && typeof s.weight === "number" && Number.isFinite(s.weight)) {
      s.weight = clamp(s.weight, DEFAULT_RANGES.weight);
    }
    if (s?.mode === "bayes") {
      for (const k of ["llr_when_true", "llr_when_false"]) {
        if (typeof s?.[k] === "number" && Number.isFinite(s[k])) s[k] = clamp(s[k], DEFAULT_RANGES.llr);
      }
    }
    kept.push(s);
  }

  normalized.signals = kept;

  return { concept: normalized, report: { ...report, dropped_signals: dropped } };
}
EOF

# Export from packages/core/src/index.ts (nodenext style uses .js in TS exports)
node <<'NODE'
import fs from "node:fs";
const p = "packages/core/src/index.ts";
let s = fs.readFileSync(p, "utf-8");
const want = [
  'export * from "./schema/generator.js";',
  'export * from "./schema/compiler.js";'
];
for (const line of want) {
  if (!s.includes(line)) s += (s.endsWith("\n") ? "" : "\n") + line + "\n";
}
fs.writeFileSync(p, s, "utf-8");
NODE

# Ensure core tests build dist first so new exports exist
node <<'NODE'
import fs from "node:fs";
const p = "packages/core/package.json";
const j = JSON.parse(fs.readFileSync(p, "utf-8"));
j.scripts = j.scripts || {};
// Don't override if user already has pretest
if (!j.scripts.pretest) j.scripts.pretest = "pnpm build";
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf-8");
NODE

# Add core tests (JS; imports from built dist)
cat > packages/core/test/schema_generator.test.js <<'EOF'
import { describe, it, expect } from "vitest";
import { generateConceptDraft, generatePatternDraft, compileConcept } from "../dist/index.js";

describe("schema generator/compiler", () => {
  it("generates a concept draft with uuid + labels", () => {
    const c = generateConceptDraft({ labels: ["card number"], prototype_of: "type:card_number_field" });
    expect(typeof c.uuid).toBe("string");
    expect(c.labels[0]).toBe("card number");
    expect(c.status).toBe("draft");
  });

  it("compiler drops unknown evaluators but does not fail", () => {
    const c = generateConceptDraft({
      labels: ["email"],
      signals: [{ signal_id: "x", evaluator: "dom.not_real", mode: "fuzzy", weight: 999 }]
    });
    const out = compileConcept(c);
    expect(out.concept.signals.length).toBe(0);
    expect(out.report.dropped_signals.length).toBe(1);
  });

  it("generates a pattern draft", () => {
    const p = generatePatternDraft({ labels: ["login form"], includes: ["uuid-a", "uuid-b"] });
    expect(typeof p.uuid).toBe("string");
    expect(p.includes.length).toBe(2);
    expect(p.status).toBe("draft");
  });
});
EOF

# ---- 2) packages/server-node: store + routes (LLM-callable commands) ----
mkdir -p packages/server-node/src

cat > packages/server-node/src/store.js <<'EOF'
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
EOF

# Patch server.js to add imports + store + routes before listen()
node <<'NODE'
import fs from "node:fs";

const p = "packages/server-node/src/server.js";
let s = fs.readFileSync(p, "utf-8");

// Detect app variable name used with .listen(...)
let appName = "fastify";
const mListen = s.match(/(\w+)\.listen\s*\(/);
if (mListen) appName = mListen[1];

// Add imports if missing
const importCore = `import { generateConceptDraft, generatePatternDraft, compileConcept } from "@lehelkovach/cpms-core";`;
const importStore = `import { makeStore } from "./store.js";`;

if (!s.includes(importCore)) {
  // insert after last import
  const imports = [...s.matchAll(/^import .*$/gm)];
  if (imports.length) {
    const last = imports[imports.length - 1];
    const idx = last.index + last[0].length;
    s = s.slice(0, idx) + "\n" + importCore + "\n" + importStore + s.slice(idx);
  } else {
    s = importCore + "\n" + importStore + "\n" + s;
  }
} else if (!s.includes(importStore)) {
  const imports = [...s.matchAll(/^import .*$/gm)];
  const last = imports[imports.length - 1];
  const idx = last.index + last[0].length;
  s = s.slice(0, idx) + "\n" + importStore + s.slice(idx);
}

// Add store init near top (after app creation if found)
if (!s.includes("makeStore({")) {
  // Try to place after `const <appName> =` line
  const re = new RegExp(`^\\s*const\\s+${appName}\\s*=.*$`, "m");
  const mm = s.match(re);
  if (mm && mm.index != null) {
    const line = mm[0];
    const insertAt = mm.index + line.length;
    const storeInit = `\n\n// CPMS draft storage (file-backed v0)\nconst store = makeStore({ dir: new URL("../data/", import.meta.url).pathname });\n`;
    s = s.slice(0, insertAt) + storeInit + s.slice(insertAt);
  } else {
    // fallback: put near top after imports
    const imports = [...s.matchAll(/^import .*$/gm)];
    const idx = imports.length ? (imports[imports.length - 1].index + imports[imports.length - 1][0].length) : 0;
    const storeInit = `\n\n// CPMS draft storage (file-backed v0)\nconst store = makeStore({ dir: new URL("../data/", import.meta.url).pathname });\n`;
    s = s.slice(0, idx) + storeInit + s.slice(idx);
  }
}

// Add routes before listen call
if (!s.includes('/cpms/concepts/draft') && !s.includes("/cpms/concepts/draft")) {
  const routes = `\n\n// --- CPMS Schema Generator Commands (LLM-callable) ---\n${appName}.post("/cpms/concepts/draft", async (req, _reply) => {\n  const draft = generateConceptDraft(req.body);\n  const compiled = compileConcept(draft);\n  store.append("concept", compiled.concept);\n  return { ok: true, concept: compiled.concept, report: compiled.report };\n});\n\n${appName}.post("/cpms/patterns/draft", async (req, _reply) => {\n  const pattern = generatePatternDraft(req.body);\n  store.append("pattern", pattern);\n  return { ok: true, pattern };\n});\n\n${appName}.post("/cpms/activate", async (req, _reply) => {\n  const { kind, uuid } = req.body ?? {};\n  if (!kind || !uuid) return { ok: false, error: "kind + uuid required" };\n  const row = store.latestByUuid(kind, uuid);\n  if (!row) return { ok: false, error: "not found" };\n  const active = { ...row, status: "active", activated_at: new Date().toISOString() };\n  store.append(kind, active);\n  return { ok: true, active };\n});\n`;

  const idx = s.search(new RegExp(`\\b${appName}\\.listen\\s*\\(`));
  if (idx === -1) {
    // fallback: append at end
    s += routes;
  } else {
    s = s.slice(0, idx) + routes + s.slice(idx);
  }
}

fs.writeFileSync(p, s, "utf-8");
NODE

# ---- 3) Run gate (build+tests+e2e+pack) ----
pnpm gate
BASH

