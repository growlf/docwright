# hook-failure-feedback

## Rule

When a pre-commit hook rejects a commit, two things must happen — not one:

1. **Fix the immediate issue** so the commit can proceed.
2. **Create a proposal** in `proposals/` to eliminate the systemic gap that allowed the invalid state to be reached.

The hook caught a symptom. The proposal addresses the cause.

## Rationale

Pre-commit hooks are a last-resort safety net, not a primary enforcement layer. Every time a hook fires, it signals that an upstream abstraction (MCP tool, UI, SOP) failed to prevent the invalid state. If you simply fix the file and move on, the gap remains. DocWright's goal is zero reliance on hooks for process safety — they exist only to catch regressions.

Capturing the gap as a proposal ensures DocWright evolves its safety guarantees over time.

## Examples

Hook fails with "assigned_to empty on approved plan":
- Fix: add an assignee in the frontmatter
- Proposal: "Add assigned_to validation to update_plan_status() MCP tool" — the MCP tool should have caught this before the commit

Hook fails with "commit message format":
- Fix: rewrite the commit message
- Proposal: (skip if format is already enforced by commit-msg hook and the failure is genuine user error rather than a tooling gap)

## Scope

Applies when a `git commit` is rejected by a hook (`scope: git-commit`) and during session wrap-up when reviewing what happened (`scope: session`). The proposal is `priority: high` and tagged `tooling-gap`.
