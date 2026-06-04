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
  - proposals/plan-steps-structured-frontmatter.md
priority: high
automated: off
assigned_to: NetYeti
depends_on:
  - phase-1-ui-polish
scenario_synthesis: MCP server tool additions, PreToolUse hook extension, skill and PostToolUse hook additions; no deployment steps; all changes are local scripts and config files
tags:
  - phase-1
  - governance
  - enforcement
  - mcp
  - hooks
total_steps: 17
completed_steps: 12
_path: plans/phase-1-plan-step-enforcement.md
---

# Phase 1 — Plan Step Completion Enforcement

## Overview

Two governance gaps discovered during Phase 1 development, resolved by moving
enforcement out of git and into the AI workflow layer. Extended through critique
cycles into a full three-layer reinforcement architecture.

**Core problem:** Governance rules are only as effective as the AI's awareness
of the governed path — and that awareness degrades mid-session as context window
fills, config files go stale, and the AI reaches for familiar tools (Write/Edit)
rather than the correct ones (MCP).

**Architecture:** Three enforcement points for the same rule, covering the
full decision lifecycle:

```
Intent formation  →  Decision point  →  Failure point
get_plan() footer    plan-edit skill    hook block message
(Layer 3)           (Layer 2)          (Layer 1)
```

Git pre-commit (`.githooks/pre-commit`) remains the final backstop via
`lifecycle-gate.js --check-files` for anything that reaches commit time.

See [[docs/ai-governance-enforcement.md]] and
[[policies/core/workflow-layer-governance.md]] for the full architecture.

![AI governance enforcement layers](../docs/governance_enforcement_layers.svg)

## Implementation Steps

| # | Deliverable | Details | Status |
|---|-------------|---------|--------|
| 1 | UI: Complete button disabled when steps pending | `$derived.by` counts pending markers in Implementation Steps; button shows count and tooltip | ✅ Done |
| 2 | `hasPendingStepsInSection()` + `checkPendingSteps()` in `lifecycle-gate.js` | State-machine parser; `validateFile()` calls it; `--check-files` flag for batch use | ✅ Done |
| 3 | PreToolUse hook blocks ALL direct writes/edits to `plans/*.md` | `claude-lifecycle-hook.sh` — blanket Write + Edit block; redirects to MCP tools | ✅ Done |
| 4 | Plan template: reminder note | "When marking a task complete, update every step row" above Implementation Steps | ✅ Done |
| 5 | Tests: `test/hooks/test-pending-steps.js` | 12 cases — 8 unit + 4 file-based; all pass | ✅ Done |
| 6 | MCP `_has_pending_steps()` in `transition_to_completed` | Safety-net validation; blocks archival if pending rows remain | ✅ Done |
| 7 | MCP plan mutation tools | `update_step`, `update_plan_status`, `append_history`, `set_plan_field`, `write_plan` + all helpers | ✅ Done |
| 8 | AGENTS.md Invariant 6 | Names the five MCP tools; proactive self-check contract; fail-closed rule | ✅ Done |
| 9 | Core policy: `policies/core/workflow-layer-governance.md` | Why git is wrong layer; four enforcement surfaces; ships to adopters | ✅ Done |
| 10 | Reference doc: `docs/ai-governance-enforcement.md` | Tool table, layer descriptions, failure modes, governance_enforcement_layers.svg linked | ✅ Done |
| 11 | CLAUDE.md + README.md + `policies/core/code-over-memory.md` updated | Philosophy entry, governance architecture section, mechanism table corrected | ✅ Done |
| 12 | Plan-completion skill — `docs/SOPs/plan-completion.md` | Explicit 5-step MCP tool sequence; closes behavioral gap at Layer 1 | ✅ Done |
| 13 | Layer 3: `get_plan()` governance footer | Inject current MCP tool table into every `get_plan()` response; surfaces governed path at intent-formation time before AI forms a bad plan | ⏳ Pending |
| 14 | Layer 2: `docwright-plan-edit` skill + AGENTS.md entry | `docs/SOPs/plan-edit.md` with agent-instructions; triggers on "edit plan", "update plan", "modify plan"; loads MCP vocabulary at decision point | ⏳ Pending |
| 15 | Layer 1: Contextual hook error messages | `claude-lifecycle-hook.sh` pattern-matches on old_string/new_string to emit a specific MCP call suggestion, not just a generic tool list | ⏳ Pending |
| 16 | PostToolUse hook for governance file modifications | `.claude/settings.json` PostToolUse fires after Write/Edit to AGENTS.md, CLAUDE.md, docs/SOPs/; emits re-read reminder so staleness is visible, not silent | ⏳ Pending |
| 17 | Live-feed vs snapshot design principle documented | Add to `policies/core/workflow-layer-governance.md`: critical operational rules belong in live-feed layers (hook, MCP responses); vocabulary/why in snapshot layers (AGENTS.md) | ⏳ Pending |

## Design Decisions

- **State-machine parser** — tracks section context before flagging pending markers
  in table rows; ~30 lines, no deps. Lives in `lifecycle-gate.js` (JS, canonical +
  tests) and ported inline to `mcp-server.py`.
- **Targeted MCP tools over full content replacement** — each tool mutates only the
  specific string it owns; everything else on disk is guaranteed unchanged. Prevents
  content drift when an AI rewrites large files.
- **PreToolUse as AI write gate** — fires before Write/Edit executes, before any file
  is touched. Blanket block on `plans/*.md` with a redirect message.
