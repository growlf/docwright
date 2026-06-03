---
complexity: low
title: "UI — Keyboard Shortcuts to Toggle Panels"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - keyboard
  - accessibility
  - improvements
deferred: true
deferred_reason: "Add after the unified panel system is stable. Shortcuts should be assigned once the layout is settled."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/ui-sidebar-consistency.md
---

## Problem

Opening and closing the left sidebar and right panel requires a mouse click
on the toggle strip or button. Power users expect keyboard shortcuts
(e.g. VS Code uses Ctrl+B for sidebar, Ctrl+Shift+E for explorer).

## Proposed Solution

- `Ctrl+\` — toggle left sidebar
- `Ctrl+Shift+\` — toggle right panel (properties / related)
- Shown as hint text in the panel toggle button tooltips

Shortcuts are configurable in a future keybindings system.

## Deferred Because

Shortcuts should be assigned after the unified panel layout (sidebar
consistency proposal) is complete — the current mixed implementation
would mean shortcuts behave differently depending on which component is
active. See [[proposals/ui-sidebar-consistency.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from sidebar-consistency proposal | NetYeti |
