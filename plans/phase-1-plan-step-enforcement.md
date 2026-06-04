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
scenario_synthesis: MCP server tool additions, PreToolUse hook extension, SOP consolidation, PostToolUse hook; no deployment steps; all changes are local scripts and config files
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
cycles into a layered reinforcement architecture with a key correction: the
actual failure vector (Bash/Python bypassing Write/Edit tools) was not addressed
by any of the originally proposed layers.

**Core problem:** Governance rules are only as effective as the AI's awareness
of the governed path. That awareness degrades mid-session as context fills,
config files go stale, and the AI reaches for familiar shortcuts rather than
the correct MCP tools.

**The failure vector that caused plan file mangling:** AI used Python/Bash
scripts to write plan files directly, bypassing both the PreToolUse hook and
all three reinforcement layers. The hook only covers Claude Code Write/Edit
tools. This gap must be closed explicitly in AGENTS.md.

**Enforcement architecture — three layers covering the Write/Edit path:**

```
Intent formation  →  Decision point       →  Failure point
get_plan() footer    plan-mutation SOP       contextual hook message
(Layer 3)           (Layer 2)               (Layer 1)
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
| 5 | Tests: `test/hooks/test-pending-steps.js` | 13 cases — 8 unit + 4 file-based + 1 in-progress; all pass | ✅ Done |
| 6 | MCP `_has_pending_steps()` in `transition_to_completed` | Safety-net validation; blocks archival if pending rows remain | ✅ Done |
| 7 | MCP plan mutation tools | `update_step`, `update_plan_status`, `append_history`, `set_plan_field`, `write_plan` + all helpers | ✅ Done |
| 8 | AGENTS.md Invariant 6 | Names the five MCP tools; proactive self-check contract; fail-closed rule | ✅ Done |
| 9 | Core policy: `policies/core/workflow-layer-governance.md` | Why git is wrong layer; four enforcement surfaces; ships to adopters | ✅ Done |
| 10 | Reference doc: `docs/ai-governance-enforcement.md` | Tool table, layer descriptions, failure modes, live-feed vs snapshot principle | ✅ Done |
| 11 | CLAUDE.md + README.md + `policies/core/code-over-memory.md` updated | Philosophy entry, governance architecture section, mechanism table corrected | ✅ Done |
| 12 | Plan-completion skill — `docs/SOPs/plan-completion.md` | Explicit 5-step MCP tool sequence; closes behavioral gap at Layer 1 | ✅ Done |
| 13 | AGENTS.md: explicit Bash/Python write prohibition | Add rule: "Never use Bash, Python scripts, or any shell command to write plan files directly — this bypasses MCP validation and the PreToolUse hook." Closes the actual bypass vector that caused plan file mangling. | ⏳ Pending |
| 14 | `get_plan()` governance footer — dynamic | Append a 2-3 line footer to every `get_plan()` response listing MCP mutation tools, computed from the server's registered tool names (not hardcoded) so it stays current if tools evolve | ⏳ Pending |
| 15 | Consolidate plan-mutation SOP | Expand `docs/SOPs/plan-completion.md` into `docs/SOPs/plan-mutation.md` covering ALL plan mutation scenarios (steps, status, history, fields, structural rewrites); retire the separate plan-edit SOP concept; one authoritative source removes overlap with AGENTS.md Invariant 6 | ⏳ Pending |
| 16 | Contextual hook error messages | Extend `claude-lifecycle-hook.sh` to emit operation-specific MCP suggestions using 3 coarse categories: Write→`write_plan`; Edit+`status:`→`update_plan_status`; Edit+step marker→`update_step`; catch-all→list all tools. No full classifier — avoids false positives from misidentification. | ⏳ Pending |
| 17 | PostToolUse hook for AGENTS.md / CLAUDE.md changes | `.claude/settings.json` PostToolUse fires after Write/Edit to AGENTS.md or CLAUDE.md only (not all SOPs — too noisy). Message: "Governance file edited. This change takes effect in the next session. If your current task depends on a rule in this file, start a new session before proceeding." Session-boundary statement, not a re-read reminder. | ⏳ Pending |

## Design Decisions

- **State-machine parser** — tracks section context before flagging pending markers
  in table rows; ~30 lines, no deps. Lives in `lifecycle-gate.js` (JS, canonical +
  tests) and ported inline to `mcp-server.py`.
- **Targeted MCP tools over full content replacement** — each tool mutates only the
  specific string it owns; everything else on disk is guaranteed unchanged. Prevents
  content drift when an AI rewrites large files.
- **PreToolUse as AI write gate** — fires before Write/Edit executes. Blanket block
  on `plans/*.md`. Covers Claude Code Write/Edit tools only; Bash writes bypass it.
- **MCP as governed path** — recounts step counts and logs to audit trail on every
  call. No `--no-verify` escape hatch.
- **Git pre-commit as final backstop** — `.githooks/pre-commit` calls
  `lifecycle-gate.js --check-files` on staged plans AND handles git-native concerns.
  Discovered mid-session (was already implemented). MCP + PreToolUse prevent bad
  state from reaching a commit; git catches anything that slips through.
- **Bash/Python prohibition (13)** — the PreToolUse hook only covers Write/Edit tools.
  An AI that uses Python/Bash to write plan files bypasses all enforcement. Explicit
  prohibition in AGENTS.md closes the gap that caused the mangling incident.
- **Dynamic footer over hardcoded (14)** — footer computed from the MCP server's
  registered tool names, not static text. Stays current if tools evolve. Injected on
  every `get_plan()` call; accepted tradeoff for read-only contexts.
- **Coarse hook categories over full classifier (16)** — 3 pattern checks (Write,
  Edit+status, Edit+step marker) rather than attempting to infer intent from content.
  False positives from misidentification are worse than a generic list.
- **Session-boundary statement over re-read reminder (17)** — "re-read before your
  next action" is not mechanically enforceable. The honest and actionable message is:
  edits to governance files take effect in the next session.
- **Consolidated SOP over separate skill (15)** — a `plan-edit` skill with keyword
  triggers is brittle and overlaps with existing content. One `plan-mutation.md` SOP
  covering all scenarios provides a single authoritative source.
- **Deliverable 17 (standalone principle doc) dropped** — documenting the live-feed
  vs snapshot principle as its own deliverable violates code-over-memory. The principle
  is captured in the reference doc (Deliverable 10) and enforced by Deliverables 14
  and 17. No standalone doc needed.
- **No HUMAN_APPROVED bypass for plan writes** — considered and reverted. The correct
  path for structural plan rewrites is `write_plan` (MCP), not a hook bypass.
- **UI regex false-positive risk** — UI uses regex, not the state-machine parser; an
  emoji inside a code block in Implementation Steps would fire falsely. Accepted as
  Phase 1 known limitation; fix in Phase 2 when dispatch linter is wired up.

## Phase Gate

**Reviewer:** NetYeti (solo Phase 1 — `/critique-plan` adversarial review substitutes for human independence)
**Status:** `pending`

- [x] All deliverables 1-12 ✅ Done
- [x] `node test/hooks/test-pending-steps.js` → 13/13 pass
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
| 1 | 8 unit tests | `hasPendingStepsInSection()` — all section/scope cases | `node test/hooks/test-pending-steps.js` | 13/13 pass |
| 2 | 4 file-based tests | `checkPendingSteps()` reads real temp files; ok:false when completing with pending | `node test/hooks/test-pending-steps.js` | Tests 9-12 pass |
| 3 | In-progress plan with pending rows — not blocked | `checkPendingSteps()` returns ok:true for in-progress status | `node test/hooks/test-pending-steps.js` | Test 13 passes |
| 4 | Hook blocks direct Edit | `claude-lifecycle-hook.sh` returns stop-reason for any Edit on `plans/*.md` | Claude Code: attempt any Edit to a plan file | Hook blocks; redirect message shown |
| 5 | Hook blocks direct Write | `claude-lifecycle-hook.sh` returns stop-reason for any Write to `plans/*.md` | Claude Code: attempt any Write to a plan file | Hook blocks; redirect message shown |
| 6 | Hook gives contextual suggestion | Block message names specific MCP call for detected operation type | Edit that changes `status:` field; check stop-reason | Message suggests `update_plan_status` not generic list |
| 7 | MCP rejects pending on complete | `update_plan_status` blocks `completed` when pending rows remain | Call `update_plan_status('x', 'completed')` with pending rows | Returns error; no file mutation |
| 8 | MCP `update_step` updates and recounts | Replaces status cell; updates `total_steps`/`completed_steps` | Call `update_step` on a known step; read back file | Step updated; counts correct in frontmatter |
| 9 | MCP `append_history` adds row | Appends row with today's date and resolved author | Call `append_history('x', 'test change')` | Row appears at bottom of Document History table |
| 10 | `get_plan()` footer is dynamic | Footer lists current registered tools, not hardcoded text | Call `get_plan()`; compare footer to actual tool list | Footer matches registered MCP tools |
| 11 | AGENTS.md contains Bash/Python prohibition | Explicit rule present | Read AGENTS.md | Rule visible in Invariant 6 or equivalent |
| 12 | PostToolUse fires on governance file edit | Session-boundary message emitted after AGENTS.md edit | Edit AGENTS.md in Claude Code session | Message states changes take effect next session |
| 13 | UI Complete button disabled | PropertiesPane disables button when plan has pending steps | Open plan with pending steps; inspect Complete button | Disabled with count tooltip |

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
| 2026-06-04 | Deliverables 13-17 added — three-layer reinforcement + config staleness strategy | NetYeti |
| 2026-06-04 | Deliverables 13-17 revised after adversarial critique — Bash prohibition leads; skill replaced by SOP consolidation; hook messages scoped to 3 categories; PostToolUse message reframed as session-boundary statement; standalone principle doc dropped | NetYeti |