- **MCP as governed path** — recounts `total_steps`/`completed_steps` and logs to the
  audit trail on every call. No `--no-verify` escape hatch.
- **Git pre-commit as final backstop** — `.githooks/pre-commit` calls
  `lifecycle-gate.js --check-files` on staged plans AND handles git-native concerns.
  Was already implemented; discovered mid-session. MCP + PreToolUse layers prevent
  bad state from reaching a commit; git is the last catch.
- **Three enforcement layers (13-15)** — prevent (get_plan footer, Layer 3), redirect
  (skill, Layer 2), stop+guide (contextual hook message, Layer 1). No single layer is
  sufficient; stacked they cover intent formation → decision → failure.
- **Live-feed vs snapshot (16-17)** — hook and MCP responses are always current; AI
  context (AGENTS.md, CLAUDE.md) is a session-start snapshot. Config file edits during
  a session don't take effect until the next session. Critical operational rules must
  be in live-feed layers; PostToolUse hook makes staleness visible rather than silent.
- **No HUMAN_APPROVED bypass for plan writes** — considered and reverted. The correct
  path for structural plan rewrites is `write_plan` (MCP), not a hook bypass.
- **UI regex false-positive risk** — UI uses regex, not the state-machine parser; an
  emoji inside a code block in Implementation Steps would fire falsely. Accepted as
  Phase 1 known limitation; fix in Phase 2 when dispatch linter is wired up.

## Phase Gate

**Reviewer:** NetYeti (solo Phase 1 — `/critique-plan` adversarial review substitutes for human independence)
**Status:** `pending`

- [x] All deliverables 1-12 ✅ Done
- [x] `node test/hooks/test-pending-steps.js` → 12/12 pass
- [x] PreToolUse hook blocks direct Write/Edit to any `plans/*.md`
- [x] MCP `update_plan_status(..., 'completed')` rejects plan with pending rows
- [x] MCP `transition_to_completed` rejects plan with pending rows
- [x] Complete button disabled when plan has pending steps
- [x] Core policy and reference doc written and committed
- [x] Plan-completion skill written (`docs/SOPs/plan-completion.md`)
- [x] All design decisions documented
- [ ] Deliverables 13-17 complete
- [ ] `tests_defined: true` set after human review of Tests section

## Tests

> `tests_defined` must be set to `true` by the human reviewer after confirming
> the tests below adequately cover the requirements.

| # | Test | Verifies | How to run | Expected result |
|---|------|----------|------------|-----------------|
| 1 | 8 unit tests | `hasPendingStepsInSection()` — all section/scope cases | `node test/hooks/test-pending-steps.js` | 12/12 pass |
| 2 | 4 file-based tests | `checkPendingSteps()` reads real temp files; ok:false when pending | `node test/hooks/test-pending-steps.js` | Tests 9-12 pass |
| 3 | Hook blocks direct Edit | `claude-lifecycle-hook.sh` returns stop-reason for any Edit on `plans/*.md` | Claude Code: attempt any Edit to a plan file | Hook blocks; redirect message shown |
| 4 | Hook blocks direct Write | `claude-lifecycle-hook.sh` returns stop-reason for any Write to `plans/*.md` | Claude Code: attempt any Write to a plan file | Hook blocks; redirect message shown |
| 5 | Hook gives contextual suggestion | Block message names the specific MCP call for the detected operation | Attempt Edit that changes step status; check stop-reason | Message suggests `update_step(...)` not generic list |
| 6 | MCP rejects pending on complete | `update_plan_status` blocks `completed` when pending rows remain | Call `update_plan_status('x', 'completed')` on plan with pending rows | Returns error; no file mutation |
| 7 | MCP `update_step` updates and recounts | Replaces status cell; updates `total_steps`/`completed_steps` | Call `update_step` on a known step; read back file | Step updated; counts correct in frontmatter |
| 8 | MCP `append_history` adds row | Appends row with today's date and resolved author | Call `append_history('x', 'test change')` | Row appears at bottom of Document History table |
| 9 | `get_plan()` footer visible | Every `get_plan()` response includes MCP tool table footer | Call `get_plan('any-plan')` | Footer present; tool names current |
| 10 | PostToolUse fires on governance edit | Re-read reminder emitted after Write/Edit to AGENTS.md | Edit AGENTS.md in Claude Code session | Hook emits warning to re-read file |
| 11 | UI Complete button disabled | PropertiesPane disables button when plan has pending steps | Open plan with pending steps; inspect Complete button | Disabled with count tooltip |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — promoted to Phase 1; UI enforcement already shipped | NetYeti |
| 2026-06-04 | Simplified — removed verbose Critical Review; corrected Deliverable 3 (hook not wired) | NetYeti |
| 2026-06-04 | Deliverable 3 redesigned — enforcement moved to Claude Code PreToolUse hook + MCP | NetYeti |
| 2026-06-04 | Expanded scope — blanket hook block; five MCP mutation tools; policy and reference docs | NetYeti |
| 2026-06-04 | Correction — discovered `.githooks/pre-commit` already calls `lifecycle-gate.js --check-files` | NetYeti |
| 2026-06-04 | Deliverable 12 — plan-completion skill; fixed wrong MCP tool names in opencode-instructions.md | NetYeti |
| 2026-06-04 | Source proposals deleted; YAML-steps idea preserved as deferred proposal | NetYeti |
| 2026-06-04 | Plan restored from mangled state caused by chained Python string substitutions | NetYeti |
| 2026-06-04 | Deliverables 13-17 added — three-layer reinforcement architecture + runtime config staleness strategy | NetYeti |
