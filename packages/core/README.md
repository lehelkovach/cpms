# @lehelkovach/cpms-core

Pure JS matching logic:
- evaluator registry
- hybrid scoring (fuzzy logit + bayes LLR)
- explain traces
- greedy + repair pattern matching

## Install
```bash
npm install @lehelkovach/cpms-core
# or
pnpm add @lehelkovach/cpms-core
```

## Quick start
```js
import { matchConcept, matchPatternGreedyRepair } from "@lehelkovach/cpms-core";

const concept = {
  concept_id: "concept:email@1.0.0",
  signals: [
    { signal_id: "terms", evaluator: "dom.text_contains_any", params: { terms: ["email", "username"] }, mode: "fuzzy", weight: 1.2 }
  ],
  resolution: { score_model: { type: "hybrid_logit", prior_logit: -1, calibration: "sigmoid" }, decision: { policy: "winner_take_all", min_conf: 0.6, min_margin: 0.05 } }
};

const observation = { page_id: "fixture:login", candidates: [{ candidate_id: "cand_email", dom: { label_text: "Email" } }] };
const conceptResult = matchConcept(concept, observation);
// conceptResult.best.candidate_id === "cand_email"

// Patterns combine multiple concepts
const pattern = { pattern_id: "pattern:login@1.0.0", includes: [concept.concept_id], strategy: { type: "greedy_repair", top_k: 5, max_repairs: 5 } };
const patternResult = matchPatternGreedyRepair(pattern, [concept], observation);
// patternResult.assigned["concept:email@1.0.0"] === "cand_email"
```

## API surface
- `matchConcept`, `matchConceptExplain`, `matchPatternGreedyRepair`
- Schema helpers: `generateConceptDraft`, `generatePatternDraft`, `describeConceptSchemaLanguage`, `buildConceptSchemaTemplate`, `validateConceptSchema`, `compileConcept`
- Evaluators in `engine/evaluators` with allowlist in `schema/compiler`
