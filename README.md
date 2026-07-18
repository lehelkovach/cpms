# CPMS — Concept Prototype Matching System

Author: **Lehel Kovach** (GitHub: `@lehelkovach`)

CPMS is an **open-source prototype-based concept representation and matching schema/runtime**. It represents concepts as weighted fuzzy prototypes, matches normalized observations (DOM/UI data first, mobile and vision contracts next), and composes concepts into higher-level **patterns** such as *login form* and *payment form*.

Historical aliases such as "Concept / Prototype Memory Schema" may appear in older notes. The public expansion is now **Concept Prototype Matching System**: CPMS is not long-term memory itself; it can persist drafts, versions, feedback, and graph-friendly events that a separate memory/ontology layer such as NoShogo/KSG can store.

---

## Current Development Status

**Version**: 0.2.0  
**Phase**: Beta - Robust prototype language and login regression suite  
**Last Updated**: 2026-06-02  
**Status**: ✅ Ready for agent-facing login/form recognition integration

### ✅ Implemented Features

#### API Endpoints
- ✅ `POST /cpms/match` - Match concept against observation
- ✅ `POST /cpms/match_explain` - Match with explanation trace
- ✅ `POST /cpms/match_pattern` - Match pattern (login, payment, etc.)
- ✅ `POST /cpms/detect_form` - **High-level form detection** (HTML + screenshot → pattern data)
- ✅ `GET /cpms/schema/concepts/language` - Schema language documentation
- ✅ `POST /cpms/schema/concepts/template` - Concept template generation
- ✅ `POST /cpms/schema/concepts/persist` - Persist concept
- ✅ `POST /cpms/concepts/draft` - Draft concept
- ✅ `POST /cpms/patterns/draft` - Draft pattern
- ✅ `POST /cpms/activate` - Activate concept/pattern

#### Python Client (cpms-client)
- ✅ `CpmsClient.match(concept, observation)` - Concept matching
- ✅ `CpmsClient.match_explain(concept, observation)` - Match with explanation
- ✅ `CpmsClient.match_pattern(pattern, concepts, observation)` - Pattern matching
- ✅ `CpmsClient.detect_form(html, screenshot_path=None, ...)` - **Form detection** (matches agent interface)
- ✅ `CpmsClient.schema_language()` - Get schema language docs
- ✅ `CpmsClient.concept_template(intent)` - Generate concept template
- ✅ `CpmsClient.persist_concept(concept)` - Persist concept
- ✅ `CpmsClient.draft_concept(intent)` - Draft concept
- ✅ `CpmsClient.draft_pattern(intent)` - Draft pattern
- ✅ `CpmsClient.activate(kind, uuid)` - Activate object

#### Core Functionality
- ✅ Concept matching with fuzzy signals
- ✅ Pattern matching (login forms)
- ✅ Observation building from HTML
- ✅ Signal extraction (DOM attributes, text, roles)
- ✅ Confidence scoring and explanation traces
- ✅ Default login pattern/concepts included

### ⏳ In Progress

- Pattern storage/retrieval API (CRUD operations)
- Payment form pattern support
- Improved HTML parsing (proper DOM parser)
- Visual analysis using screenshots

### 📋 Planned Features

#### Short-term
- Pattern listing endpoint (`GET /api/patterns`)
- Pattern versioning
- Pattern update/delete endpoints
- Payment form patterns
- Better XPath generation

#### Medium-term
- Visual analysis from screenshots
- Pattern learning from successful matches
- Pattern generalization
- ArangoDB persistence adapter
- Vector retrieval endpoints (embeddings)

#### Long-term
- Procedures as directed graphs (task workflows)
- Dual-channel matching (DOM + vision)
- Larger regression suite of UI variants
- Pattern taxonomy building

### 🔗 Integrations

#### osl-agent-prototype
- **Status**: ✅ Ready for integration
- **Version**: Requires cpms-client >=0.2.0
- **Features Used**: `detect_form()`, pattern matching
- **Integration Docs**: See `INTEGRATION_READY.md` and `READY_FOR_AGENT_INTEGRATION.md`
- **Issues**: None known

---

It’s built to be the **schema + matching + explanation** component used by AI agents and automation systems. A separate “agent” project (Playwright/Selenium/Appium + tool-calling) can use CPMS to:
- retrieve prototypes via CPMS persistence or a separate vector/ontology store
- match prototypes to new pages/screens
- ask for human feedback when confidence is low
- apply safe, versioned updates to improve future matching

