# CPMS — Concept / Prototype Memory Schema

Author: **Lehel Kovach** (GitHub: `@lehelkovach`)

CPMS is an **open-source** library + API for representing and matching **fuzzy “concept prototypes”** against observations (DOM/UI data), and composing those concepts into higher-level **patterns** (e.g., *login form*, *payment form*).

It’s built to be the **memory + schema + matching** component used by AI agents and automation systems. A separate “agent” project (Playwright/Selenium + OpenAI tool-calling) can use CPMS to:
- retrieve prototypes via vector search (RAG)
- match prototypes to new pages/screens
- ask for human feedback when confidence is low
- apply safe, versioned updates to improve future matching

> CPMS focuses on *schema + matching + update/versioning + persistence*.  
> Browser automation, credentials, and LLM prompting/execution are intentionally out-of-scope (belong in a separate agent repo).

---

## What problem CPMS solves

Web UIs and forms rarely look the same:
- labels change (“Email” vs “Email address” vs “Username”)
- DOM structure differs across sites
- accessibility attributes vary (`aria-label`, `autocomplete`, etc.)
- bots often need a fallback to vision/pixels

CPMS provides a way to model:
- **what a thing is** (a concept prototype)
- **how to recognize it** (signals / fuzzy + probabilistic scoring)
- **how concepts compose** (patterns like login/payment)
- **how to iteratively improve** (feedback → patch → new version)
- **how to store/query** this knowledge (file-backed now; graph DB later)

---

## Core ideas

### Concepts
A **Concept** represents a matchable prototype like:
- `concept:email@1.0.0`
- `concept:password@1.0.0`
- `concept:submit_login@1.0.0`

A concept contains:
- **signals** (rules / evidence) that score candidates
- a **decision policy** (winner-take-all, margins, thresholds)
- optional **embeddings** (stored and retrieved via the DB layer)

### Signals
Signals are allowlisted evaluator calls (safe, deterministic), such as:
- `dom.attr_in(autocomplete in ["email","username"])`
- `dom.text_contains_any(["email","username"])`
- `dom.role_is("button")`

Signals can be combined as:
- **fuzzy weights** (logit-style)
- **Bayesian evidence** (log-likelihood ratio style)
- and then calibrated to a probability-like `p`

### Observations
An **Observation** describes what you saw on a page/screen:
- candidate elements (inputs, buttons, etc.)
- features extracted from DOM and/or vision channels
- optional metadata like bounding boxes, xpaths, nearby text

CPMS does not scrape pages itself — it consumes normalized observations produced by an adapter (Playwright/Selenium/etc.) in a separate project.

### Patterns
A **Pattern** composes concepts into a higher-level template:
- `pattern:login@1.0.0` includes email + password + submit
- `pattern:payment@1.0.0` includes card + expiry + cvv + name + submit

Patterns are matched with greedy + repair assignment:
- produce a 1:1 mapping from concepts → candidate IDs
- provide trace output to explain decisions

### Procedures (planned)
A **Procedure** is a directed graph of steps that an agent can execute externally, for example:
- `NAVIGATE → SNAPSHOT → MATCH_PATTERN → FILL(email/password) → CLICK(submit) → VERIFY`

CPMS will store procedures as first-class graph objects so agents can:
- retrieve a procedure by semantic intent (embedding similarity)
- bind concept matches to step inputs (e.g., “fill the matched email field”)
- version and improve procedures via feedback

---

## Quick diagram: match → feedback → revision

