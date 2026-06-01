# Agent Prompt

This file was created from `.AGENT/.agent-template.md`. The base-agent section is generic
across repositories; repository-specific CPMS directions begin below the repository-specific
heading.

Use this template to create `.AGENT/agent.md`. The base-agent section is intended to be
generic across repositories and can be customized after forking.

## Base-Agent Section

1) Mission
	a) Deliver small, reviewable improvements while preserving repository integrity.
	b) Read available context before acting, including `.AGENT/agent.md`, the README, and
	   any task-specific files.
	c) Make focused changes, verify them, and leave clear handoff notes.

2) Operating Loop
	a) Inspect repository state, branch, and current changes before editing.
	b) Identify the smallest safe change that satisfies the task.
	c) Use existing project conventions, tools, and file organization.
	d) Run targeted verification before broad or expensive checks.
	e) Update `.AGENT/agent-action-log.md` for meaningful setup, implementation,
	   verification, or handoff events.
	f) Commit and prepare work for review when the workflow or maintainer request requires
	   it.

3) Startup and Run Files
	a) At the start of a new agent run, read `.AGENT/agent.md`, `.AGENT/agent-run.md`,
	   `.AGENT/agent-run-once.md`, `.AGENT/dev-notes.md`, and the latest relevant entries
	   in `.AGENT/agent-action-log.md`.
	b) Treat `.AGENT/agent-run.md` as the persistent runbook for recurring startup
	   operations and standing checks.
	c) Treat `.AGENT/agent-run-once.md` as the one-shot queue for startup operations that
	   should run once and then be removed from that file.
	d) When a run-once item is completed, delete that item from `.AGENT/agent-run-once.md`,
	   then append the completed operation to `.AGENT/agent-action-log.md` with timestamp,
	   agent name, agent role, scope, result, verification, and follow-ups.
	e) If a run-once item cannot be completed, leave it in `.AGENT/agent-run-once.md` with
	   a short blocked note and append the blocker to the action log.
	f) Re-read `.AGENT/agent.md` after processing run-once items because those actions may
	   have updated the prompt or repository-specific directions.

4) Prompt Feedback Loop
	a) When a maintainer gives a new standing instruction, decide whether it belongs in
	   `.AGENT/agent.md`, `.AGENT/.agent-template.md`, `.AGENT/agent-run.md`,
	   `.AGENT/agent-run-once.md`, `.AGENT/dev-notes.md`, or only the current task notes.
	b) Add generic instructions that should apply to every fork to the base-agent section of
	   `.AGENT/.agent-template.md`, then mirror them into `.AGENT/agent.md`.
	c) Add repository-specific rules to `.AGENT/agent.md` below `#### Below:
	   Repository-Specific Directions` and keep them ordered by priority.
	d) Add recurring operational instructions to `.AGENT/agent-run.md`.
	e) Add one-time startup operations to `.AGENT/agent-run-once.md`.
	f) Log every prompt, runbook, or run-once change in `.AGENT/agent-action-log.md`.
	g) Prefer keeping shared `.AGENT/` state synced on `main`; use feature branches for
	   review or concurrent work when direct `main` updates could cause conflicts.

5) Agent Identity and Roles
	a) Identify yourself in action-log entries by agent name or tool, role, and branch.
	b) Use "master repo agent" for the primary agent coordinating repository-level prompt,
	   runbook, and synchronization changes.
	c) Use "worker sub-agent" for delegated agents working on narrower tasks.
	d) If multiple agents touch `.AGENT/` files, preserve each agent's log entries and avoid
	   overwriting another agent's queued work.

6) Repository Safety
	a) Preserve existing user work and never discard unrelated changes.
	b) Do not expose or commit secrets, credentials, tokens, or machine-specific
	   configuration.
	c) Avoid adding dependencies unless the task clearly requires them.
	d) Keep generated or boilerplate edits scoped to the requested files.
	e) Do not rewrite history or force push unless explicitly instructed.

7) Default Engineering Behavior
	a) Prefer repository-local patterns over new abstractions.
	b) Favor readable, maintainable code over cleverness.
	c) Add tests for behavior changes when a test framework exists.
	d) Explain skipped verification with the reason and residual risk.
	e) Escalate blockers with concrete evidence and suggested next steps.

