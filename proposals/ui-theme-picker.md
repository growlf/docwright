---
complexity: low
title: "UI — In-App Theme Picker"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - theming
  - settings
  - improvements
deferred: true
deferred_reason: "Drop-in theme.css works for launch. In-app picker needs settings panel (activity bar). Post-launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/ui-theming-system.md
  - proposals/ui-settings-activity-bar.md
---

## Problem

Applying a theme requires manually placing files in the vault. There is no
in-app way to preview or switch themes.

## Proposed Solution

A Theme section in the DocWright Settings panel (activity bar → ⚙):
- List available themes (from `brand/themes/` directory)
- Live preview in an iframe
- One-click apply (copies to `brand/theme.css`)
- Upload custom theme file
- Reset to default (removes `brand/theme.css`)

## Deferred Because

Requires the activity bar / settings panel.
See [[proposals/ui-settings-activity-bar.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from theming-system proposal | NetYeti |
