---
complexity: low
title: "Offline and PWA Support"
author: NetYeti
created: 2026-06-03
tags:
  - mobile
  - pwa
  - offline
  - improvements
approved: false
deferred: true
deferred_reason: "Offline support requires a service worker strategy and conflict resolution with git as canonical store. Revisit after launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/mobile-friendly.md
---

## Problem

DocWright's Web UI requires a live server connection. Mobile contributors
working in low-connectivity environments (field work, travel) cannot access
or edit vault documents when offline. There is no Progressive Web App (PWA)
manifest, no service worker, and no offline cache.

## Proposed Solution

Add PWA support so DocWright can be installed as a home screen app on mobile
devices and function in offline or degraded-connectivity conditions:

- `manifest.json` with app name, icons, theme colour
- Service worker for asset caching and offline shell
- Read-only offline mode: cached documents readable without server connection
- Optional: offline edit queue that syncs when connectivity resumes, with
  conflict detection against git HEAD

The offline edit queue is the hard part — edits made offline must be reconciled
with any changes that landed in the git repo while disconnected. This requires
a merge/conflict strategy that is safe for non-developer contributors.

A simpler first milestone is read-only offline access (no edit queue), which
delivers significant value for field contributors at much lower complexity.

## Deferred Because

Offline edit conflict resolution is a non-trivial problem given git as the
canonical store. Read-only offline is achievable sooner but still requires
a service worker architecture that is out of scope for the initial release.
See [[proposals/approved/mobile-friendly.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from mobile-friendly proposal | NetYeti |
