---
title: Enhance roadplan view — surface pending approvals and open PRs
status: draft
author: NetYeti
created: 2026-07-08
tags:
  - ui
  - workflow
  - roadmap
proposal_source: proposals/approved/enhance-roadplan-pending-work-visibility.md
priority: high
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/enhance-roadplan-pending-work-visibility.md
---

# Enhance roadplan view — surface pending approvals and open PRs

## Overview

Delivers the approved proposal [[proposals/approved/enhance-roadplan-pending-work-visibility.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

```
| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Awaiting Approval section | Build dashboard section listing draft-status plans with title, author, milestone, and Approve gate button | ⏳ Pending |
| 2 | Open PRs section | Build dashboard section showing plans with open PRs including title, PR number, and review/CI/merge-ready status | ⏳ Pending |
| 3 | Action Items section | Build dashboard section for tracked issues and proposals needing triage or scope-check with title, status, and priority | ⏳ Pending |
```

## Testing Plan

### Step Verification
- [ ] **Awaiting Approval section**: Load the roadplan view with a plan in `draft` status — verify a distinct visual section appears showing title, author, milestone, and an enabled "Approve" button
- [ ] **Open PRs section**: Load the roadplan view where a plan has an associated open pull request — verify a distinct section shows the plan title, PR number, and a status badge (review / CI / merge-ready)
- [ ] **Action Items section**: Load the roadplan view with tracked issues that are untriaged — verify a distinct section shows the issue title, current status, and priority indicator

### Integration & Regression
- [ ] `npm test` passes with no regressions
- [ ] `npm run typecheck` passes without errors
- [ ] Existing roadplan sections (e.g., timeline, milestones) remain unchanged and functional when the new sections are collapsed/hidden
- [ ] Empty state: each new section renders a sensible "nothing to show" message when no items match (no plans awaiting approval, no open PRs, no action items)
- [ ] Responsive layout: the three new sections stack correctly on narrow viewports without horizontal overflow

### Gate Criteria
- [ ] All three Step Verification checkboxes are passing
- [ ] All Integration & Regression checkboxes are passing
- [ ] Manual visual review confirms the three sections are visually distinct from one another and from existing roadplan content (different background, border, or heading style as specified in the design)
- [ ] Approve button in the Awaiting Approval section triggers the correct lifecycle transition (e.g., `update_plan_status`) and the plan disappears from the section on refresh
- [ ] PR status badges reflect real-time data from the linked pull request (or gracefully degrade to a static "open" badge if the API is unreachable)

## Rollback Procedures

| Scenario | Rollback |
|---|---|
| **Step 1**: Wrong plan approved or incorrect milestone shown | Revert the approval gate — move plan back to `draft` status via `update_plan_status(name, 'draft')` and correct the milestone field |
| **Step 2**: Open PR merged with failing CI or unreviewed | Revert the merge via `git revert <sha>` on the target branch, push, and close/reopen the PR with `--draft` |
| **Step 3**: Issue-action item linked to wrong plan or wrong priority set | Unlink via `link_step_issue` with empty issue number or use `set_plan_field` to reset priority; re-triage in the tracking board |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Visual clutter overwhelms users with three new sections | Medium | Medium | Collapse sections by default with expand-to-reveal; persist per-user state |
| Stale or inaccurate PR/approval status misleads users | High | High | Real-time query from canonical source; stale-data indicator + manual refresh button |
| Users bypass the approve gate via direct plan-file edits | Low | High | Mutations gated through MCP tools only; plan file write hook blocks bypass attempts |
| Query latency degrades when loading many plans with cross-references | Low | Medium | Server-side pagination (20 per section); cache PR status for 60s; skeleton loading |
| Permissions mismatch — user sees Approve button they cannot use | Medium | Low | Hide action buttons when user lacks Forgejo team membership; grey out with tooltip explaining why |
| Section labels create confusion (draft vs awaiting-approval semantics) | Medium | Low | Tooltip on section header linking to the approval-flow SOP; onboarding walkthrough prompt |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-08 | Created from approved proposal | NetYeti |
