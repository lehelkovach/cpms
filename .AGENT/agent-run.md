# Agent Runbook

Persistent startup operations and standing checks for agents working in this repository.
Agents should read this file at the start of each run after reading `.AGENT/agent.md`.

## Recurring Startup Operations

1) Refresh Agent Context
	a) Read `.AGENT/agent.md`, `.AGENT/dev-notes.md`, `.AGENT/agent-run.md`,
	   `.AGENT/agent-run-once.md`, and the latest relevant entries in
	   `.AGENT/agent-action-log.md`.
	b) Check the current branch, upstream branch, and working tree before editing.
	c) Preserve existing user or agent work.

2) Process One-Shot Queue
	a) Review `.AGENT/agent-run-once.md` for active one-time operations.
	b) Complete active run-once items before unrelated work when safe.
	c) Remove completed items from `.AGENT/agent-run-once.md`.
	d) Append completed or blocked run-once results to `.AGENT/agent-action-log.md`.

3) CPMS Context Review
	a) For classification or agent-pivot work, read `docs/FORM_CLASSIFICATION_READINESS.md`,
	   `INTEGRATION_READY.md`, and the relevant tests before editing.
	b) For schema or matching work, read `docs/SCHEMA_LANGUAGE.md`,
	   `docs/OBSERVATION_MODEL.md`, and `docs/MATCHING_AND_CONFIDENCE.md`.
	c) For release work, confirm `dev` and `main` state, run the verification commands in
	   `.AGENT/agent.md`, and log the release/tag decision.

4) Prompt Feedback Loop
	a) If the maintainer gives a new standing instruction, persist it in the correct
	   `.AGENT/` file rather than leaving it only in chat context.
	b) Re-read `.AGENT/agent.md` after changing prompt instructions.
	c) Log prompt, runbook, and run-once changes in `.AGENT/agent-action-log.md`.

## Active Recurring Items

1) Maintain CPMS Agent Readiness
	a) Keep `.AGENT/agent.md` aligned with CPMS integration, branch, verification, and
	   release workflow.
	b) Keep the form-classification readiness doc aligned with `/cpms/detect_form` behavior.
	c) Keep shared `.AGENT/` state synced through `dev` and `main` when release work is
	   requested.
