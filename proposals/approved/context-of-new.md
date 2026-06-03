---
title: "Context-aware new item action in the file tree"
author: NetYeti
created: 2026-06-03
tags:
  - ux
  - sidebar
  - file-tree
category:
  - UX
  - UI
complexity: S
estimated_effort: S
depends_on: []
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
subsumed_by: sidebar-polish
---
## Problem

The "+" button in the sidebar header opens a generic menu (New File / New
Proposal). But when a user is browsing the `proposals/` directory, the intent
is almost always to create a new proposal — not a generic file. The menu adds
friction where none is needed, and it is easy to forget to navigate to the
right folder first.

The same applies to other lifecycle directories: clicking "+" next to `plans/`
should guide the user toward creating a plan, not open a blank file prompt.

## Proposed Solution

Give the "+" affordance in the file tree directory context: hovering any
directory in the sidebar reveals a small "+" icon on that row. Clicking it
performs the default action for that directory type rather than a generic menu:

| Directory | Default action |
|-----------|---------------|
| `proposals/` | New Proposal flow (title prompt → template → WYSIWYG + pane open) |
| `plans/` | New Plan (prompt for title, creates plan stub) |
| `docs/` | New Doc (generic markdown file) |
| `policies/` | New Policy (policy frontmatter template) |
| Any other dir | Generic New File (current behaviour) |

The directory-type mapping comes from `profile.json` (`documentTypes` and
directory conventions) so it is profile-driven and not hardcoded.

The existing "+" button in the sidebar header remains as a global shortcut
that opens the full menu for users who want to create in an arbitrary location.

**UX detail:** the directory row "+" appears on hover only, styled to match
the existing hover affordance in `DirNode.svelte`. No persistent icons cluttering
the tree.

This folds into the sidebar-polish plan as an additional task alongside the
view-mode toggle and hidden-directories work.
