---
title: Web UI Polish
status: completed
completed_date: 2026-06-02
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - ux
  - editing
  - crud
---

# Web UI Polish

UX improvements for the SvelteKit Web UI CRUD experience.

## Delivered

### In-tree file/folder creation
- "+" button on hover over any directory
- Right-click context menu on directories: "New File" / "New Folder"
- Inline rename input on create (autofocused, Enter confirms, Escape cancels)
- `POST /api/mkdir` for folder creation

### 3-mode editor toggle
- **Preview** — rendered markdown (default, auto-reloads on SSE filechange)
- **Edit** — contenteditable WYSIWYG div with formatting toolbar (bold, italic, H1-H3, lists, link, code)
- **Source** — raw textarea with full frontmatter
- Cycle button in toolbar toggles between modes

### Delete UX
- Confirmation dialog with file path
- Toast notification on delete with "Undo" button (5 second window)
- `POST /api/restore` — calls `git restore <path>` in the repo
- Auto-redirect to home after toast expires

### Project registry
- `.docwright/` directory scaffold with gitignore
- `src/dispatch/registry.ts` — load, save, list, update
- `GET /api/registry` endpoint
- Project list displayed in sidebar
- `docwright-project` skill for agent-based vault switching

### Proposal creation system
- `docwright-proposal` skill for agent-based creation
- "New Proposal" button in sidebar "+" dropdown menu
- Auto-generates frontmatter template

## Commits

- 7c98bc6 feat: add delete toast notifications with git undo
- 9154a77 feat: add proposal templating system (skill + UI button)
- 238df0c feat: add 3-mode editor toggle (preview/WYSIWYG/source)
- abe4095 feat: add in-tree file/folder creation with context menu (draft)
- 6314ae5 feat: add docwright-project skill for vault switching
- 29ecf7b feat: add project registry API and sidebar display
- a9df997 feat: add dispatch registry module
- e14df5b feat: promote project-registry to approved, create plan
