---
title: Approval — Assigned-To Picklist
author: NetYeti
created: 2026-06-03
tags: []
category: []
complexity: ""
estimated_effort: ""
depends_on: []
approved: true
created_by: NetYeti@phoenix
assigned_to: ""
_path: proposals/approval-need-assigned-to-picklist.md
consumed_by: plans/completed/properties-pane.md
---
## Problem

Approving a proposal should not prompt with an open text field only - there should be a picklist from existing (known good) targets. Ultimately, this will need to be a managed list from a user management system (a later proposal that probably needs to be added.

## Proposed Solution

Replace the open text prompt for `assigned_to` on approval with a picklist:

1. **Source order** — populate from: (a) known contributors derived from git log
   authors across the vault, (b) `.docwright/contributors.json` if present,
   (c) existing frontmatter `author` and `assigned_to` values across all documents.
2. **Filter-as-you-type** — the picklist supports keyboard filtering so the user
   can type to narrow or enter a new name not in the list.
3. **Integration** — when `contributor-name-autocomplete` is built, this picklist
   reuses the same data source and component.

See [[proposals/contributor-name-autocomplete.md]] for the broader autocomplete
system this would integrate with.