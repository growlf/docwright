---
title: Web UI polish — create experience, WYSIWYG editing, folder operations
status: approved
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
WYSIWYG split-pane editor, and delete feedback with toast notifications.

## Tasks

### 1. In-tree file and folder creation
- Add "+" icon on hover over each directory in the sidebar
- Right-click context menu on directories → "New File" / "New Folder"
- Inline rename for newly created files (untitled.md → user types name)
- API: POST /api/mkdir for folder creation

### 2. WYSIWYG split-pane editor
- Replace raw textarea with split view: markdown source (left) + live preview (right)
- Toolbar with formatting buttons (bold, italic, heading H1-H3, link, list, code)
- Raw markdown toggle for power users
- Keyboard shortcuts for toolbar actions

### 3. Delete UX improvements
- Toast notification confirming deletion
- Undo option for git-tracked files (git restore)
- Show file path prominently in confirmation dialog

