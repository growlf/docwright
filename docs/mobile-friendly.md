---
title: Mobile-friendly and responsive layout
status: completed
completed_date: 2026-06-03
author: NetYeti
created: 2026-06-03
tags:
  - webui
  - ux
  - responsive
  - layout
---

## Summary

Made the Web UI responsive across mobile (≤ 768px), tablet (769–1024px), and
desktop (> 1024px). Desktop behaviour unchanged.

## What was built

- **Mobile sidebar**: hidden behind hamburger, slides in as overlay, scrim
  dismisses on tap, auto-closes on navigation
- **Tablet sidebar**: collapses to 48px icon strip, expands on hover
- **Properties pane**: bottom sheet at ≤ 768px (60vh, rounded corners),
  220px narrow pane at tablet widths
- **Toolbar**: compact layout at mobile, overflow menu for secondary actions
- **Touch targets**: all interactive elements ≥ 44px at mobile viewport

## Source proposal

- `proposals/approved/mobile-friendly.md`
