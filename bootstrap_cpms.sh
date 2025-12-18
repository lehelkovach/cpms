#!/usr/bin/env bash
set -euo pipefail

AUTHOR_NAME="Lehel Kovach"
AUTHOR_HANDLE="lehelkovach"
NPM_SCOPE="@lehelkovach"
REPO_NAME="cpms"
REPO_URL="https://github.com/${AUTHOR_HANDLE}/${REPO_NAME}"

mkdir -p \
  packages/{core,server-node} \
  packages/core/{src/{dsl,engine},test} \
  packages/server-node/{src,test} \
  tools/e2e \
  docs/adr \
  examples/{observations,concepts,patterns,requests}

# -------------------------
# Root workspace
# -------------------------
cat > pnpm-workspace.yaml <<'YAML'
packages:
  - "packages/*"
  - "tools/*"
YAML

cat > .npmrc <<'NPMRC'
strict-peer-dependencies=true
auto-install-peers=false
shared-workspace-lockfile=true
NPMRC

cat > .gitignore <<'TXT'
node_modules/
dist/
.DS_Store
.env
pnpm-debug.log
TXT

cat > LICENSE <<EOF
MIT License

Copyright (c) 2025 ${AUTHOR_NAME}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
EOF

cat > package.json <<EOF
{
  "name": "${REPO_NAME}-monorepo",
  "private": true,
  "author": "${AUTHOR_NAME}",
  "license": "MIT",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "test": "pnpm -r test",
    "pack:check": "pnpm -r pack:check",
    "dev:api": "pnpm -C packages/server-node dev",
    "test:e2e": "pnpm -C tools/e2e e2e",
    "gate": "pnpm test && pnpm test:e2e && pnpm pack:check"
  }
}
EOF

cat > README.md <<EOF
# CPMS — Concept / Prototype Memory Schema (JS prototype)

Author: **${AUTHOR_NAME}**  
GitHub: ${REPO_URL}

This is a **pure JavaScript (ESM)** prototype repo:
- concept matching with explain traces
- naive pattern matching (greedy + repair)
- Fastify API + Swagger UI
- fixtures + end-to-end tests (login example)

