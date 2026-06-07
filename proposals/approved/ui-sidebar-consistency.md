---
complexity: high
title: UI Polish — Sidebar Consistency and Unified Panel System
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - polish
  - sidebar
  - layout
  - phase-1
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/ui-sidebar-consistency.md
consumed_by: plans/completed/sidebar-polish.md
---

## Problem

DocWright has three separate panel implementations that each behave
differently, creating a haphazard feel that undermines confidence for new
users:

**Left sidebar** (file tree)
- Desktop: inline layout element, collapses to a narrow hover-peek strip
- Mobile: `position: fixed`, slides via `left: -260px → 0` CSS transition
- Toggle controls: `☰` in the mobile top bar, `◀` / `▶` text characters
  inside the panel header

**Right panel** (properties pane)
- Desktop: collapses by animating `width` to 32px — a shrink, not a slide
- Mobile: switches to `position: fixed; right: 0` with no scrim, no
  consistent animation
- Toggle: `⊞` character in the page toolbar, spatially disconnected from
  the panel itself

**CollationPanel** (related proposals)
- `position: fixed; top: 0; right: 0; z-index: 500` always — a full-height
  overlay regardless of viewport size
- No docking, no slide transition, no relationship to the right panel
- Feels like a toast or modal, not a panel

The result: nothing feels like it belongs to the same system. New users have
no intuition for how to open, close, or expect the panels to behave — each
one is a surprise.

The reference standard is the VS Code / OpenCode layout: clear panel
docking, consistent toggle affordances, predictable slide animations, and
sensible defaults per viewport.

## Proposed Solution

Unify all panels into a single panel system with one shared behavior model.

### Layout model

```
┌─────────┬──────────────────────────┬──────────┐
│  LEFT   │                          │  RIGHT   │
│ SIDEBAR │        CONTENT           │  PANEL   │
│  260px  │                          │  280px   │
└─────────┴──────────────────────────┴──────────┘
```

- Desktop (> 768px): both panels are **docked** — part of the layout flow,
  not overlays. Content area shrinks as panels open. Both default to open.
- Mobile (≤ 768px): both panels are **overlay** — slide in over the content
  from their respective edges, with a shared scrim behind the open panel.
  Both default to closed.

### Consistent toggle controls

Every panel has its toggle button **on the panel edge closest to the
content area** — not somewhere else in the toolbar:

- Left panel: toggle button on the right edge of the panel (or collapsed
  strip). Icon: `‹` (close) / `›` (open left panel).
- Right panel: toggle button on the left edge of the panel (or collapsed
  strip). Icon: `›` (close right) / `‹` (open right panel).
- Toolbar: retains a right-panel toggle button (`⊞`) for the case where the
  right panel is fully hidden and there is no strip to click.

All toggle icons are drawn from the **same set** — directional chevrons
(`‹`, `›`), not a mix of `☰`, `⊞`, `◀`, `▶`, `✕`.

### Consistent slide animation

All panels animate via `transform: translateX()` — not `width`, not `left`:

```css
/* Left panel */
.panel-left               { transform: translateX(0); transition: transform 0.2s ease; }
.panel-left.collapsed     { transform: translateX(-100%); }

/* Right panel */
.panel-right              { transform: translateX(0); transition: transform 0.2s ease; }
.panel-right.collapsed    { transform: translateX(100%); }
```

On desktop, collapsed panels leave a **thin strip** (32px) as a click
target to re-open — consistent between left and right. Hovering the strip
shows a peek of the panel title.

### CollationPanel — docked, not overlaid

The CollationPanel stops being `position: fixed`. It becomes a **tab within
the right panel**, toggled by the existing "Find Related" action:

- Right panel has two tabs: **Properties** (default) and **Related**
- "Find Related" switches to the Related tab and loads matches
- Closing the tab (✕ on the tab itself) returns to Properties
- On mobile, the right panel slides in as normal — CollationPanel is no
  longer a full-screen overlay

This also resolves the z-index conflict where CollationPanel (z-index 500)
was fighting the properties pane (z-index 300).

### Mobile scrim

A single shared `<div class="scrim">` handles both panels on mobile:
- Opens when either panel is open
- Clicking it closes whichever panel is open
- Left and right share the same scrim component — no duplication

### Implementation approach

1. Create `src/webui/src/lib/Panel.svelte` — a single panel component
   accepting `side: 'left' | 'right'`, `defaultOpen: boolean`, `tabs?`.
2. Refactor the left sidebar (`+layout.svelte`) to use `<Panel side="left">`.
3. Refactor the properties pane (`PropertiesPane.svelte`) to use
   `<Panel side="right">` with a "Properties" tab.
4. Move CollationPanel content into a "Related" tab on the right panel.
   Remove `position: fixed` from CollationPanel entirely.
5. Remove the mobile-specific fixed positioning from PropertiesPane — Panel
   component handles this uniformly.
6. Standardise toggle icons to chevrons throughout.

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| Resizable panels (drag to resize) | Nice but significant complexity; fixed widths are fine for launch | [[proposals/ui-resizable-panels.md]] |
| Panel state persisted per-document (right panel remembers Properties vs Related per file) | Over-engineered for now | Post-launch |
| Keyboard shortcut to toggle each panel | Good idea, add after layout is stable | [[proposals/ui-keyboard-panel-shortcuts.md]] |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — critique from Phase 1 UI review | NetYeti |
