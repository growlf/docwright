---
title: "Plan: Sub-Plan: Vault Write API — moveDocument, renameDocument, canonical setField"
status: completed
completed_date: 2026-06-18
author: NetYeti
created: 2026-06-17
created_by: NetYeti@phoenix
tags:
  - phase-3
  - vault
  - api
  - referential-integrity
  - write
proposal_source: proposals/approved/sub-plan-vault-write-api.md
priority: critical
phase: 3
automated: full
assigned_to: NetYeti
scenario_synthesis: TypeScript dispatch module — fs reads/writes only; no shell, no VS Code API, no database; wires three webui API endpoints to canonical write layer
tests_defined: true
tests_human_reviewed: false
total_steps: 7
completed_steps: 7
related_to:
  - plans/phase-vault-portability-pilot.md
  - plans/completed/sub-plan-vault-document-index.md
_path: plans/completed/plan-sub-plan-vault-write-api-movedocument-renamedocument-canonical-setfield
---

# Plan: Sub-Plan: Vault Write API — moveDocument, renameDocument, canonical setField

## Overview

Build a canonical write layer in `src/dispatch/vault-write.ts` that all document
mutations flow through. Three operations: `setDocumentField`, `moveDocument`,
`renameDocument`. Wire the three existing webui endpoints that currently do raw
`fs.rename` / `git mv` without frontmatter updates or wikilink cascading.

**Acceptance bar (from proposal):**
- Approving a proposal leaves no stale `_path:` in the moved file
- Completing a plan leaves no stale `_path:`
- Renaming a document updates all `[[wikilinks]]` referencing it across the vault
- `fix-stale-approvals.ts` is retired (replaced by this API)

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Create `src/dispatch/vault-write.ts` | `setDocumentField`, `moveDocument`, `renameDocument`; rollback on failure; append to `.docwright/write-audit.jsonl` | ✅ Done |
| 2 | Unit tests for vault-write | `test/dispatch/vault-write.test.ts` — temp-dir fixtures for move, rename, setField, wikilink cascade, cross-ref update, rollback | ✅ Done |
| 3 | Wire `/api/rename` | Replace raw `git mv` + `fs.rename` with `moveDocument`; return updated wikilink count | ✅ Done |
| 4 | Wire `/api/approve-proposal` | Replace `fs.renameSync` for proposal move with `moveDocument`; fixes stale `_path:` in approved proposals | ✅ Done |
| 5 | Wire `/api/lifecycle/transition-completed` | Replace `fs.renameSync` for plan move with `moveDocument`; fixes stale `_path:` in completed plans | ✅ Done |
| 6 | Deprecate `fix-stale-approvals.ts` | Add header comment marking it superseded by vault-write API; add npm script deprecation notice | ✅ Done |
| 7 | Full test pass + acceptance verification | `npm run test:dispatch` clean; manually verify approve + complete flows leave correct `_path:`; check one rename cascades wikilinks | ✅ Done |

## Testing Plan

- [x] Step 2: Unit tests for vault-write
- [x] Step 3: Wire `/api/rename`
- [x] Step 4: Wire `/api/approve-proposal`
- [x] Step 5: Wire `/api/lifecycle/transition-completed`
- [x] Step 6: Deprecate `fix-stale-approvals.ts`
- [x] Step 7: Full test pass + acceptance verification
- [x] Step 1: `vault-write.ts` compiles cleanly, exports all three functions
- [x] Step 2: All vault-write unit tests pass in isolation
- [x] Step 3: Renaming a doc via UI updates all wikilinks referencing it
- [x] Step 4: Approving a proposal sets `_path:` to `proposals/approved/<slug>.md`
- [x] Step 5: Completing a plan sets `_path:` to `plans/completed/<slug>.md`
- [x] Step 7: `npm run test:dispatch` — all passing, no regressions

## Rollback Procedures

- `vault-write.ts` is additive — no existing code deleted in Steps 1–2
- Steps 3–5 each replace one call site; revert is one-line per file

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `updateWikilinks` index scan misses files not in VaultIndex | Low | Low | `buildIndex` scans all .md files; fallback grep if index empty |
| Partial move + failed wikilink update leaves inconsistent state | Low | Medium | Rollback: save originals before any write, restore on error |
| Large vault — wikilink scan slow | Low | Low | Scan is synchronous but fast; vault is small for now |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | Created (shell) | NetYeti |
| 2026-06-17 | Populated with 7 steps from audit of existing endpoints | NetYeti |
| 2026-06-17 | All 7 steps complete — 13 tests passing, 3 endpoints wired, plan closed | NetYeti |
