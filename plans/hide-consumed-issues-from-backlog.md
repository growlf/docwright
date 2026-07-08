---
title: Hide consumed issues from backlog — fix workflow visibility
status: draft
author: NetYeti
created: 2026-07-07
tags:
  - webui
  - ux
  - workflow
  - issue-management
proposal_source: proposals/approved/hide-consumed-issues-from-backlog.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/hide-consumed-issues-from-backlog.md
---

# Hide consumed issues from backlog — fix workflow visibility

## Overview

Delivers the approved proposal [[proposals/approved/hide-consumed-issues-from-backlog.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1.1 | Add is_consumed computed field | Extend the issue schema with a computed `is_consumed` field derived from `consumed_by` presence | ⏳ Pending |
| 1.2 | Filter consumed issues by default | Update issue list queries to exclude consumed issues unless the filter is overridden | ⏳ Pending |
| 1.3 | Add show consumed filter toggle | Add a UI toggle in the issue list to optionally include consumed issues | ⏳ Pending |
| 2.1 | Parse consumed_by from issues | Extract and normalize `consumed_by` references from issue frontmatter or metadata | ⏳ Pending |
| 2.2 | Render Addressed by section | Render an "Addressed by this proposal" section in the proposal detail view | ⏳ Pending |
| 2.3 | Add backlink badges | Display backlink badges linking from proposal view to consumed issues | ⏳ Pending |
| 3.1 | Exclude from awaiting counts | Update status dashboard to exclude consumed issues from "awaiting" aggregation counts | ⏳ Pending |
| 3.2 | Add Issues in flight metric | Add a new dashboard metric showing total non-consumed open issues | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] **Step 1 (Consumed field + filtered queries):** Open backlog view — verify consumed issues are hidden by default; toggle "show consumed" — verify they appear; confirm computed field persists across pagination
- [ ] **Step 2 (Proposal consumed-by section):** Open a proposal with consumed issues — verify "Addressed by this proposal" renders each issue as a backlink badge with correct title and status
- [ ] **Step 3 (Dashboard counts):** Confirm "awaiting" (open/unassigned) counts exclude consumed issues; verify "Issues in flight" metric appears and matches count of consumed-but-open issues

### Integration & Regression

- [ ] `npm test` / `npm run test` passes with no regressions
- [ ] `npm run typecheck` passes with no type errors
- [ ] "Show consumed" toggle state persists across page navigation (sessionStorage or URL param)
- [ ] Issue detail page still renders correctly for consumed issues (not just backlog)
- [ ] Existing "unconsumed" issue behavior is unchanged — no false positives in unconsumed filtering

### Gate Criteria

- [ ] All three step-verification tests pass in a live environment
- [ ] No regression in backlog load time (profile before/after — accept < 5% degradation)
- [ ] Consumed issue indicator does not leak into any user-facing count that shows "total open issues"
- [ ] Toggle default state is "hide consumed" and is documented in the UI
- [ ] `is_consumed` computation handles edge cases: null `consumed_by`, malformed proposal refs, self-referencing cycles

## Rollback Procedures

| Scenario | Rollback |
|---|---|---|
| `is_consumed` computed field breaks issue list or "show consumed" toggle malfunctions | Remove `is_consumed` from the schema/model, revert issue list query changes, and delete the filter toggle component |
| `consumed_by` parsing fails or "Addressed by this proposal" section renders incorrectly | Remove `consumed_by` field parsing logic, delete the proposal view section and backlink badge renderer |
| Status dashboard aggregation miscounts or "Issues in flight" metric is wrong | Revert aggregation query to include all issues in "awaiting" counts, remove the "Issues in flight" metric and its data source |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing integrations break because consumed issues vanish from default queries | Medium | High | Add `show_consumed=false` as opt-in param (not silent filter); deprecate old behavior over one release cycle |
| `is_consumed` computed field causes query latency on repos with >10k issues | Medium | Medium | Cache the computed field as a materialized column; add index on `consumed_by`; benchmark before ship |
| Users don't notice the filter toggle and think issues are lost/deleted | High | Medium | Show a persistent banner: _"X issues hidden (consumed by proposals)"_ with a link to toggle; include tooltip on toggle |
| Malformed or stale `consumed_by` references cause false negatives in filtering | Low | High | Validate `consumed_by` format at write time; reject PRs with unresolvable proposal IDs; scheduled reconcile job flags orphans |
| "Issues in flight" metric double-counts issues linked to multiple proposals | Low | Medium | Enforce unique `consumed_by` at the application layer; reject duplicate consumption on save |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-07 | Created from approved proposal | NetYeti |
