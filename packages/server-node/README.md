# @lehelkovach/cpms-server-node

Fastify API for CPMS. Exposes the concept/pattern matching endpoints along with helpers for generating and validating schema payloads.

## Endpoints
- `GET /health` – liveness probe.
- `POST /cpms/match` – winner-take-all decision for a single concept.
- `POST /cpms/match_explain` – match plus explain trace.
- `POST /cpms/match_pattern` – greedy + repair assignment for a pattern.
- `GET /cpms/schema/concepts/language` – schema description + starter template.
- `POST /cpms/schema/concepts/template` – build a template from intent overrides.
- `POST /cpms/schema/concepts/persist` – lint + compile + persist a concept draft.
- `POST /cpms/concepts/draft` / `POST /cpms/patterns/draft` – helper endpoints for tool-calling.

Swagger UI is served at `/docs`.

## Install
```bash
npm install @lehelkovach/cpms-server-node
# or
pnpm add @lehelkovach/cpms-server-node
```

## Running locally
```bash
node src/server.js
# or
CPMS_API_PORT=8787 node src/server.js
```

Environment variables:
- `CPMS_API_HOST` / `CPMS_API_PORT` – bind address and port (default `0.0.0.0:8787`).
- `CPMS_GRAPH_STORE` – `file` (default) or `arango`.
- `ARANGO_URL`, `ARANGO_DB`, `ARANGO_COLLECTION`, `ARANGO_AUTH` – Arango graph settings.

## Publishing
Publish with npm:
```bash
npm publish --access public
```

Ensure `@lehelkovach/cpms-core` is published first so the dependency range `^0.1.0` resolves on npm.
