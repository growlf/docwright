---
title: "Hide completed cycle directories by default"
author: NetYeti
created: 2026-06-02
tags:
  - ux
  - sidebar
  - file-tree
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
subsumed_by: sidebar-polish
consumed_by: plans/completed/sidebar-polish.md
---
## Problem

By default I don't want to see the `proposals/approved/` directory or the
`plans/completed/` folder — they add unnecessary clutter to the sidebar when
I'm doing active work. They should be accessible intentionally, not always visible.

## Proposed Solution

Introduce a **hidden-by-default directories** list to the file tree. On initial
load, `proposals/approved/` and `plans/completed/` are filtered out of the tree.

- A subtle "Show archived" toggle (eye icon or text link) at the bottom of the
  sidebar reveals them inline without a page reload.
- When the sidebar is in "All files" mode (from `ui-view_includes_all`), hidden
  directories are always shown — the all-files mode overrides the filter.
- The hidden list defaults are defined in `profile.json` under a new
  `hiddenDirectories` key so each profile can set its own defaults. The
  `org-operations` default: `["proposals/approved", "plans/completed"]`.
- The "show archived" state persists for the session in `sessionStorage`.

No API changes required — filtering is client-side in `FileTree.svelte`.
