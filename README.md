# CPMS — Concept / Prototype Memory Schema (JS prototype)

Author: **Lehel Kovach**  
GitHub: https://github.com/lehelkovach/cpms

This is a **pure JavaScript (ESM)** prototype repo:
- concept matching with explain traces
- naive pattern matching (greedy + repair)
- Fastify API + Swagger UI
- fixtures + end-to-end tests (login example)

## Install
```bash
pnpm install
pnpm gate
```

## Run API
```bash
pnpm dev:api
# Swagger UI: http://localhost:8787/docs
```

## Try pattern match
```bash
curl -s http://localhost:8787/cpms/match_pattern \
  -H 'content-type: application/json' \
  -d @examples/requests/login.pattern.request.concrete.json | jq
```

## Confidence policy (simple)
- accept if best.p >= min_conf AND margin >= min_margin
- ask user if !accepted OR best.p < confirm_threshold
