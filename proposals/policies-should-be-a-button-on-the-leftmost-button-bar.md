---
title: Policies UI Navigation — Dedicated Button and Browsing Area
author: NetYeti
created: 2026-06-06
tags:
  - ui
  - policies
  - navigation
  - organization
complexity: low
estimated_effort: S
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
_path: proposals/policies-should-be-a-button-on-the-leftmost-button-bar.md
---
## Problem

Policies documents are currently mixed into the general document tree with no dedicated navigation or categorization. There is no way to browse policies as a curated group, sort them into a hierarchy, or quickly distinguish them from other document types. Finding a specific policy requires manual searching through the full list.

## Proposed Solution

Add a dedicated "Policies" button to the leftmost button bar (the primary navigation strip) that opens a standalone policy browsing area. This area provides:

*   **Categorized listing** — policies grouped by domain or category (e.g., Security, Workflow, Governance)
*   **Sorted hierarchy** — tree or accordion view showing parent/child relationships
*   **Quick search** — filter policies by title, tag, or category
*   **Visual indicator** — badge or icon on the button showing policy count

The button should appear on the main navigation bar alongside existing buttons (documents, plans, etc.), consistent with the established UI pattern. The policy browsing area uses the same document viewer component but pre-filtered to policy-type documents.

## Relationship to Existing Work

| Related | Relationship |
| --- | --- |
| \[\[proposals/ui-sidebar-consistency.md\]\] | Navigation consistency patterns apply |
| \[\[proposals/tags-more-useful-to-humans.md\]\] | Tag-based categorization feeds policy sorting |
| \[\[proposals/policies/core-classifying-proposals-when-created-or-updating.md\]\] | Classification fields determine what qualifies as a policy |

## Out of Scope

| Idea | Why deferred |
| --- | --- |
| Policy editor with custom fields | Simple viewing/navigation first; editing follows in Phase 2 |
| Policy lifecycle states (draft/review/active) | Tied to broader governance lifecycle — propose separately |
| Automatic policy extraction from document content | Requires content classification engine — Phase 3+ |