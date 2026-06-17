---
title: "Sub-Plan: Vault Document Index — unified frontmatter + wikilink edge index"
author: NetYeti
author-role: contributor
created: 2026-06-17
created_by: "NetYeti@phoenix"
tags:
  - phase-3
  - vault
  - index
  - knowledge-graph
  - wikilinks
  - query
complexity: medium
estimated_effort: M
approved: false
priority: critical
phase: 3
assigned_to: ""
related_to:
  - plans/phase-vault-portability-pilot.md
  - proposals/sub-plan-vault-write-api.md
  - proposals/knowledge-graph-cross-document-idea-linkage.md
depends_on:
  - proposals/sub-plan-vault-write-api.md
---

## Problem

DocWright currently has no queryable document index. Every feature that needs to
know "what proposals exist with this tag" or "what documents link to this path"
does a raw filesystem scan at query time. This is slow, non-composable, and
produces a knowledge graph that cannot include body-text wikilink edges.

Separating "basic frontmatter graph" from "wikilink-enriched graph" was a
mistake: wikilinks in document bodies are not enrichment — they are how ideas
are actually connected. A graph that omits them reflects how carefully frontmatter
was filled in, not how you actually think. Both sources must be indexed together
from day one.

## Proposed Solution

Build a single in-memory document index that covers both frontmatter relationships
and body-text wikilink references. No external database. Git is still the
canonical store. The index is a derived read cache rebuilt from markdown files.

### Index structure

Each document entry contains:
- `path`, `title`, `type`, `status`, `phase`, `tags` — from frontmatter
- **Frontmatter edges:** `related_to`, `depends_on`, `proposal_source`,
  `consumed_by`, `linked_proposals`, `blocks` — extracted from frontmatter
- **Wikilink edges:** all `[[path]]`, `[[path#section]]`, `[[path|alias]]`
  occurrences in the document body — parsed via the existing `wikilinks.ts`
  dispatch module

### Lifecycle

- Built on server startup via full vault scan
- Refreshed incrementally on SSE file-change events (only affected file
  re-scanned, not full rebuild)
- Consistent with the vault write API (3a): `moveDocument` and `renameDocument`
  notify the index to update affected entries

### API surface

**Internal query methods:**
- `getDocument(path)` — single document with full edge set
- `queryByType(type)` — all documents of a given type
- `queryByStatus(status)` — filter by lifecycle status
- `queryByPhase(phase)` — filter by phase assignment
- `queryByTags(tags[])` — documents matching any of the given tags
- `getEdges(path)` — all known edges for a document (both directions)
- `findSimilar(title, type)` — deduplication query for new proposal creation

**HTTP endpoints:**
- `GET /api/graph` — full `{ nodes, edges }` payload for the knowledge graph
- `GET /api/vault/query` — parameterized query for profile-aware features

### Accuracy commitment

The index includes wikilink edges from day one. There is no "basic" phase
followed by a "wikilink enrichment" phase. Incomplete coverage is surfaced
explicitly — documents with unparseable frontmatter are flagged in the index,
not silently dropped.

## Acceptance Bar

- `/api/graph` returns nodes for all proposals, plans, research docs, and
  policy atoms with correct edge sets (both frontmatter and wikilink)
- A new `[[wikilink]]` added to a document body appears as an edge within
  one SSE file-change cycle (no server restart needed)
- Deduplication query at proposal creation returns results without a raw
  filesystem scan
- Index remains consistent after `moveDocument` or `renameDocument` operations

## Dependencies

- Vault Write API (3a) — index must be notified of moves/renames to stay consistent
- Must land before the knowledge graph (3c)
