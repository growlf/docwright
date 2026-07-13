---
title: "Plan: Harden AI-agent plan/proposal lifecycle tooling"
status: draft
author: "NetYeti"
created: "2026-07-13"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/harden-plan-proposal-lifecycle-tooling"
priority: medium
phase: 
automated: guided
waiting_reason:  # Populated when status = waiting-for-user
assigned_to: ["NetYeti"]
# parent_plan: phase-N-overview.md   # filename of parent plan (omit if top-level)
# parent_deliverable: "1"            # row number in parent's Deliverables table
related_to: []
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:  # Populated when plan is canceled
cancellation_reason:  # Populated when plan is canceled
template_version: "1.0"
tests_defined: true
tests_human_reviewed: false  # Set to true after human certifies AI-generated tests
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
---

# Plan: Harden AI-agent plan/proposal lifecycle tooling

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Problem

Four independent bugs surfaced in a single session of otherwise-normal plan/proposal work, all sharing the same shape: **the tool appears to succeed, but silently does the wrong thing or corrupts state**, and the human or AI operating it has no way to tell without manually cross-checking the filesystem.

1. **Proposal→plan transition duplicates `approved/` paths.** Transitioning a proposal to approved and generating its plan intermittently (a) moves the proposal to a doubly-nested `proposals/approved/approved/<name>.md` instead of `proposals/approved/<name>.md`, and (b) leaves an orphan skeleton plan at `plans/approved/<name>.md` (status: draft, empty steps) alongside a separately-generated, fully-authored plan at `plans/<name>.md`. Both artifacts' cross-references (`proposal_source`, `consumed_by`) end up pointing at paths that don't exist. Observed twice — once already committed to the repo from an earlier session (`plans/approved/release-v0.5.0.md`), once caught mid-transition this session before it could land.

2. **`update_step` corrupts the Implementation Steps table when a Details cell contains an unescaped `|`.** A cell documenting a literal pipe (e.g. `` `category: bug|feature` ``) desyncs the tool's row-parsing, truncating the cell text and duplicating the Status cell (`✅ Done | ⏳ Pending`). The corruption is silent — the tool reports success. A related regression in the same code path flipped `tests_defined` from `true` to `false` with no corresponding edit.

3. **The Web UI's "Complete" button only sets `status: completed` in frontmatter.** It never moves the plan to `plans/completed/`, never generates the completion doc, and never navigates anywhere — it just closes with a toast. The equivalent, correct behavior already exists as the `transition_to_completed` MCP tool, but the button doesn't call it or anything like it. A user clicking Complete sees no error and no confirmation beyond the button disappearing, and is left to wonder whether it worked.

4. **The Web UI's "Run Tests" button never persists a test-run record.** It only sets in-memory component state (`testPassed`) used to decide whether to show "Certify Tests." Because `transition_to_completed` hard-requires a recorded `tests_last_result` (written by the separate `verify_plan_tests` MCP tool), any plan taken through the UI's Run Tests → Certify Tests → Complete flow will always fail completion with "no recorded test run" — even though a human genuinely ran and certified the tests through the UI. There is currently no way to produce a valid completion from the Web UI alone.

**Why bundle these four:** each is a different manifestation of the same underlying gap — the MCP tools and their Web UI counterparts have drifted apart, each side implementing partial or divergent logic instead of sharing one source of truth. Bugs 3 and 4 are the same drift pattern (`transition_to_completed` vs. the Complete button; `verify_plan_tests` vs. the Run Tests button). Fixing them together, with a shared principle, is more valuable than four disconnected patches.

### Alternatives considered

**Fix each bug as a separate, independent PR.** Rejected — the four share a root cause (MCP/Web UI logic drift) and a shared fix pattern (extract-and-share instead of reimplement). Bundling makes that pattern explicit and easier to review as one coherent architectural fix rather than four unrelated patches that happen to land in the same week.

**Leave `update_step`'s pipe-in-cell bug as "just don't put `|` in cell text."** Rejected — documenting a literal pipe character (e.g. `category: bug|feature`, a valid TypeScript union) inside a code span is a completely reasonable and foreseeable thing to write in a plan. Silently corrupting the table instead of handling it is exactly the kind of gap `policies/core/code-over-memory.md` says should be enforced by code, not avoided by convention.

**Have the Web UI just call the MCP tools directly instead of adding new API endpoints.** Considered, but the Web UI's server already has its own frontmatter-mutation code paths (separate from the MCP server process) for other document types; the pragmatic fix is a shared TypeScript function both surfaces import, not a runtime dependency of the webui process on the MCP server process.

### Future

- A test suite that exercises MCP tool + Web UI endpoint pairs *together* (e.g. "certifying via the API produces a plan `transition_to_completed` will accept") would catch this class of drift automatically, rather than relying on someone hitting it manually in a live session, as happened here.
- Once the location-invariant class of bug (proposal→plan duplication) is fixed, consider extending `pre-commit`'s `validate_no_duplicate_locations` check (which already catches `proposals/approved/` + `proposals/` root duplicates) to also catch the `plans/approved/` skeleton-orphan pattern specifically, as defense in depth.

### Success criteria

- [ ] Transitioning a proposal to approved and generating its plan never produces a doubly-nested `approved/approved/` path or an orphan skeleton plan, verified by a regression test
- [ ] `update_step` marking a step done preserves every other cell's content when a Details cell contains an unescaped `|`, verified by a regression test
- [ ] Clicking "Complete" in the Web UI on a plan with all gates met moves it to `plans/completed/`, generates the completion doc, and returns the user to `/status`
- [ ] Clicking "Run Tests" then "Certify Tests" then "Complete" in the Web UI — with no manual MCP tool calls — successfully completes a plan end-to-end
- [ ] The Complete/Run-Tests logic shared between the MCP tools and the Web UI API routes lives in one function each, not two parallel implementations


## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan



## Rollback Procedures



## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Test coverage defined and human-reviewed (`tests_human_reviewed: true`)
- [ ] Deferred ideas captured as proposals before closing (see [[policies/core/capture-deferred-ideas.md]])
- [ ] Rollback procedures documented
- [ ] Risk assessment completed

## Testing Plan

### Step Verification

- [ ] All implementation steps complete and outcomes verified

### Integration & Regression

- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Plan: Harden AI-agent plan/proposal lifecycle tooling functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created | NetYeti |
