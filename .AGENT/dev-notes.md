# Agent Dev Notes

Development notes for future agent support files and agent infrastructure.

## CPMS Agent-Pivot Notes

1) Integration Boundary
	a) CPMS returns classifications, candidate assignments, selectors, confidence, and traces.
	b) The external agent project is responsible for browser/app snapshots, filling,
	   clicking, verification, credentials, and LLM orchestration.
	c) Keep any executor-specific prompt or credential handling out of CPMS unless it is only
	   documentation for the interface boundary.

2) Form Readiness State
	a) Login and payment detection are the built-in patterns for `/cpms/detect_form`.
	b) HTML and app-style snapshot inputs are covered by focused tests and live E2E smoke.
	c) Future real-world failures should become fixtures and regression tests in CPMS.
	d) Vision/OCR is still a future channel; do not imply screenshots are scored today.

3) Release Coordination
	a) `dev` is the integration branch; `main` is the release branch.
	b) Release tags should be created from `main` after `dev` has passed `pnpm gate` and the
	   Python client tests.
	c) If tests generate local JSONL store rows or pycache files, clean them before commit.

## Future Inter-Agent Communication

1) Communication Rules
	a) Define message formats before agents exchange task state.
	b) Include sender agent UUID, recipient or channel, timestamp, task scope, and expected
	   response behavior.
	c) Record durable decisions in `.AGENT/agent-action-log.md` rather than relying only on
	   transient bus messages.

2) Agentic Environment Variables
	a) `IAC_BUS_HOST`: Placeholder host or IP address for a future inter-agent communication
	   bus.
	b) `IAC_BUS_PORT`: Placeholder port for the future inter-agent communication bus.
	c) `AGENT_UUID`: Placeholder UUID registered for the current agent runtime.
	d) `AGENT_REPO_SLUG`: Placeholder repository owner/name value for agent registration.
	e) `AGENT_RUN_ID`: Placeholder run identifier for correlating logs and bus messages.

3) Registration Notes
	a) Future agents may register their UUID, capabilities, repository scope, and current
	   branch with an IAC bus when that service exists.
	b) Registration should never require committing secrets or machine-local credentials.
	c) Any required local-only values should be documented here as names and purpose, not as
	   live values.
