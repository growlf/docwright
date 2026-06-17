---
title: "Sub-Plan: Vault Write API — moveDocument, renameDocument, canonical setField"
author: NetYeti
author-role: contributor
created: 2026-06-17
created_by: "NetYeti@phoenix"
tags:
  - phase-3
  - vault
  - api
  - referential-integrity
  - write
complexity: medium
estimated_effort: M
approved: false
priority: critical
phase: 3
assigned_to: ""
related_to:
  - plans/phase-vault-portability-pilot.md
  - proposals/sub-plan-vault-document-index.md
  - proposals/knowledge-graph-cross-document-idea-linkage.md
---

## Problem

Every lifecycle transition that moves a file — approving a proposal, completing a
plan, renaming a document — currently leaves stale `_path:` frontmatter and broken
wikilink references. `fix-stale-approvals.ts` and `backfill-proposal-source.ts`
exist because this API does not.

Without a canonical write layer, enforcement of governance rules (mode, gates)
cannot be applied universally — only in specific surfaces that happen to use the
right code path. With it, all mutations go through one place.

## Proposed Solution

Build three operations as the canonical write path for all document mutations.
All MCP tools and Web UI routes call these exclusively — no direct `fs.writeFile`
on document paths after this ships.

### `setField(path, field, value)`

Promoted from the existing `setFrontmatterField` utility to the canonical write
path. Validates the field against the document's schema. Stamps `ai-last-action:`
when called from an AI context. All current callers already exist — this is
promotion and consolidation, not new logic.

### `moveDocument(srcPath, destPath)`

1. Move file to destination
2. Update `_path:` frontmatter to new path
3. Grep vault for all `[[srcPath]]` and `[[srcPath#section]]` wikilink references
4. Update each reference in-place via `setField`-equivalent body write
5. Update any `consumed_by:`, `related_to:`, `depends_on:`, `proposal_source:`
   frontmatter fields across the vault that reference the old path

### `renameDocument(path, newName)`

Rename within same directory — calls `moveDocument(path, dir/newName)`.

### What this is NOT

- Not a database. Git is still the canonical store.
- Not a real-time event system. Changes are synchronous file operations.
- Not a query layer. That is `sub-plan-vault-document-index.md`.

## Acceptance Bar

- Approving a proposal (move to `proposals/approved/`) leaves no stale `_path:`
- Completing a plan (move to `plans/completed/`) leaves no stale `_path:`
- Renaming a document updates all `[[wikilinks]]` referencing it across the vault
- All existing MCP tools that write frontmatter go through `setField`
- `fix-stale-approvals.ts` is retired — its repair logic is replaced by this API

## Dependencies

- None. This is a Phase 3 prerequisite — must land before pilots run.
