---
title: "Document properties pane — frontmatter form and new-proposal flow"
status: approved
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - ux
  - frontmatter
  - proposals
proposal_source:
  - proposals/approved/ui-document-properties-pane.md
  - proposals/approved/ux-new-proposal.md
  - proposals/approved/core-classifying-proposals-when-created-or-updating.md
priority: high
automated: off
assigned_to: NetYeti
scenario_synthesis: "UI prototype only — no automation scripts, shell commands, or deployment steps in this plan"
---

## Overview

Build the right-hand properties pane that surfaces frontmatter as a live form,
wire up document-type-aware action buttons, extend the proposal schema with
classification fields, and deliver a guided new-proposal creation flow.

Groundwork already in `+page.svelte`: `showProps`, `docType`, `rebuildRaw`,
`saveFrontmatter`, `approveProposal`. The plan builds the visible UI on top.

## Tasks

### 1. Properties pane component

Create `src/webui/src/lib/PropertiesPane.svelte`:

- Fixed 280px right panel, collapsible via a toggle button at top-right of
  content area; collapsed state in `sessionStorage`
- Receives `frontmatter` object and `docType` as props; emits `change` events
- **Read mode**: display-only — render each field as labelled text
- **WYSIWYG mode**: editable form inputs per field type (see below)
- **Source mode**: hidden entirely

Field types:
| Frontmatter key | Input type |
|-----------------|------------|
| `title` | text input |
| `author`, `assigned_to` | text input (future: autocomplete from contributors) |
| `created`, `due_date` | date input |
| `tags`, `category` | chip multi-select |
| `status`, `complexity`, `estimated_effort`, `automated` | dropdown |
| `approved` | checkbox |

### 2. Action buttons (document-type-aware)

Rendered at the top of the pane, above the form fields:

- **Proposals**: Approve (sets `approved: true`, warns if `assigned_to` empty),
  Reject (sets `approved: false`, prompts for `rejection_reason`)
- **Plans**: Start (`status: in-progress`), Complete (`status: completed`),
  Cancel (`status: canceled`, prompts for `cancellation_reason`)
- **All**: Save (calls `saveFrontmatter`, shows toast)

Button visibility gated on `docType` and current field values (e.g. Approve
hidden if `approved` is already true).

### 3. Proposal schema — classification fields

Add to proposal frontmatter template and `org-operations` schema:
```yaml
category: []          # multi-value chip select from profile proposalCategories
complexity: ""        # XS | S | M | L | XL
estimated_effort: ""  # XS | S | M | L | XL
```

Add to `org-operations/profile.json`:
```json
"proposalCategories": ["UI", "UX", "ENGINE", "DATA"]
```

### 4. New-proposal flow

- "New Proposal" button in sidebar toolbar (distinct from generic "+" for any file)
- Click → modal prompts for slug/filename only → creates file from template →
  opens immediately in WYSIWYG mode with properties pane expanded
- Required-but-empty fields (`title`, `category`) are visually flagged in the pane
- Pick-lists: `assigned_to` from `.docwright/contributors.json` if present,
  fallback to git log authors; `category` from profile config
- On save: if `title` is empty or matches template default, show toast warning

### 5. Tests / verification

- Pane renders in read mode (display only), hides in source mode
- Approve button: sets frontmatter, shows toast, disables itself after
- New proposal: file created, WYSIWYG opens, pane expanded, required fields flagged
- Classification fields: save correctly to frontmatter YAML
- Collapse/expand: state survives navigation within session
