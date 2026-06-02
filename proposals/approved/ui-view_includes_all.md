---
title: "View includes all — file tree mode toggle"
author: NetYeti
created: 2026-06-02
tags:
  - ui
  - sidebar
  - file-tree
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
---
## Problem

The left sidebar file tree filters to markdown files only. There's no way to
see non-markdown files or toggle between views like "all files" vs. "docs only".

I also don't need to see core meta-files like AGENTS.md, CHANGELOG.md, etc. by
default — I want to be able to see them, but only intentionally when needed.

I want a clean, streamlined documentation interface in the left-hand pane that
does not restrict my viewing access.

## Proposed Solution

Add a mode toggle at the top of the sidebar that switches the file tree view:

- **Docs** (default) — shows only `.md` files and their directories, excluding
  hidden directories (see `ux-hide-old-cycle-docs`) and root-level meta-files
  (AGENTS.md, CHANGELOG.md, CONTRIBUTING.md, etc.)
- **All files** — shows every file in the repo (excluding `node_modules`, `.git`,
  and other entries in `.gitignore`). Overrides the hidden-directory filter.

## UX

- Segmented control or dropdown at the top of the sidebar, above the file tree
- Mode persists for the session in `sessionStorage` (not saved to disk)
- Non-markdown files in "All files" mode open raw in the browser, or show a
  "binary / non-text file" placeholder message
- Root-level meta-files (AGENTS.md etc.) are accessible in "All files" mode
  but excluded from "Docs" mode via a configurable `sidebarExcludePatterns`
  list in `profile.json`
