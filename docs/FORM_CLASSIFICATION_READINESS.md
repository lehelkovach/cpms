# Form Classification Readiness Plan

This document captures the current readiness state for using CPMS as the HTML/app
form classification layer that feeds an external form-filling agent.

## Current scope

CPMS classifies form fields and returns selectors, confidence, and assignment
trace metadata. It does not execute browser or app filling actions; callers use
the returned `fields[]` to fill and submit forms in Playwright, Selenium, a
native automation bridge, or another executor.

The high-level endpoint is:

```http
POST /cpms/detect_form
```

Accepted inputs:

- `html`: page HTML or a form fragment.
- `dom_snapshot`: optional app/accessibility-tree style snapshot. This can be
  used without HTML for app-like classification when nodes expose roles, names,
  attrs, and/or children.
- `observation`: optional prebuilt CPMS observation for callers that already
  normalize UI candidates.

Current built-in form patterns:

- `pattern:login@1.0.0`
- `pattern:payment@1.0.0`

## Audit summary

The main readiness gaps were in the integration path rather than the core
matching engine:

1. `detect_form` only loaded the login pattern, so payment fixtures could not be
   classified through the public endpoint.
2. HTML extraction used regexes, which missed hyphenated attributes such as
   `aria-label`/`data-testid`, treated the tag name as an attribute, and did not
   model `input[type=submit]` as a button.
3. `dom_snapshot` was accepted by the API but not converted into candidates.
4. The named smoke test did not exercise a real smoke path.
5. E2E coverage skipped `/cpms/detect_form`.
6. The Python client had a `detect_form()` method but no payload test.

## Implemented readiness coverage

The test suite now covers:

- Parser-backed extraction of labels, hyphenated attributes, submit inputs, and
  app-style snapshots.
- API-level login detection from varied HTML.
- API-level payment detection by comparing built-in patterns.
- API-level app/snapshot detection without HTML.
- Core text evaluator behavior for button text and array `nearby_text`.
- E2E `/cpms/detect_form` smoke against a live server.
- Python client `detect_form()` payload construction.

## Live debug client

Run the API:

```bash
pnpm dev:api
```

Classify an HTML fixture:

```bash
pnpm debug:detect-form -- --html-file ./examples/forms/login.html
```

Classify an app/accessibility snapshot:

```bash
pnpm debug:detect-form -- --dom-snapshot ./snapshot.json --html ""
```

The client prints the raw JSON response so an agent integrator can inspect
`form_type`, `fields[].selector`, `fields[].confidence`, and required concept
coverage before wiring a fill action.

## Development plan for additional form types

1. Capture fixtures from real pages/apps:
   - HTML snippets for web forms.
   - Accessibility or DOM snapshots for app/native forms.
   - Expected field types and submit action.
2. Add or update concepts in `examples/concepts/`.
3. Add a pattern in `examples/patterns/` with required concepts that define
   when a form type is considered classified.
4. Register the pattern name in `loadDefaultPatterns()` for built-in detection.
5. Add API tests that classify at least one common and one variant fixture.
6. Add a live smoke case through `tools/debug/detect-form.mjs` or E2E if the
   form type is on a critical integration path.

## Remaining risks

- The built-in classifier is deterministic and pattern-based; novel form types
  still require concepts and patterns before they can be classified.
- Screenshots are stored on observations but no OCR/vision pipeline is run in
  the server.
- Selectors are best-effort and should be validated by the filling agent before
  action.
- Native app snapshots need a stable producer contract from the caller. CPMS now
  accepts common role/name/attrs/children shapes, but adapters should emit
  prebuilt observations for maximum control.
