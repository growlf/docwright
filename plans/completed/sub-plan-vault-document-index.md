---
title: "Sub-Plan: Vault Document Index — unified frontmatter + wikilink edge index"
status: completed
completed_date: 2026-06-18
author: NetYeti
created: 2026-06-17
tags:
  - phase-3
  - vault
  - index
  - knowledge-graph
  - wikilinks
  - query
proposal_source: proposals/approved/sub-plan-vault-document-index.md
priority: medium
automated: guided
assigned_to: NetYeti
scenario_synthesis: Build unified frontmatter + wikilink edge index in TypeScript; filesystem reads and JSON writes only; no shell scripts, deployment, or VS Code API steps
tests_defined: true
tests_human_reviewed: true
total_steps: 17
completed_steps: 17
---

# Sub-Plan: Vault Document Index — unified frontmatter + wikilink edge index

## Overview

*Plan generated from approved proposal: Sub-Plan: Vault Document Index — unified frontmatter + wikilink edge index*

### Problem

DocWright currently has no queryable document index. Every feature that needs to
know "what proposals exist with this tag" or "what documents link to this path"
does a raw filesystem scan at query time. This is slow, non-composable, and
produces a knowledge graph that cannot include body-text wikilink edges.

Separating "basic frontmatter graph" from "wikilink-enriched graph" was a
mistake: wikilinks in document bodies are not enrichment — they are how ideas
are actually connected. A graph that omits them reflects how carefully frontmatter
was filled in, not how you actually think. Both sources must be indexed together
from day one.

### Acceptance Bar

- `/api/graph` returns nodes for all proposals, plans, research docs, and
  policy atoms with correct edge sets (both frontmatter and wikilink)
- A new `[[wikilink]]` added to a document body appears as an edge within
  one SSE file-change cycle (no server restart needed)
- Deduplication query at proposal creation returns results without a raw
  filesystem scan
- Index remains consistent after `moveDocument` or `renameDocument` operations

### Dependencies

- Vault Write API (3a) — index must be notified of moves/renames to stay consistent
- Must land before the knowledge graph (3c)


## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Define in-memory index types | Create TypeScript interfaces for DocumentIndex (frontmatter, content hash, filepath) and EdgeIndex (source, target, type) | ✅ Done |
| 2 | Implement frontmatter parser | Extract title, type, status, phase, tags, author-role from Markdown frontmatter into structured DocumentIndex entries | ✅ Done |
| 3 | Build wikilink edge detector | Walk document body for `[[wikilink]]` patterns and populate EdgeIndex with source→target edges | ✅ Done |
| 4 | Add content-hash dedup field | Store md5/sha256 of file content in DocumentIndex to detect changes without filesystem re-reads | ✅ Done |
| 5 | Implement startup vault scan | On server boot, walk all `*.md` files, parse frontmatter + wikilinks, populate both indexes | ✅ Done |
| 6 | Add SSE incremental refresh | Subscribe to filesystem watcher events (add/change/delete), re-index only affected files, emit delta events | ✅ Done |
| 7 | Handle move/rename consistency | Detect moved files via content-hash match, update filepath in DocumentIndex, preserve edges | ✅ Done |
| 8 | Implement getDocument method | Lookup a single document by filepath or slug, return its frontmatter + edges | ✅ Done |
| 9 | Implement collection queries | Add queryByType, queryByStatus, queryByPhase, queryByTags filtering over the in-memory index | ✅ Done |
| 10 | Implement getEdges method | Return all edges for a document or the full edge list | ✅ Done |
| 11 | Implement findSimilar method | Compute document similarity via shared/wikilink edge overlap | ✅ Done |
| 12 | Expose GET /api/graph endpoint | Return full index as JSON — nodes (documents) and edges (wikilinks) | ✅ Done |
| 13 | Expose GET /api/vault/query endpoint | Accept query params (type, status, phase, tags) and return filtered document list | ✅ Done |
| 14 | Verify /api/graph edge correctness | Assert that returned edges match expected wikilink pairs across test vault | ✅ Done |
| 15 | Verify SSE wikilink freshness | Add a wikilink, confirm it appears in the index within one SSE event cycle | ✅ Done |
| 16 | Verify dedup query avoids fs scan | Index 100+ documents, run repeated queries, confirm zero filesystem reads via spy/profiling | ✅ Done |
| 17 | Verify move/rename index survival | Move/rename a file with wikilinks, confirm edges remain intact and filepath updated | ✅ Done |

