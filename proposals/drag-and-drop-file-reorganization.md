---
complexity: low
title: "Drag-and-Drop File Reorganization"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - file-tree
  - ux
  - improvements
approved: false
deferred: true
deferred_reason: "Non-trivial UX: moving files must handle wikilink updates and git rename tracking. Revisit after wikilink backref updating is implemented."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/web-ui-polish.md
  - proposals/wikilink-backref-update-on-rename.md
---

## Problem

Reorganizing the vault's directory structure requires using the terminal or a
file manager outside the DocWright UI. There is no way to move files between
directories in the Web UI, making structural tidying — moving a completed
proposal to an archive folder, reorganising a category — unnecessarily
friction-heavy.

## Proposed Solution

Drag-and-drop file moving in the file tree sidebar:

- Drag a file node onto a directory node to move it
- The move is performed via `git mv` so history is preserved
- On drop, trigger the same wikilink back-reference update as a rename
  (all `[[path]]` references in the vault updated to reflect the new path)
- Visual feedback during drag (highlight valid drop targets)
- Toast notification on success with git-undo option (consistent with
  existing CRUD operations)
- Disallow moves that would break lifecycle rules (e.g. moving an active
  plan out of `plans/` into an unrecognised directory) — warn, require
  confirmation

## Deferred Because

File moves must update all wikilinks pointing to the moved file, which
depends on the vault-wide backlink index (Phase 3). Without it, moves silently
break cross-references.
See [[proposals/wikilink-backref-update-on-rename.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from web-ui-polish proposal | NetYeti |
