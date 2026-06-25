---
title: "Sub-Plan: Vault Write API — moveDocument, renameDocument, canonical setField"
author: NetYeti
author-role: contributor
created: 2026-06-17
created_by: NetYeti@phoenix
tags:
  - phase-3
  - vault
  - api
  - referential-integrity
  - write
complexity: medium
estimated_effort: M
approved: true
priority: critical
phase: 3
assigned_to: NetYeti
related_to:
  - plans/phase-3-vault-foundation.md
  - proposals/approved/sub-plan-vault-document-index.md
  - proposals/approved/knowledge-graph-cross-document-idea-linkage.md
_path: proposals/approved/sub-plan-vault-write-api.md
consumed_by: plans/sub-plan-vault-write-api.md
---

## Problem

Every lifecycle transition that moves a file — approving a proposal, completing a
plan, renaming a document — currently leaves stale `_path:` frontmatter and broken
wikilink references. `fix-stale-approvals.ts` and `backfill-proposal-source.ts`
exist because this API does not.

Without a canonical write layer, enforcement of governance rules (mode, gates)
cannot be applied universally — only in specific surfaces that happen to use the
right code path. With it, all mutations go through one place.

**Concrete failure scenarios.** When a proposal is approved, its file moves from
`proposals/` to `proposals/approved/` but `_path:` still reads
`proposals/my-proposal.md`. Any MCP tool or script that reads `_path:` from
frontmatter resolves to the wrong location. `[[wikilinks]]` referencing the old
path break silently — some renderers follow frontmatter, others follow
filesystem, producing inconsistent behavior across surfaces.

**Current workaround cost.** `fix-stale-approvals.ts` and
`backfill-proposal-source.ts` are post-hoc patches that only cover known
patterns. They cannot fix wikilinks, they miss edge cases (renames, nested
moves), and every new lifecycle transition requires another repair script.
This approach does not scale.

## Proposed Solution

Build three operations as the canonical write path for all document mutations.
All MCP tools and Web UI routes call these exclusively — no direct `fs.writeFile`
on document paths after this ships.

### `setField(path, field, value)`

Promoted from the existing `setFrontmatterField` utility to the canonical write
path. Validates the field against the document's schema. Rejects unknown fields
and type mismatches with a descriptive error. Stamps `ai-last-action:` when
called from an AI context. All current callers already exist — this is promotion
and consolidation, not new logic.

### `moveDocument(srcPath, destPath)`

1. Move file to destination
2. Update `_path:` frontmatter to new path
3. Grep vault for all `[[srcPath]]` and `[[srcPath#section]]` wikilink references
4. Update each reference in-place via `setField`-equivalent body write
5. Update any `consumed_by:`, `related_to:`, `depends_on:`, `proposal_source:`
   frontmatter fields across the vault that reference the old path

**Error handling.** Each step is a substage with rollback. If step 3, 4, or 5
fails after step 1 and 2 have completed, the operation reverses: the file moves
back to `srcPath`, `_path:` is restored, and any wikilinks or frontmatter fields
already updated are reverted to their original values. Partial failures do not
leave the vault in an inconsistent state.

### `renameDocument(path, newName)`

Rename within same directory — calls `moveDocument(path, dir/newName)`.

### Write audit trail

All three operations append to `.docwright/write-audit.jsonl` with timestamp,
operation name, actor identity, source and destination paths, and
success/failure status. This provides observability without introducing a
database.

## Out of Scope

- **No batch operations.** Every move, rename, or field write is a single
  synchronous call. Bulk migration of many documents is orchestrated by the
  caller, not this API.
- **No undo/redo history.** The audit trail is append-only and not
  replayable. Git revert is the undo mechanism.
- **No content transformation.** Only frontmatter fields and wikilink
  references are updated. Document body content is never rewritten beyond
  wikilink normalization.
- **No event hooks or listeners.** Changes are not broadcast. Consumers
  that need to react to mutations poll or rely on git hooks.
- **No cross-repository operations.** All operations are scoped to a single
  vault. Referential integrity across repos is handled separately.

## Acceptance Bar

- Approving a proposal (move to `proposals/approved/`) leaves no stale `_path:`
- Completing a plan (move to `plans/completed/`) leaves no stale `_path:`
- Renaming a document updates all `[[wikilinks]]` referencing it across the vault
- All existing MCP tools that write frontmatter go through `setField`
- `fix-stale-approvals.ts` is retired — its repair logic is replaced by this API

## Dependencies

- None. This is a Phase 3 prerequisite — must land before pilots run.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | AI-improved via Improve | NetYeti |
