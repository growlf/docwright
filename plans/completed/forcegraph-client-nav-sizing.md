---
title: Fix ForceGraph Node Pile-Up on Client-Side Navigation
status: completed
completed_date: 2026-06-29
author: NetYeti
created: 2026-06-29
tags: bug, forcegraph, knowledge-graph, navigation, ux
proposal_source: proposals/approved/forcegraph-client-nav-sizing.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
_path: plans/completed/forcegraph-client-nav-sizing.md
related_to:
  - proposals/approved/forcegraph-client-nav-sizing.md
total_steps: 3
completed_steps: 3
---

# Fix ForceGraph Node Pile-Up on Client-Side Navigation

## Overview

When navigating to `/status` via SvelteKit client-side routing (e.g. from the Governance Engine VC "Open full dashboard →" button), the ForceGraph rendered with all nodes piled at the center and connector lines disconnected. Hard navigation worked correctly.

**Root cause — two issues, both fixed:**

**1. Fallback dimensions (v0.4.1 — `ForceGraph.svelte`):** `buildGraph()` fell back to fixed 900×540 dimensions when `getBoundingClientRect()` returned 0 during client-side navigation. This seeded nodes at the fallback center while the canvas had different actual dimensions.

**2. Svelte `$state` proxy / d3 mutation loop (this plan — `KnowledgeGraph.svelte`):** `rawEdges` was declared `$state`, making it a deep reactive proxy. D3's `forceLink` mutates edge objects (string ID → node reference) during simulation init. Svelte's proxy intercepted each write, invalidated `forceEdges`, and re-fired the `$effect` in `ForceGraph` that calls `buildGraph()`. This killed the simulation before nodes could spread from center.

**Fixes:** `ForceGraph.svelte` (v0.4.1) + `KnowledgeGraph.svelte` (this plan, step 3 below).

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Remove fallback dimensions from `buildGraph()` | Removed the 900/540 fallback; added early return when canvas is smaller than 10px. ResizeObserver handles re-triggering once layout settles. | ✅ Done |
| 2 | Add `afterNavigate` hook | After SvelteKit client-side navigation, a `requestAnimationFrame` re-triggers `buildGraph()` once the browser has committed the layout. `afterNavigate` was already imported from `$app/navigation`. | ✅ Done |
| 3 | Break `$state` proxy chain in `KnowledgeGraph.svelte` | Changed `$derived(rawEdges as ForceEdge[])` to `$derived(rawEdges.map(e => ({ ...e }) as ForceEdge))`. Plain-object copies let d3 mutate source/target without triggering Svelte's reactive system. | ✅ Done |

## Testing Plan

Manual browser verification (layout-timing and reactive behavior cannot be unit-tested):

1. **Hard navigate** to `/status` → click Graph tab → nodes spread correctly, edges connected.
2. **Client-side navigate** from any page → GovernancePanel "Open full dashboard →" → graph renders correctly, no pile-up at center, lines connect nodes properly.
3. **Browser back/forward** through `/status` → graph renders correctly on each visit.
4. **Resize window** while on `/status` graph view → ResizeObserver re-triggers, graph re-renders to fit.
5. **Filter toggles** → toggling node type checkboxes rebuilds graph correctly; lines remain connected.
6. **Refresh** (↻ button in graph sidebar) → graph reloads data and re-renders correctly.

### Gate Criteria

- [x] All 3 implementation steps marked done
- [x] Graph renders correctly after client-side navigation (manually verified by NetYeti 2026-06-29)
- [x] Hard navigation to `/status` unaffected
- [x] Tests passing: webui 68/68, dispatch 291/291

## Rollback Procedures

- Revert `KnowledgeGraph.svelte` step 3: restore `$derived(rawEdges as ForceEdge[])`.
- Revert `ForceGraph.svelte` steps 1–2: restore 900/540 fallbacks; remove `afterNavigate` block.

## Risk Assessment

**Low.** The KnowledgeGraph change only affects how edge objects are passed to ForceGraph — the data is identical, just in plain objects instead of reactive proxies. No logic change. The ForceGraph change removes a fallback that was actively causing the bug; the ResizeObserver already handles the recovery path.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Created from approved proposal | NetYeti |
| 2026-06-29 | Revised: actual root cause identified — $state proxy / d3 mutation loop in KnowledgeGraph.svelte | NetYeti |
| 2026-06-29 | Cleaned up step table; added Gate Criteria | NetYeti |
