---
title: "Deferred: Lifecycle Graph — Phase View Mode"
author: NetYeti
author-role: contributor
created: 2026-06-29
tags:
  - ui
  - graph
  - lifecycle
  - visualization
  - phase-3
complexity: medium
estimated_effort: M
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - plans/completed/lifecycle-graph.md
  - plans/phase-4-profile-acl-ai.md
deferred_reason: "Requires Phase 3 backlink index. Deferred from lifecycle-graph.md Step 6."
---

## Problem

The funnel view shows lifecycle stage but not project phase. Teams running multi-phase projects want to see which phase a proposal or plan belongs to at a glance — grouping by `phase:` frontmatter within each swimlane.

## Proposed Solution

Add a phase grouping mode to `FunnelView.svelte`:

1. Add a "Group by phase" toggle to the filter bar
2. Within each swimlane, render phase sub-headers (Phase 1, Phase 2, …, Unassigned) based on the `phase:` frontmatter field
3. Sort phase groups numerically; unassigned items fall to the bottom
4. Requires the backlink index to efficiently resolve phase membership across large vaults

## Gate Condition

Phase 3 backlink index must be available (`_backlinks.json` or equivalent). Do not start before Phase 3 ships.

## Out of Scope

- Cross-swimlane phase grouping (e.g. "show only Phase 4 items across all stages") — that belongs to the dependency graph view
- Editing phase from the funnel view
