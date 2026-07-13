---
title: Enhance roadplan view — surface pending approvals and open PRs
author: NetYeti
created: 2026-07-06
tags:
  - ui
  - workflow
  - roadmap
category:
  - feature
  - ux
complexity: medium
priority: high
approved: true
created_by: NetYeti@cluster-llm
author-role: governance
assigned_to: NetYeti
related_to:
  - https://github.com/growlf/docwright/issues/395
  - proposals/approved/ui-git-controlls.md
depends_on: []
blocks: []
_path: proposals/approved/enhance-roadplan-pending-work-visibility
consumed_by: plans/enhance-roadplan-pending-work-visibility.md
---

# Enhance roadplan view — surface pending approvals and open PRs

## Problem Statement

The roadplan view shows timeline and milestones well, but **hides the work that needs immediate attention**:

1. Plans awaiting approval are invisible (buried in the roadmap)
2. Plans with open PRs are indistinguishable from unstarted work
3. Users must manually search files to find what needs review
4. This breaks the workflow, especially at session start

**Impact:** Reduced efficiency, higher context-switching cost, easy to forget approval-blocking work.

## Proposed Solution

Add three dedicated sections to the roadplan view, visually distinct and positioned prominently:

### 1. **Awaiting Approval** (Red/Alert)
Plans in `status: draft` waiting for approval gate. Blocks progression to approved/in-progress.
- Shows: Title, author, milestone, "Approve" button/link
- Count badge at top

### 2. **Open PRs** (Yellow/Attention)  
Plans with open pull requests (linked via git branch or plan frontmatter). Blocks merging to main.
- Shows: Title, PR number, status (review, CI, merge-ready)
- Count badge at top

### 3. **Action Items** (Blue/Info)
Issues/proposals that are part of this plan's workflow (in `tracked_by` list, awaiting triage/scope-check).
- Shows: Issue title, status, priority
- Helps driver see what needs attention at the plan level

## Why This Matters

**Before:** "Which plans need my attention?" → Manual search
**After:** "Which plans need my attention?" → Glance at roadplan, see highlighted sections

## Design Notes

- Sections appear at **top of each milestone** (or as a separate "Pending" band)
- Use **color/badge** to distinguish from normal roadmap items
- **No new data required**; use existing state (status, PR API, linked issues)
- **Performance**: Pre-compute during roadplan load, cache for the session
- **Optional**: Add a "Show pending only" toggle to collapse roadmap and focus on action items

## Out of Scope (Future)

- Notification/alert system (desktop, email)
- Session-start integration (can be added after MVP)
- Custom filtering UI (can be added as enhancement)

## Success Criteria

- [ ] Roadplan shows awaiting-approval plans prominently
- [ ] Roadplan shows plans with open PRs visually distinct
- [ ] Works for all milestones
- [ ] No performance regression
- [ ] User can approve/navigate to PR from roadplan
- [ ] Tested with 5+ plans across different states

## Rollout

This is a **UI-only enhancement** (no schema/data changes). Can ship as soon as design is ready.

---

**Outcome:** Users see at a glance what needs approval or review, unblocking the workflow. Roadplan becomes the single view for understanding plan timeline *and* what's blocking progress.
