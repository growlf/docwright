---
title: "Plan: Hide consumed issues from backlog — fix workflow visibility"
status: draft
author: "NetYeti"
created: "2026-07-07"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/approved/hide-consumed-issues-from-backlog.md"
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

# Plan: Hide consumed issues from backlog — fix workflow visibility

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Problem

When issues are bundled into a proposal (marked `status: proposal-linked` with `consumed_by: proposals/...`), they remain visible in:
- Issue lists as independent work items
- Status dashboards counting "awaiting processing"
- Backlog views suggesting they need separate handling

**Impact:**
1. Users see duplicate work — the issue AND the proposal
2. Workflow is ambiguous — which should they focus on?
3. Backlog appears larger than it is
4. Process viability can't be verified

**Blocking:** Cannot dogfood the workflow until this is fixed.

### Workflow clarity

This change makes the workflow explicit:

```
[Issue] scope-checked
   ↓ bundle into
[Proposal] awaiting-approval
   ↓ issues are NOW "consumed" and hidden
   ↓ promote proposal to
[Plan] approved
   ↓ implementation begins
[Work] (issues remain bundled, visible when viewing plan)
```

Before: Issues visible in three places (issue list, proposal, plan) — confusing
After: Issues visible contextually (grouped under their proposal/plan) — clear

### Implementation phases

### Phase 1: Data Layer
- [ ] Add `is_consumed` computed field to issue schema
- [ ] Update issue list queries to filter by default
- [ ] Add "show consumed" filter toggle

### Phase 2: Proposal View
- [ ] Parse `consumed_by` from issues
- [ ] Render "Addressed by this proposal" section
- [ ] Show issue backlinks with badges

### Phase 3: Dashboard Update
- [ ] Update status page aggregation
- [ ] Change "awaiting" counts to exclude consumed
- [ ] Add "in flight" metric

### Success criteria

- Consumed issues are hidden from "awaiting processing" views by default
- Proposal clearly shows which issues it addresses
- Status dashboard metrics reflect only unconsumed work
- Users cannot be confused about workflow state

### Future

- Apply same pattern to other "consuming" relationships (plan consuming proposals, etc.)
- Batch operations: "mark all issues in this proposal as X"
- Proposal detail: estimated effort, risk rollup from consuming issues


## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan

- [ ] Issue with `status: proposal-linked` and `consumed_by: proposals/X` does not appear in main issue list
- [ ] "Show consumed issues" filter reveals grouped consumed issues
- [ ] Proposal view shows all consuming issues clearly
- [ ] Status dashboard counts don't include consumed issues
- [ ] "Issues in flight" metric shows correct count
- [ ] Can still search for consumed issues directly

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

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-07 | Created | NetYeti |
