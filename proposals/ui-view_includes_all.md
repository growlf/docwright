---
title: View includes all — file tree mode toggle
author: NetYeti
created: 2026-06-02
tags: 
approved: true
created_by: NetYeti@phoenix
assigned_to: ""
---
## Problem

The left sidebar file tree filters to markdown files only. There's no way to see non-markdown files or toggle between views like "all files" vs. "docs only".

  

I also don't need to see the other core files like AGENTS and CHANGELOG, etc by default. I want to be ABLE to see them, but only intentionally when needed.

  

I want a clean, streamlined documentation interface reflected in the left-hand pane - that does not restrict my viewing access.

## Proposed Solution

Add a mode toggle at the top of the sidebar that switches the file tree view:

*   **Docs** (default) — shows only `.md` files and their directories
*   **All files** — shows every file in the repo (excluding node\_modules, .git, etc.)

## UX

*   Dropdown or segmented control at the top of the sidebar, above the file tree
*   Mode persists for the session (not saved)
*   Non-markdown files open raw in the browser (or show a "binary file" message)