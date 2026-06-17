---
title: "Knowledge Graph — Cross-Document Idea-Linkage and Gap Detection"
author: NetYeti
author-role: contributor
created: 2026-06-17
created_by: "NetYeti@phoenix"
tags:
  - ui
  - graph
  - knowledge
  - relationships
  - frontmatter
  - wikilinks
  - gap-detection
complexity: high
estimated_effort: L
approved: false
assigned_to: ""
related_to:
  - proposals/sub-plan-vault-write-api.md
  - proposals/sub-plan-vault-document-index.md
  - plans/plan-ui-lifecycle-graph-view.md
  - proposals/deferred-rlm-python-microservice.md
  - research/rlm-recursive-language-models.md
phase: 3
---

## Problem

DocWright has no way to answer the questions that matter most for steering
development: Which plans have no source proposal? Which concluded research
led to no action? Which approved proposals were never investigated? Which
ideas in the same thematic cluster have never been connected? Where is the
dependency chain blocked by something canceled or deferred?

The information to answer these questions exists — scattered across
frontmatter fields and body text wikilinks — but it is not connected into
anything queryable. The status page shows *what state each document is in*,
not *how documents relate to each other as ideas*. The gap is invisible
until you're blocked by it.

Additionally, the relationship data is currently too sparse to be useful:

| Relationship field | Documents | Populated | Coverage |
|--------------------|-----------|-----------|---------|
| `related_to:` on proposals | 26 | 16 | 62% |
| `related_to:` on plans | 16 | 5 | 31% |
| `proposal_source:` on plans | 16 | 1 (one-off) | 6% |
| `linked_proposals:` on research | 6 | 6 (mostly `[]`) | thin |
| Body wikilinks `[[...]]` | all docs | 32 occurrences | **not indexed** |

The most critical missing edge: **plans do not link back to their source
proposal.** There is no standard `proposal_source:` field — one plan has it
as a one-off, the rest are unlinked. Without this edge, the most important
arc in the knowledge graph (proposal → plan) is invisible.

## Proposed Solution

This proposal has three parts with a strict dependency order. Parts A and B
are foundational — building the graph before they are in place produces a
disconnected, misleading visualization. Part C is the graph view itself.

---

### Part A — Foundational Schema: `proposal_source:` on Plans

Standardize `proposal_source:` as a required frontmatter field on all plan
documents. When the "Create Plan" flow runs from a proposal, populate it
automatically. The linter warns when a plan lacks this field.

**Schema addition (`schema.json` for org-operations profile):**
```yaml
proposal_source: ""   # path to source proposal, e.g. proposals/foo.md
```

**Create-plan flow change (`/api/create-plan`):** populate `proposal_source:`
with the originating proposal path when creating from a proposal context.

**Linter rule:** plans without `proposal_source:` and without
`proposal_source: none` (for plans created without a proposal, e.g. phase
plans) produce a lint warning — not a hard block, but visible in the
properties pane.

**One-time migration:** a script (`scripts/backfill-proposal-source.ts`)
that walks active plans, finds their likely source proposals via title
matching and `related_to:` cross-reference, and proposes the backfill for
human review. Does not auto-commit — outputs a dry-run diff for approval.

---

### Part B — Linter Enforcement: `related_to:` on Approved Proposals

Proposals approved without a `related_to:` field (or with an empty array)
indicate one of two things: the proposal is genuinely standalone (valid),
or the relationship field was simply never filled in (data debt). The linter
cannot distinguish these — but it can surface the gap at the moment it
matters.

**Linter rule:** when `approved: true` is set on a proposal AND
`related_to:` is empty, add a lint warning: "Approved proposal has no
related documents — add `related_to:` links or set `related_to: []` to
acknowledge this is intentional."

This is a **warning, not a hard block.** Governance documents that are
genuinely standalone (e.g. a FOSS hygiene proposal that doesn't relate to
anything) should be able to proceed. The warning forces a conscious choice
rather than an accidental omission.

**Also applies to plans:** when a plan reaches `status: in-progress` and
`related_to:` is empty, same warning.

---

### Part C — Knowledge Graph View (Phase 5, after wikilink index)

A fourth status page tab — alongside List, Funnel, and Audit — that renders
the vault's idea-linkage as an interactive force-directed graph.

**Gate:** this part does not start until Phase 5 step 5b (vault-wide
wikilink index) is complete. The wikilink index turns body text `[[links]]`
into indexed graph edges — without it, the graph only shows explicitly
declared frontmatter relationships, which are too sparse to reveal gaps.

