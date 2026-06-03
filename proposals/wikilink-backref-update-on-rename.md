---
complexity: medium
title: "Wikilink Back-Reference Updating on Rename"
author: NetYeti
created: 2026-06-03
tags:
  - wikilinks
  - rename
  - dispatch
  - improvements
deferred: true
deferred_reason: "Requires vault-wide wikilink index (dispatch module, Phase 3). Revisit after backlink index is implemented."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/ux-cant-rename-a-doc.md
  - plans/phase-3-profile-acl-ai.md
---

## Problem

When a document is renamed, any other document that wikilinks to it using
`[[old-path]]` is silently broken. The rename operation updates the file on
disk but does not update references elsewhere in the vault. Contributors
discover broken links organically, which is a poor experience and a governance
risk for policy and decision documents that are heavily cross-referenced.

## Proposed Solution

When a document is renamed via the Web UI (or the dispatch module), scan the
vault for all wikilinks pointing to the old path and update them to the new
path as part of the same atomic git commit:

1. Read `_backlinks.json` (or the wikilink index) to find all documents
   referencing the old path
2. For each referencing document, replace `[[old-path]]` → `[[new-path]]`
   (preserving any alias or section anchor: `[[old-path|alias]]` →
   `[[new-path|alias]]`)
3. Stage all modified files alongside the renamed file
4. Commit as a single atomic operation with a message noting the cascade

The rename API endpoint (`/api/rename`) is extended to accept an
`update_backlinks: true` parameter. The Web UI rename dialog gets a checkbox:
"Update all wikilinks in vault" (default: on).

## Deferred Because

Depends on the vault-wide backlink index (`_backlinks.json`) being implemented
in the dispatch module. Without the index, a vault-wide scan on every rename
is too slow for large vaults.
See [[plans/phase-3-profile-acl-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from rename-doc proposal | NetYeti |
