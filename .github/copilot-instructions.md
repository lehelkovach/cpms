# GitHub Copilot / Agent Instructions for CPMS

Purpose: give AI coding agents the minimum, high-value knowledge to be productive in this repo (endpoints, data shapes, tests, conventions, and examples).

## Quick facts
- Node >= 20, pnpm-managed monorepo (root `package.json` uses `pnpm`).
- Tests: `pnpm test` or `pnpm -r test` (uses `vitest` in packages).
- Gate: `pnpm gate` runs unit tests, end-to-end (`tools/e2e`), and `pack:check`.
- Local API: `pnpm dev:api` (starts server at http://localhost:8787 by default).

## How agents should interact (concrete endpoints)
- Match single concept: POST /cpms/match
  - Body: `{ "concept": <concept JSON>, "observation": <observation JSON> }`
- Explain / debug a match: POST /cpms/match_explain
  - Returns `explain` with per-signal trace (see `packages/core/src/engine/explain.js`).
- Match a pattern (greedy + repair algorithm): POST /cpms/match_pattern
  - Body: `{ "pattern": <pattern JSON>, "concepts": [<concepts>], "observation": <observation JSON> }`
- Schema language / generator (LLM-callable flows):
  - GET /cpms/schema/concepts/language — returns schema + template.
  - POST /cpms/schema/concepts/template — build a draft template for an intent.
  - POST /cpms/schema/concepts/persist — validate + store compiled concept (append-only + graph persist).
  - POST /cpms/patterns/draft and POST /cpms/concepts/draft — generator helpers.
- Promotion: POST /cpms/activate (promote latest uuid to `status: "active"`).
- API docs available at `/docs` (Swagger UI).

## Recommended agent workflow (from docs/LLM_AGENT_PROMPTS.md)
1. Do embedding-aware retrieval first (use repo embeddings / `llm_embedding_meta`). Prefer reuse when similarity >= 0.85.
2. If no close match, call `/cpms/schema/concepts/template` with an intent, fill signals, then `POST /cpms/schema/concepts/persist`.
3. Always include `llm_embedding_meta` in drafts (provider, model, version, dimensions) and populate `llm_embedding`.
4. Re-run `pnpm test` or `pnpm gate` for regression coverage when promoting drafts.

Example embedding metadata used in fixtures:
- `{ "provider": "openai", "model": "text-embedding-3-large", "version": "2024-05-01", "dimensions": 3072 }`

## Data & storage conventions (important)
- Persistent store: append-only JSONL files in `packages/server-node/data/` (see `makeStore` in `packages/server-node/src/store.js`).
- Graph store: default file-based store at `.cpms-graph/concepts.jsonl`. ArangoDB supported via env `CPMS_GRAPH_STORE=arango` and `ARANGO_*` env vars (see `packages/server-node/src/graphStore.js`).
- Observations are normalized input objects (DOM-first; examples in `examples/observations/*`). CPMS does not scrape — an agent adapter must supply observations.

## Evaluators & signals (allowlisted deterministic ops — copy the exact evaluator names)
- Known evaluators: `dom.attr_in`, `dom.text_contains_any`, `dom.role_is`, `dom.type_is`, `vision.ocr_nearby_contains`.
- See `packages/core/src/engine/evaluators.js` for parameter shapes and expected returns (0 or 1 scores).
- Signal modes:
  - `fuzzy` — uses `weight` and multiplies by `logit(raw)` (example: `dom.text_contains_any` with `weight`).
  - `bayes` — uses `llr_when_true` / `llr_when_false` (example: `dom.attr_in` signals in tests).

## Concept & resolution shape (important fields)
- `concept.signals`: array of `{ signal_id, applies_to, evaluator, params, mode, weight | llr_when_true, llr_when_false }`.
- `concept.resolution` contains `score_model` (e.g., `hybrid_logit` with `prior_logit`, `epsilon`, `calibration`) and `decision` (`min_conf`, `min_margin`, `confirm_threshold`).
- See examples in `packages/core/test/*.test.js` (e.g., `login_email.test.js`).

## Pattern matching behavior notes
- Algorithm: greedy ranking per-concept, then repair swaps/assignments (see `packages/core/src/engine/patternMatch.js`).
- Defaults: `top_k`=7, `max_repairs`=10. Repairs produce trace entries (`assign_free`, `swap`).
- Patterns can contain constraints like `required_concepts` — these are reported in the `trace.missing_required` value.

## Testing & E2E specifics (how CI runs things)
- Unit tests: `pnpm test` uses `vitest` in each package.
- E2E runner (`tools/e2e/run-e2e.mjs`) spawns the server directly via `node packages/server-node/src/server.js` (not `pnpm`), waits for `/health`, then hits endpoints (match_pattern, template, persist). Use `CPMS_API_HOST` and `CPMS_API_PORT` to direct the server in test environments.
- `pnpm gate` runs full gate: unit tests + `tools/e2e` + `pack:check`.

## Helpful files to reference when implementing or changing behavior
- High-level: `README.md`, `docs/SCHEMA_LANGUAGE.md`, `docs/OBSERVATION_MODEL.md`, `docs/LLM_AGENT_PROMPTS.md`.
- Core logic: `packages/core/src/engine/{explain.js,match.js,patternMatch.js,evaluators.js}`.
- API & persistence: `packages/server-node/src/{app.js,server.js,store.js,graphStore.js}`.
- Examples & tests: `examples/`, `packages/core/test/*.test.js`, `tools/e2e/run-e2e.mjs`.

## Do / Don't (short and specific)
- Do: Use generator endpoints (`/schema/concepts/template`) before drafting new prototypes; include `llm_embedding_meta`.
- Do: Prefer file-based graph store for local dev; set `CPMS_GRAPH_STORE=arango` only if Arango is available and `ARANGO_*` env vars are configured.
- Don't: Have agents modify runtime server code; use the provided endpoints and the generator/persist flow.
- Don't: Assume CPMS scrapes pages — it consumes *observations* supplied by an agent adapter.

---

If anything above is unclear or you'd like short runnable examples added (e.g., minimal curl + sample payloads for a new concept), say which area to expand and I will iterate. (I'll keep the file concise to remain actionable for agents.)