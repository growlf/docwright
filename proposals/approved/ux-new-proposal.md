---
title: "New proposal workflow and UI"
author: NetYeti
created: 2026-06-02
tags:
  - ux
  - proposals
  - forms
  - wysiwyg
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
subsumed_by: properties-pane
consumed_by: plans/completed/web-ui-polish.md
---
## Problem

Creating a new proposal requires manually editing raw frontmatter and knowing
which fields are required. There is no guided form, no pick-lists, and no
enforcement that required fields are completed before the proposal is saved.
The result is incomplete proposals that stall in triage.

## Proposed Solution

A **guided new-proposal flow** triggered by a prominent "New Proposal" button
in the sidebar or toolbar.

**First-time creation:**
1. User clicks "New Proposal"
2. A modal or inline panel prompts for a filename/slug (the only required step
   before the file is created)
3. The file is created from the profile's proposal template with pre-populated
   defaults (`author`, `created`, `created_by`, `approved: false`)
4. The editor opens immediately in WYSIWYG mode — no extra click
5. The **properties pane** is open by default and highlighted, prompting the
   user to fill in `title`, `category`, `complexity`, and `assigned_to` before
   writing the body. Required-but-empty fields are visually flagged.

**Subsequent editing:**
- The main pane shows the rendered document body
- The properties pane (right side) shows the frontmatter form
- Same experience as any other document in WYSIWYG mode

**Pick-lists:**
- `assigned_to`: populated from the vault's known contributors
  (read from git log authors + `.docwright/contributors.json` if present)
- `category`: from `profile.json` → `proposalCategories`
- `complexity` / `estimated_effort`: XS / S / M / L / XL

**Validation on save:**
- If `title` is empty or still the template default, show a toast warning
- If `category` is empty, show a non-blocking nudge (not a hard block)

This proposal depends on `ui-document-properties-pane` being built first.
