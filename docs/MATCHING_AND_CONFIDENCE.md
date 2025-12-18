# Matching & Confidence

CPMS uses a hybrid scoring and decision pipeline designed for fuzzy DOM/vision evidence. Concepts define signals (allow-listed evaluators) and a resolution section that controls how those signals translate into probabilities and winner-take-all assignments.

## Evaluators & signals

- **Evaluators**: deterministic functions such as `dom.attr_in`, `dom.text_contains_any`, `dom.role_is`, `dom.type_is`. They inspect the candidate’s DOM/vision payload.
- **Modes**:
  - `fuzzy`: additive weight applied to a logit accumulator. Positive weights push towards a match, negative weights penalize.
  - `bayes`: log-likelihood ratios (`llr_when_true`, `llr_when_false`) that accumulate Bayesian evidence.

During compilation (`compileConcept`), weights/LLRs are clamped to safe ranges and unknown evaluators are dropped with warnings.

## Scoring pipeline

1. **Signal evaluation**: Each signal emits a numeric contribution for every candidate.
2. **Hybrid logit aggregation**: `resolution.score_model` controls prior logits, epsilon, and calibration.
3. **Probability conversion**: Calibrated logits are converted to `p` via sigmoid.
4. **Decision policy**: `resolution.decision.policy` (currently `winner_take_all`) picks the top candidate if it exceeds configured thresholds:
   - `min_conf`: minimum probability required.
   - `min_margin`: minimum difference between top-1 and top-2.
   - `confirm_threshold`: optional higher bar for “auto-confirm” actions.

## Explain traces

`/cpms/match_explain` returns both the match result and a trace showing:

- Each candidate’s total score / probability.
- Signal-level contributions (e.g., “`ac` +3.0 from autocomplete match”).
- Threshold checks (e.g., “margin below 0.10 → require manual review”).

Explain traces are essential for debugging and for hybrid human-in-the-loop review when confidence is low.

## Pattern matching

Patterns orchestrate multiple concepts using `matchPatternGreedyRepair`:

1. Run concept matching for each included concept.
2. Greedily assign concepts to candidates, honoring `required` flags.
3. Attempt repairs when required slots are missing (e.g., substitute top remaining candidate).
4. Emit `{ assigned, trace }` payload used by agents to fill forms (login, payment, etc.).

Failures (missing required concepts, low confidence) should trigger human assistance or additional perception passes.
