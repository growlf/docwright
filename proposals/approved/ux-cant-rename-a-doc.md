---
title: "UX: Can't rename a doc"
author: NetYeti
created: 2026-06-02
tags:
  - ux
  - sidebar
  - crud
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
---
## Problem

I cannot rename a document. There is no affordance in the sidebar or the document view to change a file's name once it has been created.

## Proposed Solution

**Inline rename in the sidebar** — double-click a filename in the file tree to replace it with an editable input field. Press Enter to confirm, Escape to cancel.

- On confirm, call a new `POST /api/rename` endpoint with `{ from, to }`. The server renames the file on disk, updates any relative wikilinks in the same directory (best-effort), and responds with the new path.
- Navigate to the new path immediately after a successful rename so the URL stays consistent.
- Also expose rename via a right-click context menu on sidebar items (same entry point as future "Delete" and "New File" actions).

**Constraints:**
- Reject names that would overwrite an existing file (return 409, show toast error).
- Rename is a `git mv` under the hood so history is preserved.
- Wikilink back-reference updating across the whole vault is deferred — that belongs in the dispatch module (Phase 2).
