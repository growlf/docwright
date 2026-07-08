---
type: issue
status: proposal-linked
consumed_by: proposals/hide-consumed-issues-from-backlog.md
created: 2026-07-07
author: NetYeti
author-role: user
category: design
priority: high
complexity: medium
estimated_effort: M
tags: [workflow, ux, process]
reported_dates: [2026-07-07]
demand_count: 1
triage_date: 2026-07-07
triage_by: NetYeti
triage_notes: Triaged as high-priority design gap. Blocks process viability.
scope_check_date: 2026-07-07
scope_check_by: NetYeti
scope_assessment: Process gap discovered during dogfooding consumed-issues workflow.
scope_decision: in-scope
assigned_to: []
created_by: NetYeti@cluster-llm
channel: dev
---

# Design: Consumed issues should not appear as awaiting processing

## Problem

When issues are bundled into a proposal (marked `status: proposal-linked` with `consumed_by: proposals/...`), they should not appear in:
- "Issues awaiting proposal" views
- Backlog/inbox lists
- Status dashboards showing "open work"

Currently, a proposal that consumes issues #177 and #178 leaves those issues visible in the issue list as if they still require independent processing. This creates confusion:

1. **User sees duplicate work** — issue list shows #177, #178 as "open" but they're actually handled by the proposal
2. **Workflow ambiguity** — unclear if the next step is to process the issue or the proposal
3. **Clutter** — consumed issues should be grouped under their proposal, not scattered in backlog

## Impact

The workflow is incomplete and untestable without fixing this:
- Consumed issues make the backlog appear larger than it is
- Users don't know which work item to focus on (issue or proposal?)
- Process viability can't be verified while consumed issues remain visible as open

## Current State

Issues bundled into a proposal are marked:
```yaml
status: proposal-linked
consumed_by: proposals/improve-bug-feature-report-dialog.md
```

But display/filtering logic doesn't hide them from "awaiting processing" views.

## Design Goal

**Consumed issues should be hidden from independent work views but visible when viewing the proposal.**

1. **Issue list**: Consumed issues don't appear, or appear grayed out in a "consumed by proposal X" section
2. **Proposal view**: Shows consuming issues clearly (backlinks)
3. **Status dashboard**: Only counts unconsumed issues in "awaiting processing"
4. **Search**: Consumed issues still findable but marked as "handled by proposal X"

## Workaround (until fixed)

When bundling issues into a proposal:
1. Mark issues as `status: proposal-linked`
2. Add `consumed_by: proposals/...` field
3. Manually verify that issues appear grouped under their proposal
4. Trust the `consumed_by` field as source of truth

## Notes

This design issue itself should be resolved through the standard workflow (issue → proposal → plan) to dogfood the process and reveal other gaps.
