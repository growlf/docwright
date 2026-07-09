---
title: Enhance roadplan view — surface pending approvals, open PRs, release-target box, and release criteria visibility
status: in-progress
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
tests_defined: true
tests_human_reviewed: false
part_of: plans/release-v0.5.0.md
related_to:
  - issues/ui-roadplan-pending-work-visibility.md
  - issues/bug-roadplan-view-lacks-release-target-box-with-burn-d.md
  - issues/UX-release-criteria-visibility.md
_path: plans/enhance-roadplan-pending-work-visibility.md
total_steps: 5
completed_steps: 5
---

# Enhance roadplan view — surface pending approvals, open PRs, release-target box, and release criteria visibility

## Overview

Implements Steps 0a, 0b, and 0h of `plans/release-v0.5.0.md` — three new roadplan dashboard sections, a release-target banner with burn-down, and per-criterion status badges on release checks.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | **Awaiting Approval section** | Build dashboard section listing draft-status plans with title, author, milestone, and Approve gate button | ✅ Done |
| 2 | **Open PRs section** | Build dashboard section showing plans with open PRs including title, PR number, and review/CI/merge-ready status | ✅ Done |
| 3 | **Action Items section** | Build dashboard section for tracked issues and proposals needing triage or scope-check with title, status, and priority | ✅ Done |
| 4 | **Release-target box with burn-down** | Build "Current release target: v0.5" banner at top of roadplan linking to the release plan, with sub-component list and N-of-M completed burn-down. Items with `part_of: plans/release-v0.5.0.md` appear automatically. | ✅ Done |
| 5 | **Release criteria visibility** | Show per-criterion status badges (✅/❌) alongside the release criteria summary, list blockers explicitly ("Release blocked by: Dogfood (3 days), Burn-down (need 5% more)"), and link to unresolved items | ✅ Done |

## Testing Plan

### Step Verification
- [ ] **Awaiting Approval section**: Load the roadplan view with a plan in `draft` status — verify a distinct visual section appears showing title, author, milestone, and an enabled "Approve" button
- [ ] **Open PRs section**: Load the roadplan view where a plan has an associated open pull request — verify a distinct section shows the plan title, PR number, and a status badge (review / CI / merge-ready)
- [ ] **Action Items section**: Load the roadplan view with tracked issues that are untriaged — verify a distinct section shows the issue title, current status, and priority indicator
- [ ] **Release-target box**: Load the roadplan view when a plan exists with `part_of` — verify a banner shows at top listing sub-items with status and N-of-M completed
- [ ] **Release criteria visibility**: Load a plan with pending release criteria — verify per-criterion status badges ✅/❌ and explicit blocker list instead of a generic "1/2 done"

### Integration & Regression
- [ ] `npm test` passes with no regressions
- [ ] `npm run typecheck` passes without errors
- [ ] Existing roadplan sections remain unchanged when new sections are collapsed
- [ ] Empty state: each section renders "nothing to show" when no items match
- [ ] Responsive layout: sections stack correctly on narrow viewports
- [ ] Stale-data indicator + manual refresh button on PR/approval status

### Gate Criteria
- [ ] All Step Verification checkboxes passing
- [ ] All Integration & Regression checkboxes passing
- [ ] Manual visual review confirms sections are visually distinct
- [ ] Approve button triggers correct lifecycle transition
- [ ] Release-target box reads `part_of` frontmatter and burn-down is accurate
- [ ] Release criteria shows per-item status badges and actionable blocker text

## Rollback Procedures

| Scenario | Rollback |
|---|---|
| Steps 1-5 fail in staging | Revert individual PRs; each step is independently reviewable |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Visual clutter with 5 new sections | Medium | Medium | Collapse sections by default; persist per-user state |
| Stale PR/approval status misleads users | High | High | Real-time query; stale-data indicator + refresh button |
| Release-target burn-down drifts from plan state | Medium | Low | Derived from live frontmatter — no stale cache |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-08 | Created from approved proposal | NetYeti |
| 2026-07-08 | Bundled Step 0h (release-target box) from release plan | NetYeti |
| 2026-07-08 | Bundled Step 0b (release criteria visibility) from release plan | NetYeti |
| 2026-07-09 | Step 2 completed — Open PRs section with CI/review/merge status from gh pr list | NetYeti |