> CPMS focuses on *prototype schema + matching + explanation + update/versioning semantics*.  
> Browser automation, credentials, and LLM prompting/execution are intentionally out-of-scope (belong in a separate agent repo).

---

## Documentation

- **Agent operating prompt/runbook**: startup context, release workflow, and development log for coding agents
  - [.AGENT/agent.md](.AGENT/agent.md)
  - [.AGENT/.agent-template.md](.AGENT/.agent-template.md)
  - [.AGENT/agent-run.md](.AGENT/agent-run.md)
  - [.AGENT/agent-run-once.md](.AGENT/agent-run-once.md)
  - [.AGENT/agent-action-log.md](.AGENT/agent-action-log.md)
- **Form classification readiness**: current `/cpms/detect_form` scope, coverage, debug client, and extension plan
  - [docs/FORM_CLASSIFICATION_READINESS.md](docs/FORM_CLASSIFICATION_READINESS.md)
- **Conceptual model**: CPMS terminology, boundaries, and NoShogo/KSG integration
  - [docs/CONCEPTUAL_MODEL.md](docs/CONCEPTUAL_MODEL.md)
- **Release log**: tested release notes and verification history
  - [docs/RELEASE_LOG.md](docs/RELEASE_LOG.md)
- **Schema language (JSON)**: how to define Concepts, Patterns, and (planned) Procedures  
  - [docs/SCHEMA_LANGUAGE.md](docs/SCHEMA_LANGUAGE.md)
- **Observation model**: how to represent DOM + vision candidates for matching  
  - [docs/OBSERVATION_MODEL.md](docs/OBSERVATION_MODEL.md)
- **Matching + confidence**: scoring, explain traces, winner-take-all, thresholds  
  - [docs/MATCHING_AND_CONFIDENCE.md](docs/MATCHING_AND_CONFIDENCE.md)
- **Updates + versioning (planned)**: patches, drafts, promotion, provenance  
  - [docs/PATCH_AND_VERSIONING.md](docs/PATCH_AND_VERSIONING.md)
- **Graph model (ArangoDB) (draft)**: recommended property-graph collections and edges  
  - [docs/GRAPH_MODEL_ARANGODB.md](docs/GRAPH_MODEL_ARANGODB.md)


## What problem CPMS solves

Web UIs and forms rarely look the same:
- labels change (“Email” vs “Email address” vs “Username”)
- DOM structure differs across sites
- accessibility attributes vary (`aria-label`, `autocomplete`, etc.)
- bots often need a fallback to vision/pixels

CPMS provides a way to model:
- **what a thing is** (a concept)
- **how to recognize it** (a fuzzy prototype with signals / probabilistic scoring)
- **how concepts compose** (patterns like login/payment)
- **how to iteratively improve** (feedback → patch → new version)
- **how to emit/store/query metadata** through persistence adapters and external memory/ontology systems

---

## Core ideas

### Concepts and prototypes
A **Concept** is the semantic category being recognized, for example:
- `concept:email@1.0.0`
- `concept:password@1.0.0`
- `concept:submit_login@1.0.0`

A **Prototype** is the fuzzy representation of that concept. In CPMS, a prototype contains:
- **signals** (rules / evidence) that score candidates
- a **decision policy** (winner-take-all, margins, thresholds)
- optional **embeddings** and provenance metadata for retrieval systems

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

Future CPMS persistence can describe procedures as graph-addressable objects so agents can:
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
```

## Use cases
1) Form understanding for agents (DOM-first, vision optional)

An agent can:

snapshot a page (DOM + screenshot)

retrieve CPMS patterns via CPMS persistence or an external vector/ontology layer

match and assign fields/buttons

execute actions in a browser

verify outcome

store exemplar + feedback to improve prototypes

2) Building a durable ontology for UI interaction

CPMS objects map cleanly to a property graph or memory/ontology model:

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

Storage + memory/ontology integration

CPMS is designed to support persistence adapters and graph-friendly events for versioning, provenance,
and prototype retrieval without becoming the full memory/ontology layer.

Suggested direction:

store Concepts/Patterns/Signals/Episodes/Revisions as graph documents + edges

store embeddings as vectors and query “nearest prototypes” for RAG

expose integration hooks used by agents and external memory systems for feedback and updates

Docker + ArangoDB compose files can live in this repo (dev-only), or in a separate cpms-stack repo if you prefer operational separation.

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