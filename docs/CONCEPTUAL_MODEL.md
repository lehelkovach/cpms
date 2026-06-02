# CPMS Conceptual Model

CPMS is the **Concept Prototype Matching System**: a prototype-based concept representation and matching schema/runtime. It is not the long-term memory or ontology layer. CPMS turns normalized observations into semantic match results with confidence, margins, and deterministic explanation traces.

## Canonical pipeline

```txt
Environment/UI/document/mobile app
  -> adapter extracts normalized observation
  -> CPMS matches observation to concept prototypes/patterns
  -> match result + trace
  -> agent planner/executor decides what to do
  -> feedback/exemplars/version patches stored in NoShogo/KSG or CPMS persistence backend
```

CPMS consumes observations produced by adapters. It does not drive browsers, submit forms, store credentials, bypass MFA/CAPTCHA, or require Playwright, Selenium, Appium, or a specific agent runtime.

## Terms

### Concept

The abstract semantic category being recognized, such as:

- `concept:login_identifier@1.0.0`
- `concept:password@1.0.0`
- `concept:submit_login@1.0.0`
- `concept:card_number@1.0.0`
- `concept:mfa_code_field@1.0.0`

### Prototype

The fuzzy representation of a concept. A prototype contains expected signals, weights, thresholds, negative evidence, relations, examples, and confidence policy. In the current JSON examples, this is represented by the concept object and its `signals` plus `resolution` sections.

### Observation

Normalized evidence extracted from a UI, document, mobile tree, or other adapter. A web observation usually contains candidates with DOM attributes, labels, ARIA names, nearby text, selectors, and optional vision metadata. Mobile observations can carry resource IDs, classes, content descriptions, bounds, and text.

### Candidate

A candidate is one matchable element or region in an observation: an input, button, select, upload widget, OCR-linked visual region, mobile view node, or similar target.

### SignalSpec

A deterministic, allowlisted evaluator call. Examples include `dom.attr_in`, `dom.text_contains_any`, `dom.input_type_is`, `a11y.name_contains_any`, and mobile/vision placeholder evaluators. Unknown evaluator names fail closed.

### MatchResult

The assignment output for a concept or pattern. Concept results include `score`, `p`, `margin`, `accepted`, `needs_confirmation`, `reason`, the best candidate, runner-up candidates, and a trace. Pattern results assign concept IDs to candidate IDs and report missing required concepts.

### Pattern

A composition of concepts into a higher-level structure, such as `pattern:login@1.0.0` or `pattern:payment@1.0.0`. Patterns define included concepts, required concepts, and assignment strategy.

### Exemplar

A reference observation/candidate pair used to explain or improve a prototype. Exemplars should not contain credentials or secrets. Human or agent feedback can link to exemplars as evidence for draft patches.

### Patch

An allowlisted change proposal against a concept or pattern version. Patches add synonyms, add signals, adjust weights within safe bounds, add negative evidence, add exemplar references, deprecate aliases, create draft versions, or promote drafts after regression tests pass.

### Version

A semver-scoped prototype or pattern revision. CPMS supports aliases and remapping metadata such as `deprecated_by`, `alias_of`, and `compatible_with` so old examples can resolve to current concept IDs.

## NoShogo/KSG integration boundary

NoShogo/KSG or another memory/ontology layer can store long-term graph state, provenance, exemplars, user corrections, and retrieval indexes. CPMS stays focused on recognition and emits graph-friendly events:

- `concept.matched`
- `pattern.matched`
- `feedback.received`
- `revision.created`
- `revision.promoted`

Recommended graph nodes include `Concept`, `PrototypeVersion`, `Signal`, `Pattern`, `Observation`, `Candidate`, `Exemplar`, `Feedback`, and `Revision`. Recommended edges include `CONCEPT_HAS_PROTOTYPE`, `PROTOTYPE_HAS_SIGNAL`, `PATTERN_INCLUDES_CONCEPT`, `OBSERVATION_HAS_CANDIDATE`, `CANDIDATE_MATCHED_CONCEPT`, `FEEDBACK_SUPPORTS_REVISION`, and `REVISION_SUPERSEDES_VERSION`.

The core package provides a no-op memory adapter and a NoShogo adapter stub so integrations can capture these events without making CPMS depend on a specific graph store.
