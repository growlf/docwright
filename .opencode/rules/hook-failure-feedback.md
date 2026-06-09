# Rule: Pre-Commit Hook Failures Must Trigger Systemic Proposals

## The Rule

Pre-commit hooks (like `scripts/lifecycle-gate.js` or `scripts/pre-commit.sh`) are training wheels for inadequate tooling. If you attempt a `git commit` and it is blocked by a hook, it means the system's tooling or your instructions allowed you to reach an invalid state.

When a pre-commit hook fails, you MUST NOT simply fix the file and move on. You MUST:

1. **Fix the immediate issue** so the commit can proceed.
2. **Diagnose the root cause:** Why did the tooling, MCP server, or SOP allow you to make the mistake in the first place?
3. **Draft a Proposal:** Automatically create a new Proposal in `proposals/` to fix the systemic gap. Set `priority: high` and tag it with `tooling-gap`.

## What counts as a tooling gap?

If a hook caught the error, the gap is usually one of the following:
- **Missing MCP validation:** An MCP tool (like `update_plan_status`) allowed an invalid transition that the hook later caught. (Fix: Move the hook's validation logic upstream into the MCP tool).
- **Missing or ambiguous SOP:** The instructions in `AGENTS.md` or a `.opencode/skills/*.md` file were unclear, causing the agent to take the wrong path. (Fix: Update the Skill/SOP).
- **Missing UI/CLI guardrail:** The user was able to easily trigger an invalid state because the interface didn't warn them. (Fix: Add a warning or disable the action in the UI).
- **Silent failure in an upstream step:** A previous step failed to update a dependency or related file, causing this step to fail validation. (Fix: Add an automated consistency check to the upstream step).

## Proposal Contents (Minimum)

The proposal you generate MUST include:
- **Title:** `Formalize validation for [Hook Error Scenario]`
- **The Hook Failure:** The exact error message output by the pre-commit hook.
- **The Root Cause:** How the agent or user reached the invalid state.
- **The Proposed Fix:** E.g., "Add `checkStepCounterConsistency` logic directly into the `update_step` MCP tool so it rejects the mutation before it ever hits the filesystem."

## Why this matters

Our goal is zero reliance on Git hooks for process safety. Hooks exist to catch regressions and edge cases. Every time a hook fires, it is a signal that our primary abstractions (MCP tools, UI, SOPs) have failed. Capturing these moments automatically ensures DocWright continuously evolves its safety guarantees upstream.
