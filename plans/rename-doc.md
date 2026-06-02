---
title: "Inline document rename"
status: approved
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - sidebar
  - crud
proposal_source:
  - proposals/approved/ux-cant-rename-a-doc.md
priority: medium
automated: off
assigned_to: NetYeti
scenario_synthesis: "UI prototype only — no automation scripts or deployment steps"
---

## Overview

Add inline rename to the file tree sidebar. Double-click a filename to edit
it in-place; on confirm, a new API endpoint performs a `git mv` on disk and
navigates to the new URL.

Small, self-contained plan. Touches `FileTree.svelte`, the server API, and
the page router.

## Tasks

### 1. API endpoint — POST /api/rename

- Accepts `{ from: string, to: string }` (relative paths from vault root)
- Validates: both paths within vault, `to` does not already exist (409 if so),
  `from` exists (404 if not)
- Runs `git mv <from> <to>` — preserves file history
- Returns `{ path: string }` (the new path) on success
- Error responses: 400 bad request, 404 not found, 409 conflict

### 2. Inline rename in FileTree.svelte

- Double-click on a filename node enters rename mode: replace the label with
  an `<input>` pre-filled with the current filename (without extension)
- Enter → submit; Escape → cancel with no change
- On submit, call `POST /api/rename`; on success navigate to new path and
  refresh the file tree via SSE (already in place)
- On 409, show a toast error: "A file with that name already exists"
- Append the original extension automatically (user renames stem only)

### 3. Right-click context menu (stub)

- Right-clicking a sidebar item shows a minimal context menu: Rename, Delete
- Rename triggers the same inline edit as double-click
- Delete wires to the existing delete flow
- This stubs the context menu component for future expansion (New File,
  New Folder, Move)

### 4. Tests / verification

- Rename succeeds: file moved on disk, history preserved (`git log --follow`)
- URL updates in browser after rename
- 409 shown when target name already exists
- Escape cancels with no change
- Extension preserved correctly
