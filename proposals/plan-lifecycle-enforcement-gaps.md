---
title: "Plan Lifecycle Enforcement Gaps — MCP, Hook, and Agent Process Gaps"
author: NetYeti
created: 2026-06-28
tags:
  - governance
  - mcp
  - lifecycle
  - enforcement
  - process
  - phase-4
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: critical
---

## Problem

Two plans shipped with broken governance trails in the same session, revealing
systemic gaps in lifecycle enforcement:

1. **`governance-engine-view-container`** — code was built and shipped under a
   different plan (`ui-layout-view-container-refactor`, Step 11). The dedicated
   plan sat as an orphaned scaffold with one empty placeholder step. Nothing
   caught this.

2. **`plugin-system`** — steps were marked done but the Testing Plan section was
   never populated (`_Testing plan TBD_`) and gate criteria were never signed off
   before the session ended. The plan was pushed through without finishing the
   governance trail.

**Root cause:** enforcement exists at the wrong layer or not at all.

- The pre-commit hook validates commit format and frontmatter fields, but does NOT
  check whether Implementation Steps are real vs placeholder before allowing
  `status: in-progress`.
- The MCP `update_plan_status` tool checks gate criteria checkboxes, but does NOT
  check whether the Testing Plan section has actual content vs `_TBD_`.
- Nothing checks whether a plan being worked is the *correct* plan for the work
  being done — work can drift to a related plan and leave the original orphaned.
- Session-start does not flag `approved` plans with empty/placeholder steps as
  requiring attention before new work begins.
- AI agents have no hard stop when they attempt to start a plan with no real steps.

This will keep happening. Every session that touches a plan with empty steps or a
TBD testing plan is a governance liability.

## Proposed Solution

Enforce the plan lifecycle at every layer where it can be enforced — MCP tools,
pre-commit hook, session-start skill, and agent guidance. The principle from
`policies/core/code-over-memory.md` applies directly: if a rule can be enforced
in code, it must be.

### Layer 1 — MCP `update_plan_status` validation

**`in-progress` transition gate:** Reject if Implementation Steps table contains
any row where the Action cell is empty or matches `/^[\s|]*$/` (placeholder). Error
message: _"Plan has empty/placeholder steps. Write real steps before starting."_

**`completed` transition gate:** Already checks gate criteria checkboxes. Add:
reject if the Testing Plan section body still contains `_TBD_` or `_Testing plan TBD_`.
Error message: _"Testing Plan section is still TBD. Fill it in before completing."_

### Layer 2 — Pre-commit hook

Mirror the MCP validations at the git layer so they cannot be bypassed by direct
file edits:

- `status: in-progress` commit on a plan file → check that no step rows are
  empty/placeholder.
- `status: completed` commit on a plan file → check that Testing Plan does not
  contain `_TBD_`.

Both fire as hard errors (not warnings).

### Layer 3 — `write_plan` MCP tool

When `write_plan` receives a plan with empty/placeholder steps, emit a warning in
the tool response: _"Warning: Implementation Steps table has N empty rows. Fill
them in before starting the plan."_ Not a hard error here (scaffolding is
legitimate), but explicit.

### Layer 4 — Session-start skill

Extend `docwright-session-start` to include a **plan health check**:
- List all `approved` plans that have empty/placeholder steps → surface as
  "⚠️ Plans missing steps" requiring attention before new work starts.
- List all `in-progress` plans where Testing Plan is still TBD → surface as
  "⚠️ Plans with incomplete testing sections."

This gives every session an upfront signal before work begins, not a surprise
at close-out.

### Layer 5 — Agent guidance (AGENTS.md + profile instructions)

Update `AGENTS.md` and the active profile's `opencode-instructions.md` to include
explicit pre-flight checks:

> Before starting work on a plan: (1) verify it has real implementation steps,
> not placeholders; (2) write steps if missing; (3) confirm you are working the
> correct plan for the task at hand, not a related one.

This is a backstop — code enforcement is primary, guidance is secondary.

### Layer 6 — "Wrong plan" detection (stretch)

When an AI session marks steps done on Plan A that match the description of an
`approved` Plan B (via keyword overlap), surface a warning: _"The work you're
tracking resembles an existing approved plan. Are you working the right plan?"_
This is harder to automate precisely but a collation-style check could catch
obvious cases.

## Alternatives Considered

**Warn instead of block at the MCP layer** — rejected. Warnings have been
tried implicitly (the TBD sections exist as visible gaps) and humans and AI
alike ignore them under time pressure. Hard errors are the only reliable mechanism.

**Only fix the hook** — rejected. The pre-commit hook fires at commit time, after
the work is already done. The MCP layer fires at transition time, which is earlier
and more actionable. Both are needed; neither alone is sufficient.

**Rely on better AI discipline** — explicitly rejected per
`policies/core/code-over-memory.md`. Memory and discipline are known failure modes.

## Future

- Auto-generate a stub Testing Plan section when `write_plan` creates a plan from
  a proposal, so it's never literally TBD from day one.
- A `validate_plan` MCP tool that runs all health checks on demand and returns a
  structured report — useful for session-start and CI.
- CI check: scan all `plans/*.md` for empty steps or TBD testing plans and fail
  the build. Makes the gaps visible in PRs before they accumulate.
