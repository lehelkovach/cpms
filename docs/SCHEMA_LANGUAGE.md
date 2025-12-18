# CPMS Schema Language

CPMS exposes a JSON schema language that lets LLM agents and tooling describe fuzzy “concept prototypes”, compose them into patterns, and (soon) procedures. The schema language is available via the API (`GET /cpms/schema/concepts/language`) and provides a ready-to-edit template for generation workflows (`POST /cpms/schema/concepts/template`).

## Concepts

Concepts capture a matchable prototype (e.g., `concept:email@1.0.0`). They describe the ontology type, signals/evidence, scoring policy, and provenance.

```json
{
  "kind": "cpms.concept",
  "uuid": "d2a74bf6-5df3-4792-b437-630663309b67",
  "version": "1.0.0",
  "labels": ["concept:email@1.0.0", "email field", "username input"],
  "prototype_of": "type:email_field",
  "extends": [],
  "signals": [
    {
      "signal_id": "ac",
      "description": "Autocomplete hints for email/username",
      "mode": "bayes",
      "evaluator": "dom.attr_in",
      "params": { "attr": "autocomplete", "values": ["email", "username"] },
      "llr_when_true": 3.0,
      "llr_when_false": 0.0
    },
    {
      "signal_id": "text",
      "mode": "fuzzy",
      "evaluator": "dom.text_contains_any",
      "params": { "terms": ["email", "e-mail", "username"] },
      "weight": 1.2
    }
  ],
  "resolution": {
    "score_model": { "type": "hybrid_logit", "prior_logit": -1.0, "calibration": "sigmoid", "epsilon": 1e-6 },
    "decision": { "policy": "winner_take_all", "min_conf": 0.75, "min_margin": 0.10, "confirm_threshold": 0.90 }
  },
  "llm_embedding": null,
  "status": "draft",
  "meta": { "source": "agent:bootstrap", "notes": "Seeded from login fixtures" }
}
```

Key rules:

- `labels[]` must be non-empty; the first entry is canonical and typically matches the concept ID.
- `prototype_of` points to an ontology/type (e.g., `type:password_field`, `type:submit_button`).
- Each signal references an allow-listed evaluator (`dom.attr_in`, `dom.text_contains_any`, `dom.role_is`, `dom.type_is` in v0.1.0). The compiler clamps weights / LLRs to safe ranges.
- Status tracks workflow state (`draft`, `active`, etc.). Drafts are stored append-only until promoted.

Use `POST /cpms/schema/concepts/persist` to validate + compile + persist a concept; the server writes to the local JSONL store and to the configured graph backend (file or ArangoDB).

## Patterns

Patterns are higher-level templates that include concept UUIDs, composition strategies, and constraints.

```json
{
  "kind": "cpms.pattern",
  "uuid": "0a6e8f0d-7ae0-4379-91df-59b95b9b86af",
  "version": "1.0.0",
  "labels": ["pattern:login@1.0.0"],
  "includes": [
    { "concept_uuid": "concept:email@1.0.0", "required": true },
    { "concept_uuid": "concept:password@1.0.0", "required": true },
    { "concept_uuid": "concept:submit_login@1.0.0", "required": true }
  ],
  "strategy": { "type": "greedy_repair", "top_k": 5, "max_repairs": 10 },
  "constraints": [
    { "type": "distinct_candidates", "concepts": ["concept:email@1.0.0", "concept:password@1.0.0"] }
  ],
  "status": "draft",
  "meta": { "source": "fixtures:login" }
}
```

Patterns can be generated with `generatePatternDraft(...)` and matched via `/cpms/match_pattern`.

## Procedures (planned)

Future versions will add a `cpms.procedure` kind to describe directed graphs of actions (`NAVIGATE`, `MATCH_PATTERN`, `FILL`, `CLICK`, `VERIFY`). Procedures will reference concepts/patterns, track versioned steps, and be persisted in the same graph backend for retrieval by automation agents.

Stay tuned for updates in `docs/PATCH_AND_VERSIONING.md` as the procedure DSL stabilizes.
