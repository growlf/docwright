---
complexity: low
title: "UI — Resizable Panels"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - panels
  - improvements
deferred: true
deferred_reason: "Fixed widths are fine for launch. Resize handles add complexity and drag state management. Post-launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/ui-sidebar-consistency.md
---

## Problem

The left sidebar (260px) and right panel (280px) are fixed widths. Power
users with wide monitors want more content visible; users on small laptops
want more content area.

## Proposed Solution

Drag handles on the inner edge of each panel to resize them. Width
persisted in `localStorage` per panel. Min/max clamped to reasonable
bounds (left: 180px–400px, right: 220px–400px). Double-click handle
resets to default width.

## Deferred Because

Fixed widths work well for the launch use case. Resize handles require
drag state management and pointer event handling that adds meaningful
complexity. See [[proposals/ui-sidebar-consistency.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from sidebar-consistency proposal | NetYeti |