8) Agent Action Log Usage
	a) Treat `.AGENT/agent-action-log.md` as the authoritative activity log for agent work.
	b) Add an entry for non-trivial setup, implementation, verification, migration,
	   permission, or handoff work.
	c) Keep entries in reverse chronological order.
	d) Update "Verification" from pending to actual commands or manual checks before
	   finishing a task.
	e) Record follow-ups as "None currently known" when there are no known gaps.
	f) Use this entry shape:

	   ```markdown
	   ## YYYY-MM-DD - Short title

	   1) Timestamp
	    a) YYYY-MM-DD HH:MM UTC
	   2) Agent
	   	a) <agent name or tool>
	   3) Role
	    a) <master repo agent, sub-agent, or other role>
	   4) Branch
	    a) <branch name>
	   5) Scope
	   	a) <files, subsystem, or issue>
	   6) Actions
	   	a) <what changed>
	   7) Verification
	   	a) <commands or manual checks>
	   8) Follow-ups
	   	a) <known gaps or none>
	   ```

9) Optional Prompt Command Library
	a) The commented blocks below work like default Linux config-file options.
	b) To activate an option, remove the surrounding `<!--` and `-->`, then edit the text
	   for the repository.
	c) Keep broadly reusable prompt commands in this base-agent section. Move project-only
	   variations to the repository-specific section below.

<!--
9.1) Optional: Add Diagnostic Logging
	a) Section Label: Logging
	b) Description: Ask the agent to add focused logs around changed control flow, errors,
	   and external boundaries.
	c) Prompt: Add useful logging throughout the touched code paths using the repository's
	   existing logging style. Keep logs structured where possible, avoid secrets or PII,
	   and include enough context to debug failures without noisy per-iteration spam.
-->

<!--
9.2) Optional: Add Test Coverage
	a) Section Label: Tests
	b) Description: Ask the agent to add or improve automated coverage for changed behavior.
	c) Prompt: Add targeted test coverage for new or changed behavior. Prefer existing test
	   frameworks, fixtures, and naming conventions. Include regression coverage for fixed
	   bugs and document any behavior that cannot be tested automatically.
-->

<!--
9.3) Optional: Strengthen Error Handling
	a) Section Label: Error Handling
	b) Description: Ask the agent to make failure modes clearer and safer.
	c) Prompt: Review touched code paths for unclear errors, swallowed exceptions, and weak
	   validation. Improve error messages and handling without hiding failures or adding
	   broad catch-all behavior.
-->

<!--
9.4) Optional: Update Human Documentation
	a) Section Label: Documentation
	b) Description: Ask the agent to update README, usage notes, or inline docs affected by
	   the change.
	c) Prompt: Update human-facing documentation for any changed setup, usage, commands,
	   configuration, or operational behavior. Keep documentation concise and aligned with
	   the implemented behavior.
-->

<!--
9.5) Optional: Run a Security Pass
	a) Section Label: Security
	b) Description: Ask the agent to inspect touched code for common security issues.
	c) Prompt: Review touched files for secret exposure, unsafe input handling, injection
	   risks, over-broad permissions, and insecure defaults. Fix issues in scope and list
	   any residual risks in the handoff.
-->

<!--
9.6) Optional: Reduce Technical Debt
	a) Section Label: Refactoring
	b) Description: Ask the agent to simplify nearby code when it directly supports the
	   requested change.
	c) Prompt: Simplify duplicated or confusing code encountered in the touched area when
	   it directly supports the task. Keep refactors small, behavior-preserving, and covered
	   by existing or added verification.
-->

10) Support Files
	a) Keep agent support files inside `.AGENT/`.
	b) Use `.AGENT/dev-notes.md` for future agent infrastructure notes, including
	   inter-agent communication rules and agentic environment variables.
	c) Keep root-level files minimal and easy to scan. Existing project docs, packages, and
	   tool directories remain valid when the target repository already uses them.

#### Below: Repository-Specific Directions

1) CPMS Mission and Boundaries
	a) CPMS is the Concept / Prototype Memory Schema: a library and Fastify API for fuzzy UI
	   concept matching, pattern matching, schema drafting, and persistence.
	b) CPMS is the classification and field-detection layer for external agents. It does not
	   execute browser, app, credential, or form-filling actions itself.
	c) The agent-project pivot should call `/cpms/detect_form` or the Python
	   `CpmsClient.detect_form()` method, then use returned `form_type`, `fields[]`,
	   selectors, confidence, and required coverage in its own executor.
	d) Treat `docs/FORM_CLASSIFICATION_READINESS.md`, `INTEGRATION_READY.md`, and
	   `READY_FOR_AGENT_INTEGRATION.md` as the primary integration context.

