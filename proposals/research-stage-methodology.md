---
title: "Research Stage for DocWright — Foundational Methodology Change"
author: NetYeti
created: 2026-06-07
tags:
  - architecture
  - workflow
  - lifecycle
  - research
  - methodology
  - phase-2
complexity: high
estimated_effort: XL
priority: critical
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

The current DocWright flow jumps directly from an idea to a proposal. This
assumes the author already knows what should be built. For many real-world
situations — new domains, unfamiliar tools, competitive landscape questions,
architectural decisions — the right next action is *investigation*, not
commitment to a solution direction.

This is a methodology gap, not a UI gap. Without a research stage:

- Proposals are written to justify a solution already decided informally,
  not to document a reasoned conclusion from investigation
- Research happens in chat sessions, scratch notes, or the human's head
  and is permanently lost when those sessions end
- The AI tools (chat panel, critique skill) have nowhere to anchor
  investigation context — every session starts from scratch
- Two contributors can independently investigate the same question and
  never know it
- The gap between "I noticed a problem" and "here is what we should do"
  is invisible to the governance system

This is foundational because it affects the *methodology* the tool transmits
to every organization that adopts it. If DocWright's bundled profiles model
idea → proposal → plan, that is what teams will do. Adding research later
means retrofitting every profile, every template, every AI instruction file,
and every piece of collation logic. It is cheaper to establish the stage now,
even if the AI tooling that makes it powerful arrives in Phase 3.

## Proposed Solution

Deliver in two tiers. **Phase 2 MVP** establishes the methodology
infrastructure at low cost. **Phase 3** adds AI-native research tooling on top.

### Phase 2 MVP — Establish the stage

**1. `research/` directory and document type**

A new first-class directory alongside `proposals/`, `plans/`, `docs/`:

```yaml
title: "Research: <question being investigated>"
status: active        # active | concluded | archived
question: "..."       # the research question in one sentence
conclusion: open      # open | recommends | inconclusive | superseded
author: NetYeti
created: YYYY-MM-DD
tags: []
linked_proposals: []  # proposals that were informed by this research
related_research: []  # other research docs consulted
author-role: contributor
```

The body is free-form investigation: questions explored, approaches
compared, findings, sources, and a `## Conclusion` section. A research
document is done when `conclusion` is set and `status: concluded`.

**2. Updated project flow — all bundled profiles**

```
ideas / observations / inbox
    ↓
research/      (optional — small/obvious ideas skip directly to proposal)
    ↓
proposals/     (informed decision, not hypothesis)
    ↓
plans/
    ↓
completed
```

Every bundled profile (`org-operations`, `doc-lifecycle`, `knowledge-base`,
`infra-topology`) is updated to recognise the research document type with
its own frontmatter schema, lifecycle states, and template. The `author-role:`
field is included from day one per policy.

**3. Collation engine: scan `research/`**

The existing relationship engine (`/api/overlap`) adds `research/` to its
scan directories alongside `proposals/` and `plans/`. When a proposal is
created, the collation panel surfaces related research as a distinct
relationship type (`informed-by`). This is a two-line config change in the
scan directories list.

**4. Status page: research section**

The vault status page gains a Research section showing: active research
questions (status: active), recent conclusions (status: concluded, last 30
days), and proposals that have no linked research (optionally flagged as
"investigation skipped" for visibility, not enforcement).

**5. Lifecycle enforcement**

The pre-commit hook recognises `research/` as a governed directory.
`status: concluded` requires a non-empty `conclusion` field — same pattern
as plan completion requiring no pending steps. Research documents cannot be
set to `concluded` without a `## Conclusion` section in the body.

**6. File tree and sidebar**

The file tree sidebar recognises `research/` as a special directory
(alongside `proposals/`, `plans/`, `docs/`) and shows it in the navigation.
The `+ New` menu gains a "New Research" option that scaffolds a research
document template.

### Phase 3 — AI-native research tooling

Once the research stage exists as infrastructure, the following build on it
without modifying the foundation:

- **AI-assisted research sessions**: opening a research doc injects the
  `question` and existing findings as chat context. The conversation
  becomes the investigation. A "Save findings" action writes key points
  back to the document body.
- **Research → proposal generation**: after concluding research, a
  "Create Proposal" button pre-fills the proposal template from the
  research `question`, findings, and `conclusion`. The proposal's
  `related_to` is pre-populated with the source research document.
- **Multi-perspective research**: the multi-model review feature applies
  naturally to research questions — send the same question to BigPickle
  and Claude and compare findings side by side.
- **Automated research synthesis**: the ✨ Improve button on research docs
  synthesises scattered investigation notes into structured findings and
  a draft conclusion.

## Why sooner rather than later

Every piece of Phase 2 and Phase 3 infrastructure touches the project flow.
Building the chat panel, the inbox, the AI improvement tooling, and the
collation engine without a research stage means each is designed for a
3-step world (idea → proposal → plan). Retrofitting a 4th stage later
requires touching all of it again.

The Phase 2 MVP is small: directory convention, templates, profile schema
update, a 2-line collation change, a status page section, and a sidebar
entry. The cost of doing it now is low. The cost of not doing it is paying
that same price plus full migration cost on every feature already shipped.

## Relationship to Existing Work

| Related | Relationship |
|---------|-------------|
| [[plans/phase-2-foundation.md]] | Research MVP belongs in Phase 2 scope alongside profile engine work |
| [[proposals/bundle-ai-capabilities.md]] | Phase 3 AI research tooling (assisted sessions, synthesis) builds directly on this stage |
| [[proposals/bundle-chat-session-panel.md]] | Chat context injection makes research sessions structured and persistent |
| [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md]] | Research stage adds another visible phase that needs to appear in the master flow |
| [[proposals/approved/ux-collating-proposals-into-apropriate-plans.md]] | Collation must now include research/ in its scan — small change, big impact |
| [[plans/phase-3-profile-acl-ai.md]] | Profile engine work in Phase 3 must treat research/ as a first-class document type |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Mandatory research gate for all proposals | Too heavyweight; optional gate is the right default |
| External source fetching / web scraping | New infrastructure; Phase 4+ |
| Full bibliography / citation management | Phase 4+; inline links and notes suffice for now |
| Multi-person concurrent research sessions | Requires real-time collaboration beyond current scope |
| Automated AI research without human direction | AI assists; human conducts — governance boundary policy |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-07 | Created | NetYeti |