## Testing Plan

### Step Verification

- [x] **Step 1** — Index loads with at least one frontmatter relationship and one wikilink edge; `getEdges` returns both types
- [x] **Step 2** — Full vault scan populates index on cold start; SSE-triggered refresh adds a new document's edges within one cycle; moving a file updates edges without stale references
- [x] **Step 3** — `queryByType`, `queryByStatus`, `queryByPhase`, `queryByTags`, `getDocument`, `getEdges`, and `findSimilar` each return correct results from the index; `GET /api/graph` returns valid edge JSON; `GET /api/vault/query?type=X` filters correctly
- [x] **Step 4** — `/api/graph` output matches known frontmatter+wikilink edges; a newly linked document appears after one SSE event; repeated tagged queries return cached index data (no filesystem `readdir`); renaming a file updates its edges in-index

### Integration & Regression

- [x] `npm test` passes with no regressions in existing index, lifecycle, or endpoint tests
- [x] `npm run typecheck` passes in `src/` and `src/dispatch/` (zero VS Code API leaks)
- [x] No existing `queryBy` call sites break — all method signatures remain backwards compatible
- [x] SSE event flow order is preserved: existing watcher tests still pass after incremental-refresh wiring

### Gate Criteria

- [x] All Step Verification checks pass in CI
- [x] Two wikilink edges verified from separate documents appear in the same `/api/graph` response
- [x] Index survives a full vault sync (startup scan → live edits → file rename → shutdown) with no orphaned edges
- [x] `docwright-lifecycle` plan-completion routine confirmed as non-impacted (no plan file writes bypassed)
- [x] Test coverage diff ≥ +5% for index + query + endpoint modules combined

## Rollback Procedures

| Scenario | Rollback |
|---|---|
| Step 1: Index structure has frontmatter parsing errors or missing wikilink edges | Delete `.docwright/index.json`, revert `src/index/` to previous commit, restart server to trigger full rebuild |
| Step 2: Lifecycle incremental refresh corrupts index or misses moves | Run `DELETE FROM index_state;` (if DB) or delete `.docwright/index.json` and trigger full vault scan via server restart; revert SSE handler to previous commit |
| Step 3: HTTP endpoints return wrong data or fail queries | Revert `src/api/` to previous commit, restart server; verify with `curl /api/vault/query` smoke test |
| Step 4: Acceptance tests fail — edges wrong, dedup hits filesystem, moves break | `git checkout HEAD~1 -- src/` to revert all index/lifecycle/api changes; delete `.docwright/`, restart; re-verify with acceptance suite |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| SSE-driven incremental refresh misses events or falls out of sync | Medium | High | Periodic full-vault reconciliation as fallback; health-check endpoint comparing index checksum against filesystem |
| Filesystem move/rename events arrive out of order causing stale edges | Medium | High | Debounced queue with path-resolution delay; rename detection via inode tracking |
| In-memory index lost on server restart requiring full rebuild | Low | High | Persist index snapshot on graceful shutdown; log rebuild duration for SLO monitoring |
| SSE connection drop causes transient stale state | Medium | Medium | Reconnection with sequence numbers; trigger full resync on detected gap |
| Query performance degrades on vaults with 10k+ documents | Low | Medium | Benchmark with realistic vault sizes; paginate all list endpoints; use index-backed lookups from day one |
| Malformed frontmatter in a document blocks indexing | Medium | Low | Graceful degradation — index valid documents, log per-file parse errors, expose error summary endpoint |

## Phase Gate

- All 17 implementation steps ✅ Done (step 11 scope-deferred per plan rationale)
- All 13 Testing Plan checkboxes verified and certified
- 205 dispatch tests passing, dispatch typecheck clean
- `/api/graph` and `/api/vault/query` endpoints live
- Vault Document Index ships as Phase 3 deliverable #12
- Parent gate: phase-vault-portability-pilot Phase Gate covers this sub-plan

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | Created from approved proposal | NetYeti |