```mermaid
flowchart LR
  U[User/Agent Goal] --> O[Observation<br/>(DOM + optional vision)]
  O --> M[CPMS Match<br/>Concept/Pattern]
  M -->|accepted| X[Executor (agent repo)<br/>fill/click/verify]
  M -->|low confidence| Q[Ask user for help]
  Q --> F[Feedback + Correction]
  X --> F
  F --> P[Patch (allowlisted ops)]
  P --> R[New Version<br/>concept/pattern@...-draft]
  R --> T[Regression Fixtures + Gate]
  T -->|pass| A[Promote to Active]
  T -->|fail| K[Keep draft + iterate]

Use cases
1) Form understanding for agents (DOM-first, vision optional)

An agent can:

snapshot a page (DOM + screenshot)

retrieve CPMS patterns via vector search (RAG)

match and assign fields/buttons

execute actions in a browser

verify outcome

store exemplar + feedback to improve prototypes

2) Building a durable ontology for UI interaction

CPMS objects map cleanly to a property graph model:

concepts, patterns, signals, exemplars/episodes, revisions

provenance and version history

embeddings for semantic retrieval

3) Semi-automated schema generation

If no prototype exists for a new domain:

start from a template (login/payment/etc.)

add synonyms/signals iteratively via feedback

keep versions and regressions stable over time

Monorepo layout

packages/core
Pure matching logic (concept scoring, explain traces, pattern matching).

packages/server-node
Fastify API exposing match, match_explain, match_pattern.

tools/e2e
End-to-end test runner (boots API, calls match endpoints).

examples/
JSON fixtures for observations, concepts, patterns, and sample requests.

docs/
Architecture notes (ADRs, future designs).

Install

Requirements:

Node.js 20+

pnpm

pnpm install
pnpm gate


pnpm gate runs:

unit tests

end-to-end tests (API boots + pattern match)

npm pack dry-runs for publishability

Run the API
pnpm dev:api


Health: http://localhost:8787/health

Swagger UI: http://localhost:8787/docs

Example: pattern match (login)
curl -s http://localhost:8787/cpms/match_pattern \
  -H 'content-type: application/json' \
  -d @examples/requests/login.pattern.request.concrete.json | jq


Expected output includes:

assigned: mapping of concept IDs → candidate IDs

trace: rankings + repairs + missing required concepts

Schema language + concept ingestion

LLM agents can call the following endpoints to build and persist fuzzy prototypes:

- `GET /cpms/schema/concepts/language` — describe the CPMS schema language and return a ready-to-edit template.
- `POST /cpms/schema/concepts/template` — pass an `intent` payload (labels, prototype_of, seed signals) to get a draft JSON object.
- `POST /cpms/schema/concepts/persist` — submit a fully-formed concept. The server validates it, runs the compiler (clamps weights + drops unknown evaluators), writes the draft to the local append-only store, and attempts to persist it to the configured graph backend (file JSONL by default or ArangoDB).

Example template request:

```bash
curl -s http://localhost:8787/cpms/schema/concepts/template \
  -H 'content-type: application/json' \
  -d '{"labels":["concept:email@1.0.1"],"prototype_of":"type:email_field"}'
```

Example persist request:

```bash
curl -s http://localhost:8787/cpms/schema/concepts/persist \
  -H 'content-type: application/json' \
  -d @concept.email.json
```

Graph persistence

`CPMS_GRAPH_STORE=file` (default) writes to `.cpms-graph/concepts.jsonl` in the repo. Set `CPMS_GRAPH_STORE=arango` to write to ArangoDB and configure:

- `ARANGO_URL` (e.g. `http://localhost:8529`)
- `ARANGO_DB` (defaults to `_system`)
- `ARANGO_COLLECTION` (defaults to `cpms_concepts`)
- `ARANGO_AUTH` (`user:password`, used for HTTP Basic auth)

Storage + ArangoDB (optional backend)

CPMS is designed to support a property-graph backend (recommended for versioning + provenance)
and vector search for prototype retrieval.

Suggested direction:

store Concepts/Patterns/Signals/Episodes/Revisions as graph documents + edges

store embeddings as vectors and query “nearest prototypes” for RAG

expose a DB API used by agents (separate repo) for memory and updates

Docker + ArangoDB compose files can live in this repo (dev-only), or in a separate cpms-stack repo if you prefer operational separation.

Documentation

- [docs/SCHEMA_LANGUAGE.md](docs/SCHEMA_LANGUAGE.md) — JSON schema language for Concepts, Patterns, and planned Procedures.
- [docs/OBSERVATION_MODEL.md](docs/OBSERVATION_MODEL.md) — DOM + vision observation contract supplied by automation adapters.
- [docs/MATCHING_AND_CONFIDENCE.md](docs/MATCHING_AND_CONFIDENCE.md) — scoring pipeline, thresholds, explain traces.
- [docs/PATCH_AND_VERSIONING.md](docs/PATCH_AND_VERSIONING.md) — roadmap for draft → patch → activation workflows.
- [docs/GRAPH_MODEL_ARANGODB.md](docs/GRAPH_MODEL_ARANGODB.md) — recommended Arango collections and edges.

Roadmap

Near-term:

Add “billing/payment” fixtures + tests

Add patch/update language with strict allowlists

Add versioning + provenance links

Add ArangoDB persistence adapter + seed primitives

Add vector retrieval endpoints (store/query embeddings)

Long-term:

Procedures as directed graphs (task workflows)

Dual-channel matching (DOM + vision) with a unified observation contract

Larger regression suite of tricky UI variants

License

MIT

Disclaimer

CPMS is a schema + matching library. If you build automation agents on top of it, ensure you have permission to interact with target sites and comply with applicable policies and terms of service.
