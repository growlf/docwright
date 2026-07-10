---
title: Governance panel: Status stat tiles aren't clickable — no drill-in to proposals
status: resolved
resolved: 2026-07-09
created: 2026-07-05
category: feature
part_of: plans/release-v0.5.0.md
priority: high
tags: []
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as feature / high.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 113
assigned_to: []
created_by: NetYeti@host
---

Found dogfooding 2026-07-02. In the Governance panel's **Status** subview (`src/webui/src/lib/GovernancePanel.svelte:138-155`), the four stat tiles (Active Plans / Open Proposals / Pending Approval / Completed) are display-only `<div>`s. Only **Active Plans** has a clickable drill-down list beneath the grid (line ~159-168).

So a user who sees "Open Proposals: N" or "Pending Approval: 4" **can't click the tile to see those items** from the Status view — the clickable proposal list only exists in the separate **Lifecycle** subview. Users expect to click a count and see what's behind it.

## Acceptance criteria
- [x] Clicking a Status stat tile drills into its items (navigate to the Lifecycle subview filtered to that set, or expand a list inline like Active Plans does).
- [x] Consistent behavior across all four tiles.
- [x] Keyboard/button semantics (the tiles become real buttons/links).

## Resolution (2026-07-09)

Already fixed by earlier merged work — all four tiles are real `<button>` elements wired to `bridge()?.navigate(...)`. Confirmed live via Playwright: clicking "Awaiting Plan" navigates to `/status?section=approved-pending` and expands the matching filtered section. Tracked under `plans/improve-bug-feature-reporting-tool.md` (Wave C, Step 5).
