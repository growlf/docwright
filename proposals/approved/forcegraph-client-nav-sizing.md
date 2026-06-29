---
title: Fix ForceGraph Node Pile-Up on Client-Side Navigation
author: NetYeti
created: 2026-06-28
tags:
  - bug
  - forcegraph
  - knowledge-graph
  - navigation
  - ux
complexity: low
priority: high
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to: []
depends_on: []
blocks: []
_path: proposals/approved/forcegraph-client-nav-sizing
consumed_by: plans/forcegraph-client-nav-sizing.md
---
# Fix ForceGraph Node Pile-Up on Client-Side Navigation

## Summary

When navigating to `/status` via SvelteKit client-side routing (e.g. from the Governance Engine VC "Open full dashboard →" button, or any `bridge.navigate('/status')` call), the ForceGraph renders with all nodes piled at the center and connector lines disconnected. Hard navigation to `/status` works correctly.

## Problem Statement

`ForceGraph.svelte` calls `canvasEl.getBoundingClientRect()` during `buildGraph()` to measure the canvas dimensions. During client-side navigation, the layout hasn't fully settled when `buildGraph()` first runs, so `getBoundingClientRect()` returns `width: 0, height: 0`.

The old code fell back to fixed dimensions `|| 900` and `|| 540`:

```javascript
const w = rect.width || 900, h = rect.height || 540;
```

This means nodes seed at `(450, 270)` — the center of the 900×540 fallback — but the SVG is sized to those fallback dimensions while the canvas div has different actual dimensions. The simulation runs correctly within the fallback space but renders at the wrong position within the visible viewport. All edges appear disconnected because source and target node positions are measured against different coordinate spaces.

The GovernancePanel UI refactor (Phase 4) introduced the "Open full dashboard →" link that navigates client-side. This exposed the pre-existing timing bug.

## Proposed Solution

Two-part fix:

**1\. Remove the fallback dimensions.** If `getBoundingClientRect()` returns 0, return early instead of falling back. The `ResizeObserver` already handles re-triggering once the layout settles — the fallback bypassed this safety mechanism.

```javascript
const w = rect.width, h = rect.height;
if (w < 10 || h < 10) return; // ResizeObserver or afterNavigate will re-trigger
```

**2\. Add `afterNavigate` hook.** After any SvelteKit client-side navigation that renders the ForceGraph, a `requestAnimationFrame` re-triggers `buildGraph()` once the browser has committed the new layout:

```javascript
afterNavigate(() => {
  if (!ready || !svgEl || !canvasEl) return;
  requestAnimationFrame(() => buildGraph());
});
```

Together these ensure: (a) buildGraph never runs against a stale 0px measurement, and (b) after client-side navigation it always re-measures once the layout is stable.

## Expected Outcomes

*   ForceGraph renders correctly after client-side navigation to `/status`
*   Hard navigation continues to work (ResizeObserver path unchanged)
*   No visual change on correctly-sized initial renders
*   Fix is contained to `ForceGraph.svelte` — no other components changed

## Related Documents

*   `plans/ui-layout-view-container-refactor.md` — introduced GovernancePanel navigation
*   `src/webui/src/lib/ForceGraph.svelte` — fix applied here