# Observation Model

CPMS consumes normalized “observations” that describe what an agent saw on a page or screen. Observations are produced by Playwright/Selenium adapters (DOM-first, vision optional) and never scraped directly by CPMS.

```json
{
  "page_id": "fixture:login",
  "timestamp": "2024-11-23T22:05:00.000Z",
  "url": "https://example.com/login",
  "meta": { "viewport": { "width": 1280, "height": 720 } },
  "candidates": [
    {
      "candidate_id": "cand_email",
      "dom": {
        "role": "textbox",
        "type": "email",
        "attrs": {
          "autocomplete": "email",
          "name": "email",
          "aria-label": "Email address"
        },
        "label_text": "Email",
        "nearby_text": ["Email", "Forgot your password?"]
      },
      "vision": {
        "bbox": [100, 260, 360, 300],
        "confidence": 0.92,
        "ocr_tokens": ["Email", "address"]
      }
    },
    {
      "candidate_id": "cand_pass",
      "dom": {
        "role": "textbox",
        "type": "password",
        "attrs": {
          "autocomplete": "current-password",
          "name": "password"
        },
        "label_text": "Password"
      }
    },
    {
      "candidate_id": "cand_submit",
      "dom": {
        "role": "button",
        "type": "submit",
        "text": "Sign in"
      }
    }
  ]
}
```

### Key fields

- `page_id`: Durable identifier for regression fixtures and provenance.
- `candidates[]`: Flat list of elements/buttons/input controls. Each candidate bundles DOM-derived signals and optional vision metadata.
- `dom.attrs`: Arbitrary key-value map of HTML attributes (`id`, `name`, `aria-*`, `data-*`, `autocomplete`, etc.).
- `vision`: Optional data extracted from screenshots (bounding boxes, OCR text, classification scores). Vision signals can be incorporated later as evaluators become available.

### Producer responsibilities

1. Normalize selectors to `candidate_id` strings so match assignments can refer back to concrete DOM nodes.
2. Provide as much semantic detail as possible (roles, types, ARIA properties, nearby text). CPMS evaluators rely on these signals for scoring.
3. Include metadata useful for future learning (timestamps, URLs, viewport sizes, screenshot hashes).

### Consumer flow

1. Agents call `/cpms/match` or `/cpms/match_pattern`, passing the observation.
2. CPMS evaluates each concept’s signals against every candidate, producing scores + confidences.
3. For patterns, CPMS performs greedy assignment + repair so each required concept maps to one candidate ID.
4. Explain traces reference candidate IDs and signal contributions, making it easy to inspect failures or request human feedback.
