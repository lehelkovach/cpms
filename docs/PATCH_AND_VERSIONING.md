# Patch & Versioning (Planned)

Versioned knowledge is critical for safe automation. CPMS already stores every concept/pattern draft in an append-only log (`packages/server-node/src/store.js`) and tags each record with a UUID + status. The next milestones expand this into a full patch + promotion workflow.

## Draft lifecycle (current)

1. **Generation**: Agents call `/cpms/schema/concepts/template` to obtain a base JSON object, fill in signals, then submit via `/cpms/schema/concepts/persist`.
2. **Compilation**: The server validates + clamps + stores the payload as a `draft`.
3. **Activation**: `/cpms/activate` promotes the most recent revision of a UUID by appending another row with `status: "active"` and timestamp.

## Planned enhancements

- **Patch language**: Restricted set of operations (`add_signal`, `update_weight`, `add_label`, etc.) for modifying drafts without re-sending the entire document. Patches will include provenance metadata (`who`, `why`, `confidence_delta`).
- **Review gates**: Drafts require minimum regression coverage before promotion (`pnpm gate` will run targeted suites).
- **Provenance graph**: Every draft/promotion edge is recorded in the graph backend, enabling “explain why this concept changed” queries.
- **Semantic diff tooling**: CLI + UI views that show signal-level differences, calibration changes, and expected impact on confidence.
- **Rollback hooks**: Rapidly revert to the last good revision if regression suites detect degradations.

These features will land alongside procedures and richer graph modeling. Track progress in `docs/GRAPH_MODEL_ARANGODB.md` and the roadmap section of `README.md`.