2) Highest Priority Operating Rules
	a) Preserve unrelated user or agent work. Never revert dirty files unless the maintainer
	   explicitly asks for that exact revert.
	b) Keep secrets, credentials, screenshots with sensitive data, and machine-local paths out
	   of commits.
	c) Read the relevant source, tests, examples, and docs before changing behavior.
	d) Prefer existing CPMS concepts, pattern fixtures, schema helpers, and test conventions
	   over introducing new abstractions.
	e) If a maintainer gives a standing process instruction, persist it in this `.AGENT/`
	   surface and log the change.

3) Branch, Integration, and Release Workflow
	a) `dev` is the integration branch. Create it from `main` if it does not exist.
	b) `main` is the release branch.
	c) Use focused `cursor/<descriptive-name>-a43b` feature branches for new implementation
	   work unless the maintainer explicitly requests direct branch integration.
	d) Before merging feature work into `dev`, commit and push the feature branch, then run
	   targeted tests when practical.
	e) After merging into `dev`, run the full verification gate plus Python client tests.
	f) Merge `dev` into `main` only after verification passes.
	g) Create release tags from `main`. If no tag is specified, choose the next CPMS release
	   tag by project convention and record the choice in the action log.
	h) Do not force push or rewrite public history unless the maintainer explicitly requests
	   it.

4) Repository Structure
	a) `packages/core` contains pure matching, scoring, evaluators, pattern matching, and
	   schema helpers.
	b) `packages/server-node` contains the Fastify API, observation builder, file/graph
	   stores, and server tests.
	c) `python/cpms_client` contains the Python HTTP client wrapper.
	d) `examples/` contains concepts, patterns, observations, and concrete request payloads.
	e) `tools/e2e` runs live API smoke tests; `tools/debug/detect-form.mjs` is the thin
	   live debug client for form classification.
	f) `docs/` contains human architecture, integration, and readiness plans.

5) Form Classification Context
	a) `/cpms/detect_form` accepts `html`, optional `dom_snapshot`, optional screenshot data,
	   or a prebuilt observation.
	b) Built-in detection currently compares login and payment patterns.
	c) HTML candidate extraction is parser-backed and should preserve labels, ARIA/data
	   attributes, roles, button text, submit inputs, and nearby text.
	d) App/native classification currently depends on lightweight DOM/accessibility snapshot
	   normalization or caller-provided observations.
	e) Screenshots can be attached to observations, but CPMS does not yet run OCR or vision
	   scoring in the server.
	f) Selector output is best-effort; the external filling agent should validate selectors
	   against a live DOM before action.

6) Verification Commands
	a) Install dependencies with `pnpm install` when needed.
	b) Unit tests: `pnpm test`.
	c) Live API E2E: `pnpm test:e2e`.
	d) Full gate: `pnpm gate`.
	e) Python client tests: `PYTHONPATH=python/cpms_client/src python3 -m unittest discover -s python/cpms_client/tests -v`.
	f) Agent boilerplate smoke: `python3 .AGENT/tests/agent_architecture_smoke.py`.
	g) Live form debug after starting the API: `pnpm debug:detect-form -- --html-file ./fixture.html`.
	h) E2E and persist tests may modify `.cpms-graph/concepts.jsonl` and
	   `packages/server-node/data/concept.jsonl`; clean generated artifacts before commit
	   unless the task intentionally updates fixtures.

7) Test Coverage Expectations
	a) Add focused regression coverage for behavior changes in the nearest package tests.
	b) For form-detection behavior, prefer API tests plus observation-builder tests and add
	   E2E smoke coverage for critical integration paths.
	c) Keep fixture additions minimal and explicit; prefer example concepts and patterns
	   where they exercise public behavior.
	d) Explain residual risks when tests cannot cover browser/app execution because CPMS is
	   not the executor.

8) Documentation and Handoff
	a) Update docs when endpoint behavior, release workflow, setup commands, or integration
	   expectations change.
	b) Log meaningful work in `.AGENT/agent-action-log.md` in reverse chronological order.
	c) Include branch, scope, actions, verification, and follow-ups in every action-log entry.
	d) Use `.AGENT/dev-notes.md` for future-facing agent infrastructure notes and known
	   coordination risks.
