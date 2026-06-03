---
title: "Mobile-friendly and responsive layout"
author: NetYeti
created: 2026-06-03
tags:
  - ux
  - ui
  - responsive
  - layout
category:
  - UX
  - UI
complexity: M
estimated_effort: M
depends_on: []
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---
## Problem

The site does not render usably on a mobile device. The fixed-width sidebar
(260px), fixed-width properties pane (280px), and non-responsive content area
leave no room for content on small screens.

**Note:** The specific sub-issue of the center pane not expanding when the
right-hand pane is collapsed has been fixed as a bug (commit bc471db+). This
proposal covers the remaining responsive design work.

## Proposed Solution

Make the layout adapt gracefully across screen sizes without breaking the
desktop experience.

**Breakpoint: ≤ 768px (mobile)**

- **Sidebar**: hidden by default; revealed via a hamburger/menu button in a
  top bar. Slides in as an overlay (not pushing content), dismisses on tap
  outside or on navigation.
- **Properties pane**: hidden by default on mobile; accessible via a bottom
  sheet or a floating "Properties" button. Full-screen modal on small viewports.
- **Content area**: full viewport width when both side panels are hidden.
- **Toolbar**: collapses mode-toggle and secondary actions into a `⋮` overflow
  menu to avoid wrapping.
- **Touch targets**: all interactive elements (buttons, file links, toggles)
  meet 44×44px minimum touch target size.

**Breakpoint: 769–1024px (tablet)**

- Sidebar collapses to icon-only strip (showing just folder icons); expands
  on tap/hover.
- Properties pane uses 220px width instead of 280px.
- Content area fills remaining space.

**Desktop (> 1024px)**: current behaviour unchanged.

**Implementation approach:**
- CSS media queries in `+layout.svelte` (sidebar) and `+page.svelte` (pane padding)
- Sidebar overlay: `position: fixed; left: -260px` sliding to `left: 0` on open
- No JS framework changes needed — pure CSS + a small Svelte boolean for open state
- `viewport` meta tag already present in `app.html`

**Out of scope for this proposal:**
- WYSIWYG editing on mobile (contenteditable is unreliable on iOS — deferred)
- Offline/PWA support
