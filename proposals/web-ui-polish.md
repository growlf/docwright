---
title: "Web UI polish — create experience, WYSIWYG editing, folder operations"
author: "NetYeti"
created: 2026-06-02
tags: [webui, ux, editing, crud]
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---

## Problem

The current Web UI CRUD implementation is functional but lacks polish:

1. **Creating docs** requires typing a file path manually. Users should be able to create a new file at the current directory via right-click, hover action, or an "add file here" button visible on the parent directory.

2. **Folder creation** is impossible — there's no way to create subdirectories from the UI.

3. **Editing** shows raw markdown with no formatting help. The default editor should be WYSIWYG (or at minimum a split preview), with raw markdown as an advanced option.

4. **Delete** works but gives no visual feedback or undo.

## Proposed Improvements

### File Creation
- Add a "New File" option when right-clicking a directory in the sidebar
- Show a "+" icon on hover over each directory
- Add an "add file here" button at the top of each directory listing
- Default filename: `untitled.md` with inline rename

### Folder Creation
- Right-click on any directory → "New Folder"
- Enter folder name, creates empty directory

### Editor
- Default to a split-pane view: markdown source on left, live preview on right
- Toolbar with basic formatting buttons (bold, italic, heading, link, list, code)
- Raw markdown mode toggle for power users
- Syntax-highlighted editing area

### Delete
- Toast/notification confirming deletion with option to undo (if git-tracked)
- Confirmation dialog with file path displayed

## Future Considerations

- Drag-and-drop file reorganization
- File rename (in-place editing of filename in tree)
- Template selection on create