## Install
\`\`\`bash
pnpm install
pnpm gate
\`\`\`

## Run API
\`\`\`bash
pnpm dev:api
# Swagger UI: http://localhost:8787/docs
\`\`\`

## Try pattern match
\`\`\`bash
curl -s http://localhost:8787/cpms/match_pattern \\
  -H 'content-type: application/json' \\
  -d @examples/requests/login.pattern.request.concrete.json | jq
\`\`\`

## Confidence policy (simple)
- accept if best.p >= min_conf AND margin >= min_margin
- ask user if !accepted OR best.p < confirm_threshold
EOF

cat > docs/adr/0001-confidence-semantics.md <<EOF
# ADR 0001: Confidence semantics for CPMS matching

Date: 2025-12-16  
Status: Accepted  
Author: ${AUTHOR_NAME}

Decision gating uses **margin + min_conf**; UX uses **confirm_threshold**:
- accepted if best.p ≥ min_conf AND (best.p - runner_up.p) ≥ min_margin
- needs_user_confirmation if !accepted OR best.p < confirm_threshold (default 0.90)
EOF

# -------------------------
# packages/core (pure JS)
# -------------------------
cat > packages/core/package.json <<EOF
{
  "name": "${NPM_SCOPE}/cpms-core",
  "version": "0.1.0",
  "description": "CPMS core (pure JS): evaluators + hybrid scoring + explain traces + naive pattern matching.",
  "author": "${AUTHOR_NAME}",
  "license": "MIT",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js"
  },
  "files": ["src", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "test": "vitest run",
    "pack:check": "npm pack --dry-run"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
EOF

cat > packages/core/README.md <<EOF
# ${NPM_SCOPE}/cpms-core

Pure JS matching logic:
- evaluator registry
- hybrid scoring (fuzzy logit + bayes LLR)
- explain traces
- greedy + repair pattern matching
EOF

cat > packages/core/src/dsl/types.js <<'EOF'
// Lightweight “types” (JS doc shapes). Keep simple in v0.1.
export const RepKind = /** @type {const} */ ({
  DOM: "dom",
  VISION: "vision",
  TEXT: "text",
  HYBRID: "hybrid"
});

export const SignalMode = /** @type {const} */ ({
  FUZZY: "fuzzy",
  BAYES: "bayes"
});
EOF

cat > packages/core/src/engine/evaluators.js <<'EOF'
export class EvaluatorRegistry {
  constructor() { this.fns = new Map(); }
  /** @param {string} name @param {(candidate:any, params:any)=>number} fn */
  register(name, fn) { this.fns.set(name, fn); }
  eval(name, candidate, params) {
    const fn = this.fns.get(name);
    if (!fn) throw new Error(`Unknown evaluator: ${name}`);
    return fn(candidate, params);
  }
}

export const REGISTRY = new EvaluatorRegistry();

// DOM evaluators
REGISTRY.register("dom.attr_in", (cand, { attr, values }) => {
  const v = String(cand?.dom?.attrs?.[attr] ?? "").toLowerCase();
  const set = new Set((values ?? []).map(x => String(x).toLowerCase()));
  return v && set.has(v) ? 1 : 0;
});

REGISTRY.register("dom.text_contains_any", (cand, { terms }) => {
  const hay = [
    cand?.dom?.label_text,
    cand?.dom?.placeholder,
    cand?.dom?.aria_label,
    cand?.dom?.nearby_text,
    cand?.dom?.attrs?.name,
    cand?.dom?.attrs?.id
  ].filter(Boolean).join(" ").toLowerCase();
  return (terms ?? []).some(t => hay.includes(String(t).toLowerCase())) ? 1 : 0;
});

REGISTRY.register("dom.role_is", (cand, { role }) => {
  const r = String(cand?.dom?.role ?? "").toLowerCase();
  return r === String(role ?? "").toLowerCase() ? 1 : 0;
});

// Vision evaluator placeholder (expects OCR tokens pre-extracted)
REGISTRY.register("vision.ocr_nearby_contains", (cand, { terms }) => {
  const ocr = (cand?.vision?.ocr_nearby ?? []).join(" ").toLowerCase();
  return (terms ?? []).some(t => ocr.includes(String(t).toLowerCase())) ? 1 : 0;
});

export function evalSignal(sig, cand) {
  return REGISTRY.eval(sig.evaluator, cand, sig.params ?? {});
}
EOF

cat > packages/core/src/engine/scoring.js <<'EOF'
import { evalSignal } from "./evaluators.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p, eps) => {
  const pp = clamp(p, eps, 1 - eps);
  return Math.log(pp / (1 - pp));
};

/** Hybrid logit score, optionally sigmoid-calibrated */
export function scorePair(concept, cand) {
  const m = concept.resolution.score_model;
  const eps = m.epsilon ?? 1e-4;
  let L = m.prior_logit ?? 0;

  for (const sig of concept.signals ?? []) {
    const raw = clamp(evalSignal(sig, cand), 0, 1);
    const mode = sig.mode ?? "fuzzy";
    if (mode === "fuzzy") {
      const w = sig.weight ?? 1.0;
      L += w * logit(raw, eps);
    } else {
      L += raw >= 0.5 ? (sig.llr_when_true ?? 0) : (sig.llr_when_false ?? 0);
    }
  }
  return m.calibration === "none" ? L : sigmoid(L);
}
EOF

cat > packages/core/src/engine/decision.js <<'EOF'
export function winnerTakeAll(concept, scored) {
  const d = concept.resolution.decision ?? {};
  const min_conf = d.min_conf ?? 0;
  const min_margin = d.min_margin ?? 0;
  const confirm_threshold = d.confirm_threshold ?? 0.90;

  const sorted = [...scored].sort((a, b) => b.p - a.p);
  const best = sorted[0];
  const second = sorted[1];
  const margin = best && second ? best.p - second.p : (best ? best.p : 0);

  const accepted = !!best && best.p >= min_conf && margin >= min_margin;
  const needs_user_confirmation = !accepted || (best?.p ?? 0) < confirm_threshold;

  return {
    accepted,
    needs_user_confirmation,
    best: best ? { candidate_id: best.id, p: best.p } : null,
    runner_up: second ? { candidate_id: second.id, p: second.p } : null,
    margin,
    ranked: sorted
  };
}
EOF

cat > packages/core/src/engine/match.js <<'EOF'
import { scorePair } from "./scoring.js";
import { winnerTakeAll } from "./decision.js";

export function matchConcept(concept, obs) {
  const scored = (obs.candidates ?? []).map(c => ({ id: c.candidate_id, p: scorePair(concept, c) }));
  const policy = concept.resolution.decision?.policy ?? "winner_take_all";
  if (policy === "winner_take_all") return winnerTakeAll(concept, scored);
  const k = concept.resolution.decision?.top_k ?? 3;
  return scored.sort((a,b)=>b.p-a.p).slice(0, k);
}
EOF

cat > packages/core/src/engine/explain.js <<'EOF'
import { evalSignal } from "./evaluators.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p, eps) => {
  const pp = clamp(p, eps, 1 - eps);
  return Math.log(pp / (1 - pp));
};

export function matchConceptExplain(concept, obs) {
  const m = concept.resolution.score_model ?? {};
  const d = concept.resolution.decision ?? {};
  const eps = m.epsilon ?? 1e-4;
  const prior = m.prior_logit ?? 0;

  const traces = (obs.candidates ?? []).map((cand) => {
    let L = prior;
    const sigTraces = [];

    for (const sig of concept.signals ?? []) {
      const raw = clamp(evalSignal(sig, cand), 0, 1);
      const mode = sig.mode ?? "fuzzy";

      let contrib = 0;
      if (mode === "fuzzy") {
        const w = sig.weight ?? 1.0;
        contrib = w * logit(raw, eps);
      } else {
        contrib = raw >= 0.5 ? (sig.llr_when_true ?? 0) : (sig.llr_when_false ?? 0);
      }
      L += contrib;

      sigTraces.push({
        signal_id: sig.signal_id,
        evaluator: sig.evaluator,
        mode,
        raw,
        contribution: contrib
      });
    }

    const p = m.calibration === "none" ? L : sigmoid(L);
    return { candidate_id: cand.candidate_id, prior_logit: prior, total_logit: L, p, signals: sigTraces };
  });

  traces.sort((a, b) => b.p - a.p);
  const best = traces[0];
  const second = traces[1];
  const margin = best && second ? best.p - second.p : (best ? best.p : 0);

  const min_conf = d.min_conf ?? 0;
  const min_margin = d.min_margin ?? 0;
  const confirm_threshold = d.confirm_threshold ?? 0.90;

  const accepted = !!best && best.p >= min_conf && margin >= min_margin;
  const needs_user_confirmation = !accepted || (best?.p ?? 0) < confirm_threshold;

  return {
    concept_id: concept.concept_id,
    accepted,
    needs_user_confirmation,
    best: best ? { candidate_id: best.candidate_id, p: best.p } : undefined,
    runner_up: second ? { candidate_id: second.candidate_id, p: second.p } : undefined,
    margin,
    candidates: traces
  };
}
EOF

cat > packages/core/src/engine/patternMatch.js <<'EOF'
import { matchConceptExplain } from "./explain.js";

function topK(arr, k) {
  return [...arr].sort((a, b) => b.p - a.p).slice(0, k);
}

export function matchPatternGreedyRepair(pattern, concepts, obs) {
  const top_k = pattern.strategy?.top_k ?? 7;
  const max_repairs = pattern.strategy?.max_repairs ?? 10;

  const byId = new Map((concepts ?? []).map(c => [c.concept_id, c]));
  const conceptIds = pattern.includes ?? [];

  const rankings = conceptIds.map((cid) => {
    const c = byId.get(cid);
    if (!c) throw new Error(`Missing concept: ${cid}`);
    const ex = matchConceptExplain(c, obs);
    const ranked = topK(ex.candidates.map(x => ({ candidate_id: x.candidate_id, p: x.p })), top_k);
    const best = ranked[0];
    const second = ranked[1];
    const margin = best && second ? best.p - second.p : (best ? best.p : 0);
    return { concept_id: cid, ranked, bestP: best?.p ?? 0, margin, explain: ex };
  });

  rankings.sort((a, b) => (b.bestP - a.bestP) || (b.margin - a.margin));

  const assigned = {};
  const taken = new Set();

  const minConfOf = (cid) => (byId.get(cid)?.resolution?.decision?.min_conf ?? 0);

  for (const r of rankings) {
    const min_conf = minConfOf(r.concept_id);
    for (const x of r.ranked) {
      if (taken.has(x.candidate_id)) continue;
      if (x.p < min_conf) continue;
      assigned[r.concept_id] = x.candidate_id;
      taken.add(x.candidate_id);
      break;
    }
  }

  const repairTrace = [];
  let it = 0;

  const scoreOf = (cid, candId) => {
    const ex = rankings.find(rr => rr.concept_id === cid)?.explain;
    return ex?.candidates?.find(c => c.candidate_id === candId)?.p ?? 0;
  };

  while (it++ < max_repairs) {
    const unassigned = rankings.map(r => r.concept_id).filter(cid => !assigned[cid]);
    if (unassigned.length === 0) break;

    let changed = false;

    for (const cid of unassigned) {
      const r = rankings.find(rr => rr.concept_id === cid);
      if (!r) continue;

      const min_conf = minConfOf(cid);

      // free candidate
      const free = r.ranked.find(x => !taken.has(x.candidate_id) && x.p >= min_conf);
      if (free) {
        assigned[cid] = free.candidate_id;
        taken.add(free.candidate_id);
        repairTrace.push({ type: "assign_free", cid, cand: free.candidate_id, p: free.p });
        changed = true;
        continue;
      }

      // swap
      for (const wish of r.ranked) {
        const holder = Object.entries(assigned).find(([_, cnd]) => cnd === wish.candidate_id)?.[0];
        if (!holder) continue;

        const holderRank = rankings.find(rr => rr.concept_id === holder);
        if (!holderRank) continue;

        const holderMin = minConfOf(holder);
        const alt = holderRank.ranked.find(x => x.candidate_id !== wish.candidate_id && !taken.has(x.candidate_id) && x.p >= holderMin);
        if (!alt) continue;

        const current = scoreOf(holder, wish.candidate_id);
        const proposedHolder = scoreOf(holder, alt.candidate_id);
        const proposedThis = scoreOf(cid, wish.candidate_id);

        if (proposedThis + proposedHolder > current + 1e-4 && proposedThis >= min_conf) {
          assigned[holder] = alt.candidate_id;
          assigned[cid] = wish.candidate_id;
          taken.add(alt.candidate_id);
          repairTrace.push({ type: "swap", cid, takes: wish.candidate_id, holder, holder_to: alt.candidate_id });
          changed = true;
          break;
        }
      }
    }

    if (!changed) break;
  }

  const required = (pattern.constraints ?? [])
    .filter(c => c.type === "required_concepts")
    .flatMap(c => c.params?.ids ?? []);

  const missing_required = required.filter(cid => !assigned[cid]);
  const unassigned_final = rankings.map(r => r.concept_id).filter(cid => !assigned[cid]);

  return {
    pattern_id: pattern.pattern_id,
    assigned,
    unassigned: unassigned_final,
    trace: {
      rankings: rankings.map(r => ({ concept_id: r.concept_id, bestP: r.bestP, margin: r.margin, top: r.ranked })),
      repairs: repairTrace,
      missing_required
    }
  };
}
EOF

cat > packages/core/src/index.js <<'EOF'
export * from "./engine/evaluators.js";
export * from "./engine/scoring.js";
export * from "./engine/decision.js";
export * from "./engine/match.js";
export * from "./engine/explain.js";
export * from "./engine/patternMatch.js";
EOF

cat > packages/core/test/login_email.test.js <<'EOF'
import { describe, it, expect } from "vitest";
import { matchConceptExplain } from "../src/engine/explain.js";

const concept = {
  concept_id: "concept:email@1.0.0",
  concept_type: "type:email_field",
  signals: [
    { signal_id: "ac", applies_to: ["dom"], evaluator: "dom.attr_in",
      params: { attr: "autocomplete", values: ["email","username"] }, mode: "bayes", llr_when_true: 3, llr_when_false: 0 },
    { signal_id: "terms", applies_to: ["dom"], evaluator: "dom.text_contains_any",
      params: { terms: ["email","e-mail","username"] }, mode: "fuzzy", weight: 1.2 }
  ],
  resolution: {
    score_model: { type: "hybrid_logit", prior_logit: -1, epsilon: 1e-4, calibration: "sigmoid" },
    decision: { policy: "winner_take_all", min_conf: 0.75, min_margin: 0.10, confirm_threshold: 0.90 }
  }
};

const obs = {
  page_id: "fixture:login",
  candidates: [
    { candidate_id: "cand_email", dom: { attrs: { autocomplete: "email", name: "email" }, label_text: "Email" } },
    { candidate_id: "cand_pass", dom: { attrs: { autocomplete: "current-password", name: "password" }, label_text: "Password" } }
  ]
};

describe("matchConceptExplain(email)", () => {
  it("selects cand_email", () => {
    const ex = matchConceptExplain(concept, obs);
    expect(ex.best.candidate_id).toBe("cand_email");
  });
});
EOF

# -------------------------
# packages/server-node (pure JS)
# -------------------------
cat > packages/server-node/package.json <<EOF
{
  "name": "${NPM_SCOPE}/cpms-server-node",
  "version": "0.1.0",
  "description": "CPMS Node API (pure JS): match, match_explain, match_pattern.",
  "author": "${AUTHOR_NAME}",
  "license": "MIT",
  "type": "module",
  "main": "./src/server.js",
  "scripts": {
    "dev": "node src/server.js",
    "test": "vitest run",
    "pack:check": "npm pack --dry-run"
  },
  "dependencies": {
    "${NPM_SCOPE}/cpms-core": "workspace:*",
    "fastify": "^5.2.0",
    "@fastify/swagger": "^9.4.2",
    "@fastify/swagger-ui": "^5.2.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
EOF

cat > packages/server-node/src/server.js <<EOF
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { z } from "zod";
import { matchConcept, matchConceptExplain, matchPatternGreedyRepair } from "${NPM_SCOPE}/cpms-core";

const app = Fastify({ logger: true });

await app.register(swagger, { openapi: { info: { title: "CPMS API", version: "0.1.0" } } });
await app.register(swaggerUI, { routePrefix: "/docs" });

app.get("/health", async () => ({ ok: true }));

const MatchReq = z.object({ concept: z.any(), observation: z.any() });

app.post("/cpms/match", async (req, reply) => {
  const parsed = MatchReq.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
  const { concept, observation } = parsed.data;
  return { result: matchConcept(concept, observation) };
});

app.post("/cpms/match_explain", async (req, reply) => {
  const parsed = MatchReq.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
  const { concept, observation } = parsed.data;
  return { result: matchConcept(concept, observation), explain: matchConceptExplain(concept, observation) };
});

const MatchPatternReq = z.object({ pattern: z.any(), concepts: z.array(z.any()), observation: z.any() });

app.post("/cpms/match_pattern", async (req, reply) => {
  const parsed = MatchPatternReq.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.format() });
  const { pattern, concepts, observation } = parsed.data;
  return { result: matchPatternGreedyRepair(pattern, concepts, observation) };
});

await app.listen({ host: "0.0.0.0", port: 8787 });
EOF

cat > packages/server-node/test/smoke.test.js <<'EOF'
import { describe, it, expect } from "vitest";
describe("server-node", () => {
  it("smoke", () => expect(true).toBe(true));
});
EOF

# -------------------------
# Fixtures (login)
# -------------------------
cat > examples/observations/login.observation.json <<'EOF'
{
  "page_id": "fixture:login",
  "candidates": [
    { "candidate_id": "cand_email", "dom": { "attrs": { "autocomplete": "email", "name": "email", "id": "email" }, "label_text": "Email", "placeholder": "you@example.com" } },
    { "candidate_id": "cand_pass",  "dom": { "attrs": { "autocomplete": "current-password", "name": "password", "id": "password" }, "label_text": "Password", "placeholder": "••••••••" } },
    { "candidate_id": "cand_btn",   "dom": { "role": "button", "label_text": "Log in", "attrs": { "id": "loginBtn" } } }
  ]
}
EOF

cat > examples/concepts/login.email.json <<'EOF'
{
  "concept_id": "concept:email@1.0.0",
  "concept_type": "type:email_field",
  "signals": [
    { "signal_id": "ac", "applies_to": ["dom"], "evaluator": "dom.attr_in",
      "params": { "attr": "autocomplete", "values": ["email","username"] }, "mode": "bayes", "llr_when_true": 3.0, "llr_when_false": 0.0 },
    { "signal_id": "terms", "applies_to": ["dom"], "evaluator": "dom.text_contains_any",
      "params": { "terms": ["email","e-mail","username","user name","login"] }, "mode": "fuzzy", "weight": 1.2 }
  ],
  "resolution": {
    "score_model": { "type": "hybrid_logit", "prior_logit": -1.0, "epsilon": 0.0001, "calibration": "sigmoid" },
    "decision": { "policy": "winner_take_all", "min_conf": 0.75, "min_margin": 0.10, "confirm_threshold": 0.90 }
  }
}
EOF

cat > examples/concepts/login.password.json <<'EOF'
{
  "concept_id": "concept:password@1.0.0",
  "concept_type": "type:password_field",
  "signals": [
    { "signal_id": "ac", "applies_to": ["dom"], "evaluator": "dom.attr_in",
      "params": { "attr": "autocomplete", "values": ["current-password","new-password"] }, "mode": "bayes", "llr_when_true": 3.0, "llr_when_false": 0.0 },
    { "signal_id": "terms", "applies_to": ["dom"], "evaluator": "dom.text_contains_any",
      "params": { "terms": ["password","passcode","pwd"] }, "mode": "fuzzy", "weight": 1.2 }
  ],
  "resolution": {
    "score_model": { "type": "hybrid_logit", "prior_logit": -1.0, "epsilon": 0.0001, "calibration": "sigmoid" },
    "decision": { "policy": "winner_take_all", "min_conf": 0.75, "min_margin": 0.10, "confirm_threshold": 0.90 }
  }
}
EOF

cat > examples/concepts/login.submit.json <<'EOF'
{
  "concept_id": "concept:submit_login@1.0.0",
  "concept_type": "type:submit_button",
  "signals": [
    { "signal_id": "role", "applies_to": ["dom"], "evaluator": "dom.role_is",
      "params": { "role": "button" }, "mode": "fuzzy", "weight": 0.7 },
    { "signal_id": "terms", "applies_to": ["dom"], "evaluator": "dom.text_contains_any",
      "params": { "terms": ["log in","login","sign in","continue"] }, "mode": "fuzzy", "weight": 1.4 }
  ],
  "resolution": {
    "score_model": { "type": "hybrid_logit", "prior_logit": -0.8, "epsilon": 0.0001, "calibration": "sigmoid" },
    "decision": { "policy": "winner_take_all", "min_conf": 0.65, "min_margin": 0.10, "confirm_threshold": 0.90 }
  }
}
EOF

cat > examples/patterns/login.pattern.json <<'EOF'
{
  "pattern_id": "pattern:login@1.0.0",
  "includes": ["concept:email@1.0.0", "concept:password@1.0.0", "concept:submit_login@1.0.0"],
  "strategy": { "type": "greedy_repair", "top_k": 5, "max_repairs": 10 },
  "constraints": [
    { "type": "unique_per_scope", "params": { "scope": "page" } },
    { "type": "required_concepts", "params": { "ids": ["concept:email@1.0.0", "concept:password@1.0.0"] } }
  ]
}
EOF

cat > examples/requests/login.pattern.request.concrete.json <<'EOF'
{
  "pattern": {
    "pattern_id": "pattern:login@1.0.0",
    "includes": ["concept:email@1.0.0", "concept:password@1.0.0", "concept:submit_login@1.0.0"],
    "strategy": { "type": "greedy_repair", "top_k": 5, "max_repairs": 10 },
    "constraints": [
      { "type": "unique_per_scope", "params": { "scope": "page" } },
      { "type": "required_concepts", "params": { "ids": ["concept:email@1.0.0", "concept:password@1.0.0"] } }
    ]
  },
  "concepts": [
    {
      "concept_id": "concept:email@1.0.0",
      "concept_type": "type:email_field",
      "signals": [
        { "signal_id": "ac", "applies_to": ["dom"], "evaluator": "dom.attr_in",
          "params": { "attr": "autocomplete", "values": ["email","username"] }, "mode": "bayes", "llr_when_true": 3.0, "llr_when_false": 0.0 },
        { "signal_id": "terms", "applies_to": ["dom"], "evaluator": "dom.text_contains_any",
          "params": { "terms": ["email","e-mail","username","user name","login"] }, "mode": "fuzzy", "weight": 1.2 }
      ],
      "resolution": { "score_model": { "type": "hybrid_logit", "prior_logit": -1.0, "epsilon": 0.0001, "calibration": "sigmoid" },
        "decision": { "policy": "winner_take_all", "min_conf": 0.75, "min_margin": 0.10, "confirm_threshold": 0.90 } }
    },
    {
      "concept_id": "concept:password@1.0.0",
      "concept_type": "type:password_field",
      "signals": [
        { "signal_id": "ac", "applies_to": ["dom"], "evaluator": "dom.attr_in",
          "params": { "attr": "autocomplete", "values": ["current-password","new-password"] }, "mode": "bayes", "llr_when_true": 3.0, "llr_when_false": 0.0 },
        { "signal_id": "terms", "applies_to": ["dom"], "evaluator": "dom.text_contains_any",
          "params": { "terms": ["password","passcode","pwd"] }, "mode": "fuzzy", "weight": 1.2 }
      ],
      "resolution": { "score_model": { "type": "hybrid_logit", "prior_logit": -1.0, "epsilon": 0.0001, "calibration": "sigmoid" },
        "decision": { "policy": "winner_take_all", "min_conf": 0.75, "min_margin": 0.10, "confirm_threshold": 0.90 } }
    },
    {
      "concept_id": "concept:submit_login@1.0.0",
      "concept_type": "type:submit_button",
      "signals": [
        { "signal_id": "role", "applies_to": ["dom"], "evaluator": "dom.role_is", "params": { "role": "button" }, "mode": "fuzzy", "weight": 0.7 },
        { "signal_id": "terms", "applies_to": ["dom"], "evaluator": "dom.text_contains_any", "params": { "terms": ["log in","login","sign in","continue"] }, "mode": "fuzzy", "weight": 1.4 }
      ],
      "resolution": { "score_model": { "type": "hybrid_logit", "prior_logit": -0.8, "epsilon": 0.0001, "calibration": "sigmoid" },
        "decision": { "policy": "winner_take_all", "min_conf": 0.65, "min_margin": 0.10, "confirm_threshold": 0.90 } }
    }
  ],
  "observation": {
    "page_id": "fixture:login",
    "candidates": [
      { "candidate_id": "cand_email", "dom": { "attrs": { "autocomplete": "email", "name": "email", "id": "email" }, "label_text": "Email", "placeholder": "you@example.com" } },
      { "candidate_id": "cand_pass",  "dom": { "attrs": { "autocomplete": "current-password", "name": "password", "id": "password" }, "label_text": "Password", "placeholder": "••••••••" } },
      { "candidate_id": "cand_btn",   "dom": { "role": "button", "label_text": "Log in", "attrs": { "id": "loginBtn" } } }
    ]
  }
}
EOF

# -------------------------
# tools/e2e (boots API and calls match_pattern)
# -------------------------
cat > tools/e2e/package.json <<'EOF'
{
  "name": "cpms-e2e",
  "private": true,
  "type": "module",
  "scripts": { "e2e": "node run-e2e.mjs" },
  "dependencies": { "undici": "^6.21.0" }
}
EOF

cat > tools/e2e/run-e2e.mjs <<'EOF'
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { request } from "undici";

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const h = await request("http://localhost:8787/health");
      if (h.statusCode === 200) return true;
    } catch {}
    await wait(250);
  }
  return false;
}

async function main() {
  const proc = spawn("pnpm", ["-C", "packages/server-node", "dev"], { stdio: "inherit" });

  try {
    const ok = await waitForHealth();
    if (!ok) throw new Error("API did not become healthy");

    const payload = JSON.parse(readFileSync("examples/requests/login.pattern.request.concrete.json", "utf-8"));
    const res = await request("http://localhost:8787/cpms/match_pattern", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.statusCode !== 200) throw new Error(`match_pattern failed: ${res.statusCode}`);
    const body = await res.body.json();

    const assigned = body?.result?.assigned ?? {};
    if (assigned["concept:email@1.0.0"] !== "cand_email") throw new Error("email assignment incorrect");
    if (assigned["concept:password@1.0.0"] !== "cand_pass") throw new Error("password assignment incorrect");

    console.log("E2E OK:", assigned);
  } finally {
    proc.kill("SIGTERM");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
EOF

echo "✅ CPMS (pure JS) repo generated."
echo ""
echo "Next:"
echo "  pnpm install"
echo "  pnpm gate"
echo "  pnpm dev:api"
echo ""
echo "Then push to GitHub:"
echo "  git init && git add -A && git commit -m \"Initial CPMS JS prototype\""
echo "  git branch -M main"
echo "  git remote add origin git@github.com:${AUTHOR_HANDLE}/${REPO_NAME}.git"
echo "  git push -u origin main"

