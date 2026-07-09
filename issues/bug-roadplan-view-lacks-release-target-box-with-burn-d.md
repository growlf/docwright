---
title: Roadplan view lacks release-target box with burn-down and sub-component visibility
status: resolved
created: 2026-07-08
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-08]
part_of: plans/release-v0.5.0.md
consumed_by: plans/enhance-roadplan-pending-work-visibility.md
milestone: future
channel: dev
tags:
  - reported-bug
---

# Roadplan view lacks release-target box with burn-down and sub-component visibility

## Description

The roadplan view should show a prominent "Current release target: v0.5" box at the top, with the release plan linked for easy reference. Below that, a "Next Release Target" section should list sub-components (bugs, proposals, plans) that are part of the release, with a burn-down showing progress toward completion. This makes the graph view more useful and gives at-a-glance release status.

Specifically:
- "Current release target: v0.5" banner linking to plans/release-v0.5.0.md
- Sub-component list showing each item's status (done/pending)
- Burn-down visualization (e.g. N of M items completed)
- Items with `part_of: plans/...` should automatically appear in this view
- Clicking an item navigates to it

Discovered during v0.5.0 release planning.

## System Info

None provided
