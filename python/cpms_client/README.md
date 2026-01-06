# cpms-client (Python)

Lightweight Python wrapper around the CPMS HTTP API exposed by `@lehelkovach/cpms-server-node`.

## Install from PyPI
```bash
pip install cpms-client
```

## Install
This package uses `setuptools` (install `python -m pip install build` if you don't have `build` yet). Build/install locally from the repo root:
```bash
cd python/cpms_client
python -m build
pip install dist/cpms_client-0.1.1-py3-none-any.whl
```

## Usage
```python
from cpms_client import CpmsClient

client = CpmsClient(base_url="http://localhost:8787")

concept = {
    "concept_id": "concept:email@1.0.0",
    "signals": [
        {"signal_id": "terms", "evaluator": "dom.text_contains_any", "params": {"terms": ["email"]}, "mode": "fuzzy", "weight": 1.0}
    ],
    "resolution": {"score_model": {"type": "hybrid_logit", "prior_logit": -1.0, "calibration": "sigmoid"}}
}

observation = {"page_id": "fixture:login", "candidates": [{"candidate_id": "cand_email", "dom": {"label_text": "Email"}}]}

result = client.match(concept, observation)
print(result["result"]["best"])
```

## API helpers
- `match(concept, observation)`
- `match_explain(concept, observation)`
- `match_pattern(pattern, concepts, observation)`
- `detect_form(html, screenshot_path=None, screenshot=None, url=None, dom_snapshot=None, observation=None)` - High-level form detection endpoint
- `schema_language()`
- `concept_template(intent=None)`
- `persist_concept(concept)`
- `draft_concept(intent=None)`
- `draft_pattern(intent=None)`
- `activate(kind, uuid)`

All methods raise `RuntimeError` when the HTTP call fails (non-2xx or network issues).
