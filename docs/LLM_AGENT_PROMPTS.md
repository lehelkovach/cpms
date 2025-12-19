# LLM Prompting Guide for CPMS

Large-language-model copilots (ChatGPT, o4-mini, etc.) can operate CPMS end-to-end as long as the prompt sets clear expectations: retrieve existing prototypes via vector search, reuse if confidence is high, fall back to the schema generator when gaps appear, and always persist drafts with provenance. Use the template below whenever you ask an LLM to reason about login/payment forms.

## System prompt skeleton

```
You are CPMS-SchemaBot, a JSON-only assistant that designs fuzzy DOM prototypes and patterns.
1. Always look up existing concepts/patterns via embedding similarity before drafting new ones.
2. When drafting, call CPMS generators:
   - POST /cpms/schema/concepts/template with intent → fill signals/resolution/embedding metadata.
   - POST /cpms/schema/concepts/persist with the completed concept.
   - POST /cpms/patterns/draft for higher-level compositions.
3. Require `llm_embedding_meta` with provider/model/version/dim for every concept so vector search remains consistent.
4. Output executable curl snippets plus short reasoning (<=2 sentences).
5. If a payment or login artifact already exists (similarity >= 0.85), reuse/extend it instead of creating duplicates.
```

## Embedding-aware retrieval flow

1. Build a natural-language description of the user goal, e.g., "payment form with card number, expiry, cvv, submit".
2. Generate a vector with the same embedding metadata used by stored documents (`llm_embedding_meta.version = 2024-05-01` for the included fixtures).
3. Query the store:
   - **File/JSONL**: read `.cpms-graph/concepts.jsonl`, compute cosine similarity locally.
   - **ArangoDB** (planned vector index): call a custom Foxx service or `_api/simple/all` endpoint that filters by `meta.prototype` and returns embeddings for scoring.
4. Return matching records (login + payment prototypes ship with this repo). If similarity is low, proceed to drafting.

## Drafting + persistence prompts

Example user instruction sent to ChatGPT after the system prompt above:

```
Task: ensure we have login + payment coverage.
1. Retrieve the most similar concepts/patterns for intents {"login": "email+password+submit"}, {"payment": "card name+number+expiry+cvv+pay"}.
2. If no record >=0.85 similarity, call /cpms/schema/concepts/template with those intents and craft signals (autocomplete, dom.text_contains_any, dom.type_is).
3. For each new draft, set llm_embedding_meta = {"provider":"openai","model":"text-embedding-3-large","version":"2024-05-01","dimensions":3072} and embed the serialized JSON to populate llm_embedding.
4. Persist via /cpms/schema/concepts/persist, then compose /cpms/patterns/draft payloads for login + payment.
5. Respond with curl commands and assigned page candidates based on observation fixtures.
```

The resulting assistant response should list:

- Matching concept IDs (if found via embedding search).
- curl snippets for generator/persist calls reused or newly created.
- Pattern drafts referencing login or payment concepts.
- Notes about any human review needed (e.g., low confidence signals).

## Fallback construction checklist

When the store cannot satisfy the request, instruct the LLM to:

1. Inspect the observation (see `examples/observations/login.observation.json` and `examples/observations/payment.observation.json`).
2. For every field/button:
   - Use `dom.attr_in` for autocomplete hints (`email`, `cc-number`, etc.).
   - Use `dom.text_contains_any` for labels/nearby text synonyms.
   - Use `dom.role_is`/`dom.type_is` for structural checks.
3. Combine the resulting concepts into a `pattern:login@1.0.0` or `pattern:payment@1.0.0` via `generatePatternDraft` (supply `labels` + `includes`).
4. Persist drafts, update embeddings, and re-run regression suites (`pnpm test` or `pnpm gate`).

Use this guide as the default reference when onboarding future LLM agents so they reuse embeddings, respect the schema language, and fall back to deterministic generator flows whenever RAG retrieval misses.
