---
complexity: low
title: "UI — Full-Text Vault Search"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - search
  - improvements
approved: true
deferred: false
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/ui-settings-activity-bar.md
consumed_by: plans/completed/phase-2-ui-polish-bundle.md
---

## Problem

There is no way to search vault document content from the Web UI. Finding a
document requires knowing its path or browsing the file tree. For large vaults,
this becomes a serious usability problem.

## Proposed Solution

A search panel in the activity bar (🔍 slot) powered by a full-text search
backend. Candidate backend: `tobi/qmd` (already listed in NOTICE.md as an
attribution). The panel provides:
- Keyword search across all vault `.md` files
- Results grouped by document type (proposals, plans, policies)
- Preview snippet with match highlighted
- Click to navigate

## Deferred Because

Requires integrating a search backend. The activity bar slot is reserved
for it. Vault navigation by file tree is sufficient for launch.
See [[proposals/approved/ui-settings-activity-bar.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from settings-activity-bar proposal | NetYeti |
