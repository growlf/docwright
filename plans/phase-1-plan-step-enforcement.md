---
title: Phase 1 — Plan Step Completion Enforcement
status: in-progress
tests_defined: false
author: NetYeti
created: 2026-06-04
phase: 1
gate_reviewer: NetYeti
gate_status: pending
proposal_source:
  - proposals/plan-step-completion-enforcement.md
  - proposals/plan-complete-blocks-on-pending-steps.md
priority: high
automated: off
assigned_to: NetYeti
depends_on:
  - phase-1-ui-polish
scenario_synthesis: MCP server tool additions and PreToolUse hook extension; no deployment steps; all changes are local scripts and config files
tags:
  - phase-1
  - governance
  - enforcement
  - mcp
  - hooks
_path: plans/phase-1-plan-step-enforcement.md
---

# Phase 1 — Plan Step Completion Enforcement

## Overview

Two governance gaps discovered during Phase 1 development that must be closed
by code before Phase 2 begins:

1. **Stale step tables** — plan tasks were marked ✅ Complete while step rows
   still showed ⏳ Pending. Discovered in phase-1-ui-polish. AI memory is not
   enforcement; a pre-commit hook is.

2. **Complete button not blocked** — the PropertiesPane "Complete" button was
   available even when steps were pending. Partially fixed in UI (button
   disabled when pending steps detected); hook enforcement still needed for
   direct YAML edits and AI mutations.

Both are direct applications of the "code over memory" core policy.

## Deliverables

| # | Deliverable | Details | Status |
|---|-------------|---------|--------|
| 1 | UI: Complete button disabled when steps pending | `$derived.by` counts ⏳ in Implementation Steps; button shows count and tooltip | ✅ Done |
| 2 | `hasPendingStepsInSection()` + `checkPendingSteps()` in `lifecycle-gate.js` | State-machine parser; `validateFile()` calls it; `--check-files` flag for batch use | ✅ Done |
| 3 | Claude Code PreToolUse hook blocks direct `status: completed` writes with pending steps | Extended `claude-lifecycle-hook.sh` — Write + Edit branches for `plans/*.md`; inline Python state-machine parser | ✅ Done |
| 4 | Plan template: reminder note | "When marking a task ✅ Complete, update every step row" above Implementation Steps table | ✅ Done |
| 5 | Tests: `test/hooks/test-pending-steps.js` | 12 cases — 8 unit (`hasPendingStepsInSection`) + 4 file-based (`checkPendingSteps`) | ✅ Done |

## Design Decisions

- **State-machine parser** — tracks section context before flagging ⏳ in table rows; ~30 lines, no deps. Eliminates false positives from ⏳ in prose.
- **Scope matches UI** — hook and UI both check Implementation Steps + ✅-headed task subsections, so they can't disagree.
- **`--check-files` for batch efficiency** — one Node.js invocation covers all staged plan files.
- **UI regex false-positive risk** — UI uses regex, not the state-machine parser; ⏳ inside a code block in Implementation Steps would fire falsely. Accepted as Phase 1 known limitation; fix in Phase 2.

## Phase Gate

**Reviewer:** NetYeti (solo Phase 1 — `/critique-plan` adversarial review substitutes for human independence)
**Status:** `pending`

- [x] All deliverables ✅ Done
- [x] `node test/hooks/test-pending-steps.js` → 12/12 pass
- [x] Claude Code hook blocks `status: completed` write when plan has ⏳ rows
- [x] MCP `transition_to_completed` rejects plan with ⏳ rows
- [x] Complete button disabled when plan has ⏳ steps
- [x] All design decisions documented
- [ ] `tests_defined: true` set after human review of Tests section

## Tests

> `tests_defined` must be set to `true` by the human reviewer after confirming the tests below adequately cover the requirements.

| # | Test | Verifies | How to run | Expected result |
|---|------|----------|-----------|-----------------|
| 1 | 8 unit tests | `hasPendingStepsInSection()` — all section/scope cases | `node test/hooks/test-pending-steps.js` | 12/12 pass |
| 2 | 4 file-based tests | `checkPendingSteps()` reads real temp files; ok:false when ⏳ present | `node test/hooks/test-pending-steps.js` | Tests 9-12 pass |
| 3 | Hook blocks Edit with pending steps | `claude-lifecycle-hook.sh` returns stop-reason when Edit flips `status: completed` on plan with ⏳ rows | Claude Code session: Edit plan frontmatter to `status: completed` while body has ⏳ | Hook blocks; edit not applied |
| 4 | Hook blocks Write with pending steps | `claude-lifecycle-hook.sh` returns stop-reason for Write with `status: completed` + ⏳ body | Claude Code session: Write plan with `status: completed` + ⏳ rows | Hook blocks; file not written |
| 4a | MCP rejects pending | `transition_to_completed` returns error when ⏳ rows present | Call MCP tool on plan with ⏳ rows | Returns error string; no file mutation |
| 5 | UI Complete button disabled | PropertiesPane disables button when plan has ⏳ in Implementation Steps | Open plan with ⏳ steps; inspect Complete button | Disabled with count tooltip |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — promoted to Phase 1; UI enforcement already shipped | NetYeti |
| 2026-06-04 | Simplified — removed verbose Critical Review; corrected Deliverable 3 (hook not wired); fixed gate checklist state | NetYeti |
| 2026-06-04 | Deliverable 3 redesigned — enforcement moved from git pre-commit to Claude Code PreToolUse hook + MCP safety net | NetYeti |
