---
complexity: medium
title: UI — Theming and Customization System
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - theming
  - white-label
  - css
  - phase-1
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/ui-white-label-brand-settings.md
  - docs/customization.md
_path: proposals/ui-theming-system.md
consumed_by: plans/completed/phase-2-ui-polish-bundle.md
---

## Problem

DocWright's visual style is hardcoded throughout its component CSS — hex
colours, font sizes, spacing values scattered across dozens of `<style>`
blocks. There is no mechanism for an organization to apply a house style,
match their brand palette, or change the look and feel without modifying
source code.

## Proposed Solution

A two-phase theming system:

### Phase A — Drop-in CSS override (implemented now)

A `brand/theme.css` file in the vault root is loaded after all DocWright
styles, giving it full cascade priority. Organizations can override any
class, add fonts, change colours — anything CSS can do.

```
vault-root/
  brand/
    theme.css       ← loaded automatically if present
    logo.svg        ← existing logo support
  brand.json
```

This works immediately. The trade-off: the theme author must know
DocWright's internal CSS class names, which are implementation details
that can change between versions.

### Phase B — CSS custom properties foundation (deferred)

Refactor all DocWright color, spacing, and typography constants into CSS
custom properties on `:root`. A theme file then only needs to override
variables — no knowledge of internal class names required, and the theme
stays stable across DocWright updates.

Target variable set:
```css
:root {
  --dw-bg:           #111;
  --dw-bg-elevated:  #161616;
  --dw-bg-hover:     #1c1c1c;
  --dw-border:       #222;
  --dw-border-subtle:#1a1a1a;
  --dw-text:         #e8e8e8;
  --dw-text-muted:   #aaa;
  --dw-text-dim:     #555;
  --dw-accent:       #58a6ff;
  --dw-accent-bg:    #0d1f2d;
  --dw-success:      #6d6;
  --dw-warn:         #cc6;
  --dw-danger:       #e44;
  --dw-radius:       4px;
  --dw-font:         system-ui, sans-serif;
  --dw-font-mono:    monospace;
}
```

A theme that inverts to a light mode would only need:
```css
:root {
  --dw-bg: #f8f8f8;
  --dw-text: #111;
  /* etc. */
}
```

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| In-app theme picker / live preview | Needs settings panel (activity bar) | [[proposals/ui-theme-picker.md]] |
| Theme marketplace / sharing | Post-launch | Post-launch |
| Per-document themes | Out of scope entirely | — |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — Phase A implemented same session | NetYeti |