**Nodes:** every proposal, plan, research doc, and policy atom is a node.
- Color-coded by document type (proposal / plan / research / atom)
- Size-coded by status urgency (approved-not-started = larger = more
  visible)
- Shape-coded or badge-coded by lifecycle state

**Edges (typed and filterable):**
| Edge type | Source field | Direction |
|-----------|-------------|-----------|
| `proposal_source` | plan frontmatter | plan → proposal |
| `related_to` | proposal/plan frontmatter | bidirectional |
| `depends_on` | plan frontmatter | plan → plan |
| `blocks` | plan frontmatter | plan → plan |
| `linked_proposals` | research frontmatter | research → proposal |
| `wikilink` | body text `[[path]]` | document → document |

**Rendering:** D3.js force-directed graph, embedded in a Svelte component.
Nodes repel; edges attract. Click a node to open the document. Hover for
frontmatter summary tooltip. Filter panel: by phase, by document type, by
tag, by edge type, show/hide completed work.

**Gap detection — the specific queries this view must answer:**

1. **Orphaned plans** — plans with no `proposal_source:` and no
   `related_to:` to a proposal. These are plans executing work that was
   never formally proposed and approved. Highlight in amber.

2. **Concluded research with no follow-through** — research docs with
   `status: concluded` and `linked_proposals: []`. The investigation is
   done but produced no proposal. Highlight as a dead end.

3. **Approved proposals with no investigation** — `approved: true` and
   `linked_proposals:` empty on all linked research docs (or no research
   docs linked at all). Work was approved without investigation.

4. **Dependency roadblocks** — plans where `depends_on:` points to a plan
   with `status: canceled` or `status: deferred`. The plan is blocked by
   something that will never complete. Surface as a broken edge.

5. **Thematic orphans** — proposals sharing 2+ tags with other proposals
   but with no `related_to:` connections between them. These are likely
   the same idea approached from different angles without cross-awareness.

6. **Phase orphans** — active plans with no `phase:` field. Work that is
   in-progress but not assigned to any delivery milestone.

**Implementation sketch:**

New API endpoint: `GET /api/graph` — returns `{ nodes, edges }` where each
node is `{ id, path, title, type, status, phase, tags }` and each edge is
`{ source, target, kind }`. Constructs graph from frontmatter scan +
wikilink index.

Graph component: `src/webui/src/lib/KnowledgeGraph.svelte` — takes
`nodes` and `edges`, renders via D3.js, emits `select` event on node click.
Status page hosts it in a `{#if viewMode === 'graph'}` branch alongside
the existing List and Funnel branches. View toggle becomes: List / Funnel /
Graph / Audit.

**D3.js note:** this is the same D3 dependency that `plan-ui-lifecycle-
graph-view.md` planned for its Phase 3 (dependency graph). Those two plans
can share the D3 import — install once, use in both components. The
lifecycle graph plan's Phase 3 step (D3 dependency graph) should be
implemented as part of this proposal's Part C rather than separately.

---

## Why NOT to build the graph before Parts A and B

A force-directed graph with 62% edge coverage looks like a partially
assembled jigsaw puzzle — some nodes are richly connected, others float
alone. A user looking at it cannot tell: "is this proposal genuinely
unrelated to everything, or did nobody fill in `related_to:`?" The
ambiguity undermines the whole point of the tool.

Parts A and B take the coverage from ~50% to close to 100% for the edges
that matter most (plan→proposal, proposal→related). The wikilink index
(Phase 5 step 5b) then adds the organic body-text connections that surface
unexpected relationships. **Build the graph after the data is trustworthy,
not before.**

## Dependencies

- Part A: no external dependencies; can start anytime after this is approved
- Part B: no external dependencies; can start anytime after this is approved
- Part C: depends on Phase 5 step 5b (wikilink index) + Parts A and B
- Parts A+B can run in parallel
- Part C is a Phase 5 item; parts A+B are Phase 4 prep work (can land in
  Phase 4 alongside linter improvements)

## Out of Scope

- RLM-powered graph analysis (querying the graph with recursive reasoning
  to surface gaps) — see [[proposals/deferred-rlm-python-microservice.md]].
  That is a Phase 5/6 enhancement on top of the graph, not a prerequisite.
- Real-time collaborative graph editing
- Export to Graphviz/Mermaid (useful but Phase 6+)
