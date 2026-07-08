---
title: "Implement consumed issues visibility fix"
status: proposed
author: NetYeti
created: 2026-07-07
plan_source: proposals/hide-consumed-issues-from-backlog.md
tags:
  - webui
  - workflow
author-role: user
created_by: "claude@claude-code"
assigned_to:
  - NetYeti
---

# Implement consumed issues visibility fix

## Overview

This plan implements the proposal to hide consumed issues from backlog views and make the workflow explicit. Three implementation phases targeting data layer, proposal view, and dashboard metrics.

**Blocking issue:** Users see duplicate work when issues are bundled into proposals. Consumed issues appear in "awaiting processing" views as if they need independent handling.

**Outcome:** Consumed issues hidden from backlog by default; visible contextually under their proposal/plan.

---

## Implementation Phases

### Phase 1: Data Layer
- [ ] Add `is_consumed` computed field to issue schema in `src/dispatch/index.ts`
- [ ] Update issue list queries to filter consumed issues by default
- [ ] Add "Show consumed issues" filter toggle with localStorage persistence

### Phase 2: Proposal View
- [ ] Parse `consumed_by` field from issues on proposal load
- [ ] Add "Addressed by this proposal" section to proposal detail view
- [ ] Display consuming issues as clickable list with badges

### Phase 3: Dashboard Update
- [ ] Update status page metrics to exclude consumed from "awaiting processing"
- [ ] Add new "In flight (via proposals)" metric to show active proposal work
- [ ] Verify metrics reflect only unconsumed work in backlog counts

---

## Testing Plan

- [ ] Issue with `status: proposal-linked` + `consumed_by` does not appear in main issue list
- [ ] "Show consumed issues" toggle reveals and hides consumed issues correctly
- [ ] Proposal view displays consuming issues in dedicated section
- [ ] Status dashboard "Open issues" count excludes consumed issues
- [ ] "In flight" metric shows correct count of proposal-bundled issues
- [ ] Consumed issues remain searchable via search bar

---

## Success Criteria

- Consumed issues hidden from "awaiting processing" views by default
- Proposal clearly shows which issues it addresses
- Status dashboard metrics accurate and unambiguous
- Workflow state is explicit and unconfusing

---

## Gate Criteria

- [x] Design issue created and triaged
- [x] Proposal written with implementation phases
- [x] Plan created with concrete tasks
- [x] Testing plan documented
- [x] Success criteria defined
