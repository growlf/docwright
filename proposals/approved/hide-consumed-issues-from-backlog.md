---
title: "Hide consumed issues from backlog — fix workflow visibility"
author: NetYeti
created: 2026-07-07
tags:
  - webui
  - ux
  - workflow
  - issue-management
approved: true
created_by: "claude@claude-code"
assigned_to: NetYeti
sources:
  - https://github.com/growlf/docwright/issues/394
related_to:
  - plans/implement-consumed-issues-visibility.md
consumed_by: plans/hide-consumed-issues-from-backlog.md
_path: proposals/approved/hide-consumed-issues-from-backlog
---

# Hide consumed issues from backlog — fix workflow visibility

## Problem

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

## Proposed Solution

Implement three UX/data changes:

### 1. Issue List Filtering
**Change:** Issues with `status: proposal-linked` don't appear in:
- "Issues awaiting proposal" filters
- Main backlog views (by default)
- Status dashboard "open work" counts

**Implementation:**
- Add `is_consumed` derived field: `status === 'proposal-linked' && consumed_by`
- Filter queries exclude `is_consumed=true` by default
- Add filter option: "Show consumed issues" for users who want to see them grouped under proposals

### 2. Consumed Issues View
**Change:** When viewing a proposal, show consuming issues clearly:
- Display as a section: "Addressed by this proposal"
- List issue titles + links (wikilinks)
- Mark with badge: "Consumed by this proposal"
- Allow user to view issue detail without leaving proposal

**Implementation:**
- Parse `consumed_by` field to find proposal
- Query inverse: find all issues with `consumed_by: this-proposal`
- Render issue list in proposal view with backlink badges

### 3. Status Dashboard Update
**Change:** Metrics should reflect consumed vs. unconsumed only:
- "Issues awaiting proposal" count excludes `proposal-linked` with `consumed_by`
- "Active issues" count only counts truly independent work
- Add metric: "Issues in flight (via proposals)" — issues addressed but not yet implemented

**Implementation:**
- Update status page aggregation logic
- Filter: `status !== 'proposal-linked' || !consumed_by` for open counts
- Add data point showing how many open issues are bundled into proposals

## Workflow Clarity

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

## Implementation Phases

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

## Testing

- [ ] Issue with `status: proposal-linked` and `consumed_by: proposals/X` does not appear in main issue list
- [ ] "Show consumed issues" filter reveals grouped consumed issues
- [ ] Proposal view shows all consuming issues clearly
- [ ] Status dashboard counts don't include consumed issues
- [ ] "Issues in flight" metric shows correct count
- [ ] Can still search for consumed issues directly

## Success Criteria

- Consumed issues are hidden from "awaiting processing" views by default
- Proposal clearly shows which issues it addresses
- Status dashboard metrics reflect only unconsumed work
- Users cannot be confused about workflow state

## Future

- Apply same pattern to other "consuming" relationships (plan consuming proposals, etc.)
- Batch operations: "mark all issues in this proposal as X"
- Proposal detail: estimated effort, risk rollup from consuming issues
