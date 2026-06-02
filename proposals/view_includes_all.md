---
title: View includes all — file tree mode toggle
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - ux
  - file-tree
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

The left sidebar file tree filters to markdown files only. There's no way to
see non-markdown files or toggle between views like "all files" vs. "docs only".

## Proposed Solution

Add a mode toggle at the top of the sidebar that switches the file tree view:

- **Docs** (default) — shows only `.md` files and their directories
- **All files** — shows every file in the repo (excluding node_modules, .git, etc.)

## UX

- Dropdown or segmented control at the top of the sidebar, above the file tree
- Mode persists for the session (not saved)
- Non-markdown files open raw in the browser (or show a "binary file" message)
