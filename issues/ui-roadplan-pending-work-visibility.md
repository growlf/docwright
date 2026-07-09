---
title: Roadplan view lacks visibility for pending approvals and PRs
status: triaged
author: NetYeti
author-role: governance
created: 2026-07-06
created_by: NetYeti@cluster-llm
category: ux
part_of: plans/release-v0.5.0.md
consumed_by: plans/enhance-roadplan-pending-work-visibility.md
priority: high
complexity: M
estimated_effort: M
triage_date: 2026-07-06
triage_by: NetYeti
triage_notes: Critical UX gap blocking workflow. Currently must manually search files to find plans awaiting approval or with open PRs. Roadplan view should prominently surface these states as a dedicated section or feature.
tags:
  - ui
  - workflow
  - visibility
channel: dev
---

# Roadplan view lacks visibility for pending approvals and PRs

## Problem

Plans awaiting approval or with open PRs are invisible in the UI. User must manually:
- Grep through files
- Scroll through `/status` list view and parse everything
- Search by branch to find related PRs

This blocks efficient workflow when juggling multiple plans across different lifecycle stages.

## Where It Hurts

- Session start: No quick way to see "what needs my attention right now"
- Mid-session: Easy to forget that Plan X is waiting for approval
- Reviewing work: Can't see at a glance which plans have PRs open
- Context switching: Have to remember which plans are in which state

## Proposed Solution

**Enhance roadplan view** (preferred over list view) with dedicated sections:

- **Section: Awaiting Approval** — plans with `status: draft` or `status: approved` (ready for human approval gate)
- **Section: Open PRs** — plans with `status: approved` or `status: in-progress` that have linked open pull requests
- **Section: Action Items** — issues/proposals awaiting triage or scope-check (part of this plan's tracked_by)

Make these visually distinct (color, icon, position) so they draw attention during scrolling.

## Acceptance Criteria

- [ ] Roadplan view includes dedicated "Awaiting Approval" section
- [ ] Roadplan view includes dedicated "Open PRs" section  
- [ ] Sections list plans that meet the criteria (above)
- [ ] Sections are visually prominent (color, badge, icon)
- [ ] Works for both active and future milestones
- [ ] Performance: doesn't slow roadplan load (use existing data)
- [ ] Session start can call this feature to show at beginning

## Why Roadplan (Not List)

List view is a flat inventory. Roadplan already shows timeline/milestone structure, making it ideal for surfacing work that's *blocking the timeline*. Approval/PR visibility makes the roadmap actionable.

## Technical Notes

- Use existing plan state: `status`, `tracked_by` (for linked issues/PRs), PR API
- No new data required; is a presentation/filtering question
- Could piggyback on existing roadplan component structure
- Consider adding a badge count at the top ("4 awaiting approval")
