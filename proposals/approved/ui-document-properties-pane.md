---
title: "Document Properties Pane"
author: NetYeti
created: 2026-06-02
tags:
  - ui
  - properties
  - frontmatter
  - wysiwyg
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
consumed_by: plans/completed/properties-pane.md
---
## Problem

The frontmatter of a document is only accessible in source mode. There is no
way to approve a proposal, change a status field, or assign a document without
switching to raw YAML — which breaks the intended low-friction workflow for
non-developer contributors.

## Proposed Solution

A **right-hand properties pane** that surfaces frontmatter as a structured form,
visible alongside the document content.

**Behaviour by editor mode:**
- **Read mode** — pane is visible, display-only (no inputs). Shows key fields at a glance.
- **WYSIWYG mode** — pane is a live form. Changes write back to frontmatter on save.
- **Source mode** — pane is hidden (user is editing raw YAML directly).

**Form fields rendered from frontmatter:**
- Text inputs for `title`, `author`, `assigned_to`
- Date picker for `created`, `due_date`
- Tag chip editor for `tags`, `category`
- Dropdowns for `status`, `complexity`, `estimated_effort`, `automated`
- Checkbox for `approved`

**Action buttons (document-type-aware):**
- Proposals: **Approve** (sets `approved: true`, prompts for `assigned_to` if empty),
  **Reject** (sets `approved: false`, adds `rejection_reason`)
- Plans: **Start** (sets `status: in-progress`), **Complete**, **Cancel**
- All: **Save** (commits frontmatter changes without touching body)

The pane width is fixed at ~280px and collapsible. The toggle button sits at the
top-right of the content area. Collapsed state persists in `sessionStorage`.

**Implementation note:** the groundwork (`showProps`, `rebuildRaw`, `saveFrontmatter`,
`approveProposal`) is already scaffolded in `+page.svelte`. The plan is to build
the pane component on top of that foundation.
