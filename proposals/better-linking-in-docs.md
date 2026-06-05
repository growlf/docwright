---
title: "Better Linking in Docs — Wiki-Link Standardisation and Auto-Update"
author: NetYeti
created: 2026-06-05
tags:
  - wikilinks
  - cross-reference
  - automation
  - dispatch
complexity: medium
estimated_effort: M
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

All documents across the vault should consistently use wiki-link style (`[[path/to/doc]]`) for cross-references. Currently there is no enforcement or migration tooling — some docs use full URLs, some use relative markdown links, some use wiki-links. This inconsistency breaks the auto-generated backlink index (`_backlinks.json`) and makes the vault harder to navigate.

Additionally, when a document is moved (e.g. a proposal is promoted to `proposals/approved/` or a plan is archived to `plans/completed/`), every document that wikilinks to the old path needs updating. This must be handled by code and process — not AI — because it is a mechanical operation: find and replace. Using AI for this would be slower, more expensive, and error-prone compared to direct string replacement across the vault.

## Proposed Solution

### 1. Wiki-link linting and migration tool

A migration script (`scripts/migrate-wikilinks.ts`) that:
- Scans all vault `.md` files for non-wiki-link cross-references (markdown links pointing to vault paths, bare paths, full URLs to other vault documents)
- Produces a report of files that need updating
- Optionally applies the migration: rewrites markdown links to wiki-link format where the target is another vault document
- The migration is opt-in — the contributor runs it explicitly or it runs as part of a vault maintenance workflow

Detection logic:
- `[label](/path/to/doc.md)` → `[[path/to/doc|label]]` if target is within the vault
- `[label](path/to/doc.md)` → same
- Plain markdown links to external URLs are left untouched

### 2. Auto-update backlinks on move/rename

When a document is moved or renamed via the Web UI (or the dispatch module's file operations):

- Read `_backlinks.json` to find all documents referencing the old path
- Replace `[[old-path]]` → `[[new-path]]` in each referencing document (preserving aliases: `[[old-path|alias]]` → `[[new-path|alias]]`)
- Stage all modified files alongside the moved file
- Commit as a single atomic git operation

This aligns with the deferred approach in [[proposals/wikilink-backref-update-on-rename.md]] and depends on the same backlink index being available.

### 3. Process enforcement

- **Pre-commit hook**: if a commit moves or renames a file, warn if `_backlinks.json` exists but backlinks were not updated in the same commit
- **Vault health check**: a periodic or on-demand check that reports wikilinks pointing to non-existent paths, surfaced in the status page or as a collation-style notification

### AI role

AI should not handle mechanical link updates. Its role is limited to:
- Suggesting wiki-link conversions when reviewing or improving a document (as part of `critiqueDocument()`)
- Flagging broken wikilinks in AI-assisted review
- Helping draft the initial migration configuration

The mechanical find-and-replace is always done by code.

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/wikilink-backref-update-on-rename.md]] | Covers backref update on rename — this proposal is broader: standardisation + migration + enforcement |
| [[proposals/approved/ux-cant-rename-a-doc.md]] | Rename flow in Web UI — backref update integrates here |
| `_backlinks.json` (dispatch module, Phase 3) | Required dependency for auto-update; linting/migration can work without it |
| Pre-commit hooks | Enforcement hook for move/rename validation |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-convert all existing vault links in one pass | Migration script is opt-in; bulk conversion could break external references |
| AI-powered link suggestion ("did you mean to link to X?") | Post-launch; mechanical enforcement comes first |
| External link health checking (dead URL detection) | Separate concern — propose independently |
