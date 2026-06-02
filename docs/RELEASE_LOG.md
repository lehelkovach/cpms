# CPMS Release Log

## Unreleased - dev testing

Development focus: external-agent API polish for the next dev validation cycle.

### Added

- Agent-facing CRUD-style endpoints for concepts and patterns:
  - `GET /cpms/concepts`
  - `GET /cpms/concepts/:id`
  - `POST /cpms/concepts`
  - `PATCH /cpms/concepts/:id`
  - `GET /cpms/patterns`
  - `GET /cpms/patterns/:id`
  - `POST /cpms/patterns`
  - `PATCH /cpms/patterns/:id`
- Observation adapter endpoints:
  - `POST /cpms/observations/from_html`
  - `POST /cpms/observations/from_mobile_tree`
- Feedback and revision endpoints:
  - `POST /cpms/feedback`
  - `POST /cpms/revisions/promote`
- Python client parity methods for the new endpoints.
- Static mobile-tree observation normalization for Android/Appium-style view hierarchies.

### Testing

- Added server API tests for concept/pattern lifecycle endpoints, observation creation, feedback, and revision promotion.
- Added Python client tests for URL encoding and request payload shapes.

## v0.2.0 - 2026-06-02

Release focus: robust prototype language, login regression suite, and the memory-adapter boundary.

### Highlights

- Reframed CPMS publicly as the **Concept Prototype Matching System**: a prototype-based concept representation and matching schema/runtime, not the long-term memory/ontology layer itself.
- Added `docs/CONCEPTUAL_MODEL.md` to define Concept, Prototype, Observation, Candidate, SignalSpec, MatchResult, Pattern, Exemplar, Patch, Version, and NoShogo/KSG integration boundaries.
- Removed tracked generated artifacts and standardized on pnpm as the package-manager path.
- Added JSON Schema definitions for `ConceptPrototype`, `PatternPrototype`, `Observation`, `Candidate`, `SignalSpec`, `MatchResult`, `Patch`, and `VersionManifest`.
- Expanded the signal evaluator registry with allowlisted DOM, accessibility, mobile, placeholder vision, and placeholder semantic evaluators.
- Added signal normalization for casing, punctuation, whitespace, hyphens/underscores, and English synonym groups.
- Added deterministic explanation trace fields for matched/failed signals, weights, raw feature values, normalized feature values, and matched terms.
- Added concept ID alias/version remapping with `deprecated_by`, `alias_of`, and `compatible_with` support.
- Added `MemoryAdapter`, `NoopMemoryAdapter`, and `NoShogoMemoryAdapter` stubs so CPMS can emit graph-friendly events without becoming a memory system.
- Added an external-agent example flow: HTML snapshot -> observation -> login pattern match -> field assignments -> memory events.
- Expanded login detection regression coverage with five positive HTML variants and three negative false-positive fixtures.

### Verification

This release was verified on `main` with:

```bash
pnpm gate
PYTHONPATH=python/cpms_client/src python3 -m unittest discover -s python/cpms_client/tests
```

Both commands passed before tagging.

### Package versions

- `@lehelkovach/cpms-core`: `0.2.0`
- `@lehelkovach/cpms-server-node`: `0.2.0`
- `cpms_client`: `0.2.0`

### Compatibility notes

- Legacy evaluator names such as `dom.type_is` are normalized to canonical names such as `dom.input_type_is`.
- Unknown evaluators fail closed.
- CPMS remains independent of browser/mobile automation runtimes and does not store credentials or execute form submissions.
