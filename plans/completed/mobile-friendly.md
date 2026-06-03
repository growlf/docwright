---
title: "Mobile-friendly and responsive layout"
status: completed
completed_date: 2026-06-03
author: NetYeti
created: 2026-06-03
tags:
  - webui
  - ux
  - responsive
  - layout
proposal_source: proposals/approved/mobile-friendly.md
priority: medium
automated: off
assigned_to: NetYeti
scenario_synthesis: "UI prototype only — pure CSS and Svelte state; no shell commands or deployment steps"
---

## Overview

Make the Web UI usable at three screen sizes using CSS media queries and
a sidebar overlay pattern. Desktop behaviour is unchanged. No JS framework
changes required beyond a small Svelte boolean for mobile sidebar state.

Breakpoints:
- **Mobile** (≤ 768px): sidebar hidden behind hamburger, properties pane hidden
- **Tablet** (769–1024px): sidebar collapses to icon strip, pane narrows to 220px
- **Desktop** (> 1024px): current behaviour unchanged

## Tasks

### 1. Global reset and viewport

`app.html` already has the `<meta name="viewport">` tag. Confirm `box-sizing:
border-box` is applied globally (already done). No changes needed.

### 2. Mobile sidebar overlay (`+layout.svelte`)

Add `sidebarOpen` boolean state (defaults `false` on mobile, irrelevant on
desktop). A hamburger button `☰` appears in a sticky top bar at ≤ 768px.

```css
@media (max-width: 768px) {
  #sidebar {
    position: fixed; left: -260px; top: 0; height: 100vh;
    transition: left 0.2s ease; z-index: 200;
  }
  #sidebar.open { left: 0; }

  /* Scrim behind open sidebar */
  .sidebar-scrim {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    z-index: 199;
  }
  .sidebar-scrim.visible { display: block; }

  /* Top bar with hamburger */
  .mobile-topbar {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; background: #111;
    border-bottom: 1px solid #222; position: sticky; top: 0; z-index: 100;
  }
}

@media (min-width: 769px) {
  .mobile-topbar { display: none; }
  .sidebar-scrim  { display: none !important; }
}
```

- Tapping the scrim or navigating to a document closes the sidebar
- `sidebarOpen` resets to `false` whenever `$page.url` changes (use `$effect`)

### 3. Tablet sidebar icon strip (`+layout.svelte`)

```css
@media (min-width: 769px) and (max-width: 1024px) {
  #sidebar { width: 48px; min-width: 48px; overflow: hidden; }
  #sidebar:hover { width: 260px; }
  .sidebar-header h1,
  .new-btn span,
  .project-name,
  .project-profile { display: none; }
}
```

File tree dir/file labels are hidden at 48px — only folder icons and the first
character are visible. Hover expands the sidebar to full width.

### 4. Properties pane on mobile (`+page.svelte`, `PropertiesPane.svelte`)

At ≤ 768px, the properties pane becomes a full-screen bottom sheet:
- Hidden by default; a floating `⊞ Props` button in the bottom-right reveals it
- The pane overlays content (`position: fixed; bottom: 0; left: 0; right: 0;
  height: 60vh; border-radius: 12px 12px 0 0`)
- Dismiss via a close button or swipe-down affordance (tap outside)
- `padding-right` adjustments in `page-body.pane-open` are removed at ≤ 768px

```css
@media (max-width: 768px) {
  .pane {
    position: fixed; bottom: 0; left: 0; right: 0; top: auto;
    width: 100% !important; height: 60vh;
    border-radius: 12px 12px 0 0; border-left: none;
    border-top: 1px solid #2a2a2a;
  }
  .page-body.pane-open,
  .page-body.pane-collapsed { padding-right: 32px; } /* reset — pane no longer on right */
}
```

At 769–1024px: pane width 220px instead of 280px (update the CSS variable or
override the fixed width).

### 5. Toolbar overflow on mobile (`+page.svelte`)

At ≤ 768px, the toolbar action row wraps. Fix with a `⋮` overflow toggle that
hides secondary buttons (Delete, props toggle) behind a dropdown:

```css
@media (max-width: 768px) {
  .toolbar { flex-wrap: wrap; gap: 4px; }
  .btn.del, .btn.props-toggle { display: none; }
  /* Shown only when overflow menu is open */
}
```

Simple implementation: add `showOverflow` boolean; `⋮` button toggles it;
overflow panel shows the hidden buttons absolutely positioned below the toolbar.

### 6. Touch target sizing

Audit all interactive elements and ensure min 44×44px tap targets:
- Sidebar file links: add `min-height: 44px; display: flex; align-items: center`
  at ≤ 768px (currently 3px padding = ~19px height)
- Mode-toggle, Save, Cancel buttons: add `min-height: 44px; padding: 10px 16px`
  at ≤ 768px
- Git panel action buttons: `min-height: 44px` at ≤ 768px

### 7. Tests / verification

- Mobile (375px): sidebar hidden, hamburger visible, tap opens/closes sidebar,
  scrim dismisses it, content fills full width
- Mobile: properties pane appears as bottom sheet, dismiss works
- Mobile: toolbar doesn't wrap; overflow menu shows secondary actions
- Tablet (900px): sidebar shows icon strip, hover expands to full width
- Desktop (1440px): no change from current behaviour
- Touch targets: all interactive elements ≥ 44px tall on mobile viewport
