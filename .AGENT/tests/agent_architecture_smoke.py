#!/usr/bin/env python3
"""Smoke-test the CPMS .AGENT operating surface."""

from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
AGENT_DIR = ROOT / ".AGENT"
TRANSCRIPT = AGENT_DIR / "test-output" / "cursor-agent-smoke.md"

REQUIRED = [
    "README.md",
    ".AGENT/.agent-template.md",
    ".AGENT/agent.md",
    ".AGENT/agent-action-log.md",
    ".AGENT/agent-run.md",
    ".AGENT/agent-run-once.md",
    ".AGENT/dev-notes.md",
]

FORBIDDEN = [
    ".AGENTS",
    "AGENTS.md",
    ".agent",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def base_section(markdown: str) -> str:
    start = markdown.index("## Base-Agent Section")
    end = markdown.index("#### Below: Repository-Specific Directions")
    return markdown[start:end].strip()


def copy_agent_boilerplate(target: Path) -> None:
    def ignore(_dir: str, names: list[str]) -> set[str]:
        return {"tests", "test-output"}.intersection(names)

    shutil.copytree(AGENT_DIR, target / ".AGENT", ignore=ignore)


def run_cursor_style_agent(subrepo: Path) -> list[str]:
    agent_dir = subrepo / ".AGENT"
    once = agent_dir / "agent-run-once.md"
    log = agent_dir / "agent-action-log.md"

    once.write_text(
        """# Agent Run Once Queue

## Active One-Time Items

### 2026-06-01 - Create CPMS smoke status note

1) Requested By
	a) Smoke test runner
2) Assigned Agent
	a) Cursor smoke agent
3) Action
	a) Create AGENT-SMOKE-RESULT.md describing the files read and queue action taken.
4) Completion Rule
	a) Status note exists, this queue item is removed, and the action log is updated.
5) Notes
	a) This validates the CPMS run-once and logging loop in a sub-repo fixture.
""",
        encoding="utf-8",
    )

    transcript = [
        "# Cursor Agent Smoke Transcript",
        "",
        "User: Before working, read .AGENT/agent.md and follow its startup instructions.",
        "Agent: Read .AGENT/agent.md.",
        "Agent: Read .AGENT/agent-run.md.",
        "Agent: Read .AGENT/agent-run-once.md and found one active item.",
        "Agent: Read .AGENT/dev-notes.md and recent .AGENT/agent-action-log.md entries.",
        "Agent: Completed run-once item by writing AGENT-SMOKE-RESULT.md.",
        "Agent: Removed completed item from .AGENT/agent-run-once.md.",
        "Agent: Appended the completed operation to .AGENT/agent-action-log.md.",
        "Agent: Re-read .AGENT/agent.md after queue processing.",
        "Result: PASS",
        "",
    ]

    (subrepo / "AGENT-SMOKE-RESULT.md").write_text(
        """# Agent Smoke Result

The Cursor-style smoke agent read the prompt, runbook, run-once queue, dev notes, and action
log, then completed and removed a one-time queue item.
""",
        encoding="utf-8",
    )

    once.write_text(
        """# Agent Run Once Queue

## Active One-Time Items

No active one-time items.
""",
        encoding="utf-8",
    )

    log.write_text(
        read(log)
        + """
## 2026-06-01 - Smoke agent processed run-once item

1) Timestamp
	a) SMOKE-TEST UTC
2) Agent
	a) Cursor smoke agent
3) Role
	a) Worker sub-agent
4) Branch
	a) smoke/sub-repo-fixture
5) Scope
	a) Sub-repo fixture .AGENT run-once queue
6) Actions
	a) Read startup files, completed one run-once item, removed it from the queue, and
	   wrote AGENT-SMOKE-RESULT.md.
7) Verification
	a) Smoke runner asserted queue cleanup, log append, and transcript output.
8) Follow-ups
	a) None currently known.
""",
        encoding="utf-8",
    )

    return transcript


def main() -> int:
    for path in REQUIRED:
        assert_true((ROOT / path).is_file(), f"missing required file: {path}")

    for path in FORBIDDEN:
        assert_true(not (ROOT / path).exists(), f"old artifact still exists: {path}")

    readme = read(ROOT / "README.md")
    for expected in [
        ".AGENT/agent.md",
        ".AGENT/.agent-template.md",
        ".AGENT/agent-run.md",
        ".AGENT/agent-run-once.md",
        ".AGENT/agent-action-log.md",
    ]:
        assert_true(expected in readme, f"README does not describe {expected}")

    template_base = base_section(read(AGENT_DIR / ".agent-template.md"))
    agent_base = base_section(read(AGENT_DIR / "agent.md"))
    assert_true(template_base == agent_base, "agent.md base section drifted from template")

    agent_prompt = read(AGENT_DIR / "agent.md")
    for expected in [
        "CPMS is the classification and field-detection layer",
        "`dev` is the integration branch",
        "`main` is the release branch",
        "pnpm gate",
        "PYTHONPATH=python/cpms_client/src",
    ]:
        assert_true(expected in agent_prompt, f"agent prompt missing CPMS context: {expected}")

    with tempfile.TemporaryDirectory(prefix="cpms-agent-smoke-") as tmp:
        subrepo = Path(tmp) / "sample-sub-repo"
        subrepo.mkdir()
        (subrepo / "README.md").write_text("# Sample Sub-Repo\n", encoding="utf-8")
        copy_agent_boilerplate(subrepo)
        transcript = run_cursor_style_agent(subrepo)

        once = read(subrepo / ".AGENT" / "agent-run-once.md")
        log = read(subrepo / ".AGENT" / "agent-action-log.md")
        assert_true("No active one-time items." in once, "run-once queue was not cleared")
        assert_true("Smoke agent processed run-once item" in log, "action log was not updated")
        assert_true((subrepo / "AGENT-SMOKE-RESULT.md").is_file(), "smoke result missing")

    TRANSCRIPT.parent.mkdir(parents=True, exist_ok=True)
    TRANSCRIPT.write_text("\n".join(transcript), encoding="utf-8")
    print("\n".join(transcript))
    print(f"Transcript written to {TRANSCRIPT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
