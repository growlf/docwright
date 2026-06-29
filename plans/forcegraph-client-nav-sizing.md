---
title: Fix ForceGraph Node Pile-Up on Client-Side Navigation
status: active
author: NetYeti
created: 2026-06-29
tags: bug, forcegraph, knowledge-graph, navigation, ux
proposal_source: proposals/approved/forcegraph-client-nav-sizing.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
_path: plans/forcegraph-client-nav-sizing.md
related_to:
  - proposals/approved/forcegraph-client-nav-sizing.md
---

# Fix ForceGraph Node Pile-Up on Client-Side Navigation

## Overview

When navigating to `/status` via SvelteKit client-side routing (e.g. from the Governance Engine VC "Open full dashboard →" button), the ForceGraph rendered with all nodes piled at the center and connector lines disconnected. Hard navigation worked correctly.

**Root cause — two issues, both fixed:**

**1. Fallback dimensions (v0.4.1 — `ForceGraph.svelte`):** `buildGraph()` fell back to `|| 900` / `|| 540` when `getBoundingClientRect()` returned 0 during client-side navigation. This seeded nodes at `(450, 270)` while the canvas had different actual dimensions.

**2. Svelte `$state` proxy / d3 mutation loop (this plan — `KnowledgeGraph.svelte`):** `rawEdges` was declared `$state`, making it a deep reactive proxy. D3's `forceLink` mutates edge objects (string ID → node reference) during simulation init. Svelte's proxy intercepted each write, invalidated `forceEdges`, and re-fired the `$effect` in `ForceGraph` that calls `buildGraph()`. This killed the simulation before nodes could spread from center. The lines/connectors appeared permanently piled at center because every simulation run was stopped by the reactive cascade triggered by d3's own mutations.

**Fixes:** `ForceGraph.svelte` (v0.4.1) + `KnowledgeGraph.svelte` (this plan, step 3 below).

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Remove fallback dimensions from `buildGraph()` | Replaced `const w = rect.width \|\| 900, h = rect.height \|\| 540` with `const w = rect.width, h = rect.height` + early return `if (w < 10 \|\| h < 10) return`. ResizeObserver handles re-triggering once layout settles — the fallback was bypassing that safety mechanism. | ✅ Done (v0.4.1) |
| 2 | Add `afterNavigate` hook | After SvelteKit client-side navigation, a `requestAnimationFrame` re-triggers `buildGraph()` once the browser has committed the layout. `afterNavigate` was already imported from `$app/navigation`. | ✅ Done (v0.4.1) |
| 3 | Break `$state` proxy chain in `KnowledgeGraph.svelte` | Changed `$derived(rawEdges as ForceEdge[])` to `$derived(rawEdges.map(e => ({ ...e }) as ForceEdge))`. This creates plain (non-proxy) copies. D3 can mutate source/target on the copies without triggering Svelte's reactive system and without restarting the simulation. | ✅ Done (this branch) |

## Testing Plan

Manual browser verification (layout-timing and reactive behavior cannot be unit-tested):

1. **Hard navigate** to `/status` → click Graph tab → nodes spread correctly, edges connected.
2. **Client-side navigate** from any page → GovernancePanel "Open full dashboard →" → graph renders correctly, no pile-up at center, lines connect nodes properly.
3. **Browser back/forward** through `/status` → graph renders correctly on each visit.
4. **Resize window** while on `/status` graph view → ResizeObserver re-triggers, graph re-renders to fit.
5. **Filter toggles** → toggling node type checkboxes rebuilds graph correctly; lines remain connected to their nodes.
6. **Refresh** (↻ button in graph sidebar) → graph reloads data and re-renders correctly.

## Rollback Procedures

- Revert `KnowledgeGraph.svelte` step 3: restore `$derived(rawEdges as ForceEdge[])`.
- Revert `ForceGraph.svelte` steps 1–2: restore `|| 900`/`|| 540` fallbacks; remove `afterNavigate` block.

## Risk Assessment

**Low.** The KnowledgeGraph change only affects how edge objects are passed to ForceGraph — the data is identical, just in plain objects instead of reactive proxies. No logic change. The ForceGraph change removes a fallback that was actively causing the bug; the ResizeObserver already handles the recovery path.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Created from approved proposal | NetYeti |
| 2026-06-29 | Revised: actual root cause identified — $state proxy / d3 mutation loop in KnowledgeGraph.svelte | NetYeti |
