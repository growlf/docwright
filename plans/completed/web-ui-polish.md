---
title: Web UI polish — create experience, WYSIWYG editing, folder operations
status: completed
completed_date: 2026-06-02
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - ux
  - editing
  - crud
proposal_source: proposals/approved/web-ui-polish.md
priority: high
automated: guided
assigned_to: NetYeti
---

## Overview

Polish the Web UI CRUD experience: better file/folder creation from the tree,
3-mode editor toggle (preview / WYSIWYG / source), and delete feedback with
toast notifications.

## Tasks

### 1. In-tree file and folder creation
- Add "+" icon on hover over each directory in the sidebar
- Right-click context menu on directories → "New File" / "New Folder"
- Inline rename for newly created files (untitled.md → user types name)
- API: POST /api/mkdir for folder creation

### 2. 3-mode editor toggle
- Preview (read-only rendered markdown, default)
- Edit (WYSIWYG contenteditable div with formatting toolbar)
- Source (raw textarea with markdown)
- Cycle button in toolbar toggles between modes
- Toolbar buttons: bold, italic, heading H1-H3, link, list, code

### 3. Delete UX improvements
- Toast notification confirming deletion
- Undo option for git-tracked files (git restore)
- Show file path prominently in confirmation dialog

