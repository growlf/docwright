---
title: "Governance panel: Status stat tiles aren't clickable — no drill-in to proposals"
status: open
github_issue: 113
category: feature
priority: high
tags:
  - github-issue
  - issue-workflow
  - enhancement
created: 2026-07-05
created_by: "NetYeti@host"
assigned_to: ""
milestone: future
---

Found dogfooding 2026-07-02. In the Governance panel's **Status** subview (`src/webui/src/lib/GovernancePanel.svelte:138-155`), the four stat tiles (Active Plans / Open Proposals / Pending Approval / Completed) are display-only `<div>`s. Only **Active Plans** has a clickable drill-down list beneath the grid (line ~159-168).

So a user who sees "Open Proposals: N" or "Pending Approval: 4" **can't click the tile to see those items** from the Status view — the clickable proposal list only exists in the separate **Lifecycle** subview. Users expect to click a count and see what's behind it.

## Acceptance criteria
- [ ] Clicking a Status stat tile drills into its items (navigate to the Lifecycle subview filtered to that set, or expand a list inline like Active Plans does).
- [ ] Consistent behavior across all four tiles.
- [ ] Keyboard/button semantics (the tiles become real buttons/links).
