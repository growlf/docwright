---
title: "Plan: Release v0.4.10 — ship what's landed, save 0.5.0 for the milestone"
status: draft
author: "NetYeti"
created: "2026-07-08"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/release-v0.4.10"
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

# Plan: Release v0.4.10 — ship what's landed, save 0.5.0 for the milestone

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Problem

49 commits have landed since v0.4.9 (tagged Mar 2026) across Wave B hooks, collaboration model, WebUI write integrity, session auto-landing, and a dozen+ bug fixes. No tagged release captures this state. The dogfood instance already shows 0.5.0 but the code is still 0.4.9 — version drift bug #258.

### Alternatives considered

- **Call it 0.5.0** — rejected per BDFL direction: save the number for when the milestone items actually ship.

### Future

The deferred items plus the remaining 40+ approved proposals become the v0.5.0 release scope.


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
- [ ] Plan: Release v0.4.10 — ship what's landed, save 0.5.0 for the milestone functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-08 | Created | NetYeti |
