# Graph Model (ArangoDB Draft)

CPMS favors a property-graph backend for provenance, retrieval, and composing higher-level automation procedures. The current server ships with a pluggable graph store (`CPMS_GRAPH_STORE=file|arango`). When set to `arango`, concepts are POSTed directly into the configured collection. This document sketches the recommended collections and edges.

## Collections

| Collection | Type | Description |
|------------|------|-------------|
| `cpms_concepts` | document | Canonical concept prototypes (one doc per UUID revision). |
| `cpms_patterns` | document | Pattern definitions referencing concept UUIDs. |
| `cpms_procedures` | document | (Future) Directed workflows referencing patterns + actions. |
| `cpms_signals` | document | Optional breakout of individual signals for analytics. |
| `cpms_feedback` | document | Episodes / human corrections tied to observations. |

## Edge collections

| Edge | From → To | Purpose |
|------|-----------|---------|
| `cpms_concept_extends` | `cpms_concepts` → `cpms_concepts` | inheritance / specialization. |
| `cpms_pattern_includes` | `cpms_patterns` → `cpms_concepts` | composition links. |
| `cpms_procedure_steps` | `cpms_procedures` → `cpms_patterns` / actions | workflow ordering. |
| `cpms_feedback_links` | `cpms_feedback` → `cpms_concepts`/`cpms_patterns` | attaches revisions to learning episodes. |
| `cpms_revision_history` | `cpms_concepts` → `cpms_concepts` | previous → next revision edges to support provenance queries. |

## Document schema (example)

```json
{
  "_key": "concept:email@1.0.1",
  "uuid": "concept:email",
  "version": "1.0.1",
  "status": "draft",
  "labels": ["concept:email@1.0.1", "email field"],
  "prototype_of": "type:email_field",
  "signals": [ /* ... */ ],
  "resolution": { /* ... */ },
  "meta": { "source": "agent:bootstrap", "notes": "LLM drafted" },
  "persisted_at": "2024-11-23T22:05:00.000Z"
}
```

The `_key` can mirror the versioned concept ID for readability. `uuid` tracks the durable identity so multiple versions can be connected via `cpms_revision_history`.

## Query patterns

- Retrieve active concepts for a pattern:

```aql
FOR v IN 1..1 OUTBOUND @patternId cpms_pattern_includes
  FILTER v.status == "active"
  RETURN v
```

- List lineage for a concept UUID:

```aql
FOR v, e IN OUTBOUND @conceptId cpms_revision_history
  RETURN { version: v.version, activated_at: v.activated_at, patch: e.patch_meta }
```

- Attach feedback to concept revisions:

```aql
INSERT { _from: @feedbackKey, _to: @conceptKey, outcome: "improved" } INTO cpms_feedback_links
```

## Operational notes

- Create collections/edges via Arango’s `_api/collection` endpoints or a migration script in this repo (planned).
- Configure the server with:
  - `CPMS_GRAPH_STORE=arango`
  - `ARANGO_URL`, `ARANGO_DB`, `ARANGO_COLLECTION`, `ARANGO_AUTH`
- For multi-collection writes, extend `packages/server-node/src/graphStore.js` to insert into `cpms_concepts`, `cpms_patterns`, etc., and to emit follow-up edge writes.

This document will evolve as procedures and patch/versioning land. Contributions welcome!
