# CPMS Ready for osl-agent-prototype Integration

## ✅ Implementation Complete

CPMS has been updated with the high-level form detection API required by osl-agent-prototype. The agent can now integrate with CPMS for form pattern detection.

## What Was Implemented

### 1. High-Level Form Detection Endpoint
**Endpoint**: `POST /cpms/detect_form`

**Request Format**:
```json
{
  "html": "<html>...</html>",
  "screenshot_path": "/path/to/screenshot.png",  // optional
  "screenshot": "base64_encoded_image",           // optional (alternative to screenshot_path)
  "url": "https://example.com",                   // optional
  "dom_snapshot": {...},                          // optional
  "observation": {...}                            // optional (pre-built observation)
}
```

**Response Format** (matches agent expectations):
```json
{
  "form_type": "login",
  "fields": [
    {
      "type": "email",
      "selector": "input[type='email'], [name='email']",
      "xpath": "//*[@id='email']",
      "confidence": 0.95,
      "signals": {
        "concept_id": "concept:email@1.0.0",
        "candidate_id": "cand_0",
        "attributes": {...}
      }
    },
    {
      "type": "password",
      "selector": "input[type='password']",
      "xpath": "//*[@name='password']",
      "confidence": 0.98,
      "signals": {...}
    },
    {
      "type": "submit",
      "selector": "button[type='submit']",
      "xpath": "//button",
      "confidence": 0.90,
      "signals": {...}
    }
  ],
  "confidence": 0.90,
  "pattern_id": "pattern:login@1.0.0",
  "assigned": {
    "concept:email@1.0.0": "cand_0",
    "concept:password@1.0.0": "cand_1",
    "concept:submit_login@1.0.0": "cand_2"
  },
  "unassigned": []
}
```

### 2. Observation Builder
**File**: `packages/server-node/src/observationBuilder.js`

- Extracts form candidates (inputs, buttons) from HTML
- Builds CPMS observation format from HTML + screenshot
- Loads default login pattern and concepts from examples directory

### 3. Python Client Update
**File**: `python/cpms_client/src/cpms_client/__init__.py`

Added `detect_form()` method that matches the agent's expected interface:
```python
client.detect_form(
    html=html,
    screenshot_path="/path/to/screenshot.png",  # optional
    screenshot="base64_data",                   # optional
    url="https://example.com",                  # optional
    dom_snapshot={...},                         # optional
    observation={...}                           # optional
)
```

### 4. Agent Adapter Update
**File**: `osl-agent-prototype/src/personal_assistant/cpms_adapter.py`

Updated to prefer `detect_form()` method when available, with fallback to `match_pattern()` or simple detection.

## How to Use

### 1. Start CPMS Server
```bash
cd cpms
pnpm dev:api
```

Server runs on `http://localhost:8787` by default.

### 2. Configure Agent
Set environment variables in `osl-agent-prototype`:
```bash
CPMS_BASE_URL=http://localhost:8787
CPMS_TOKEN=your_token_here  # optional
```

### 3. Agent Integration
The agent's `cpms.detect_form` tool will automatically:
1. Call `CPMSAdapter.detect_form_pattern(html, screenshot_path)`
2. Which calls `client.detect_form()` on CPMS client
3. Returns pattern data with detected fields

## Testing

### Test CPMS Endpoint Directly
```bash
curl -X POST http://localhost:8787/cpms/detect_form \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<form><input type=\"email\" name=\"email\"/><input type=\"password\" name=\"password\"/><button type=\"submit\">Login</button></form>",
    "url": "https://example.com/login"
  }'
```

### Test from Agent
The agent can call:
```python
cpms.detect_form(
    html="<form>...</form>",
    screenshot_path="/path/to/screenshot.png"
)
```

## Current Limitations

1. **HTML Parsing**: Uses simple regex-based extraction. For production, consider using a proper HTML parser (e.g., jsdom, cheerio).

2. **Pattern Types**: Currently only supports login forms. Payment and other form types can be added by:
   - Adding pattern/concept files to `examples/patterns/` and `examples/concepts/`
   - Extending `loadDefaultLoginPattern()` to support multiple form types

3. **XPath Generation**: Simplified XPath generation. Full DOM tree traversal would provide more accurate XPaths.

4. **Screenshot Processing**: Screenshots are stored but not yet used for visual analysis. CPMS currently relies on DOM signals only.

## Next Steps (Optional Enhancements)

1. Add support for payment form patterns
2. Improve HTML parsing with proper DOM parser
3. Add visual analysis using screenshots
4. Add pattern storage/retrieval API
5. Add pattern learning from successful matches

## Files Modified

- `cpms/packages/server-node/src/app.js` - Added `/cpms/detect_form` endpoint
- `cpms/packages/server-node/src/observationBuilder.js` - New file for observation building
- `cpms/python/cpms_client/src/cpms_client/__init__.py` - Added `detect_form()` method
- `osl-agent-prototype/src/personal_assistant/cpms_adapter.py` - Updated to use `detect_form()`

## Status: ✅ READY FOR INTEGRATION

The CPMS API now provides the high-level form detection endpoint that osl-agent-prototype expects. The agent can integrate immediately.

