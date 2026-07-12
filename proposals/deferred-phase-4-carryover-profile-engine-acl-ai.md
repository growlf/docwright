---
title: "Deferred: Phase 4 carryover — profile engine, ACL & AI-write-through-ACL"
author: NetYeti
author-role: contributor
created: 2026-07-11
tags:
  - profile-engine
  - acl
  - ai
  - dispatch
  - phase-5
  - carryover
complexity: large
estimated_effort: XL
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
priority: medium
milestone: backlog
deferred: true
deferred_reason: "Phase 4 closed at 0.5.0 with only deliverable #12 (promote workflow) shipped. Deliverables 1–11 (the profile-engine/ACL/AI-write core) are undelivered and deferred to Phase 5 per the BDFL close-out decision 2026-07-11. Captured here so they are not lost (capture-deferred-ideas)."
related_to:
  - plans/phase-4-profile-acl-ai.md
  - plans/phase-5-cascade-steam.md
  - proposals/profile-opencode-system-prompt.md
  - proposals/profile-aware-project-templates.md
---

## Problem

Phase 4 ("Profile Engine, ACL & AI Integration") was **closed at `0.5.0`** with only
its final deliverable shipped (#12, the promote workflow — `src/dispatch/promote.ts`,
15 tests). A large amount of AI-integration feature work *did* land during the Phase 4
window (ai-model-routing, chat-*, cross-tool-ai-compatibility, bundle-ai-capabilities,
modular-ai-review, multiuser-auth, image-based deployment, etc.), but the phase's
**namesake core — the profile engine runtime and the ACL controller — was not built.**

Closing the phase without capturing the undelivered scope would lose it
([[capture-deferred-ideas]]). This proposal records deliverables 1–11 from
`plans/phase-4-profile-acl-ai.md` as a single carryover so Phase 5 planning can
decompose, dedup against existing proposals, and schedule them.

## Deferred deliverables (from the Phase 4 master plan)

1. **Full profile engine** — all four bundled profiles loaded + validated (org-operations, doc-lifecycle, infra-topology, knowledge-base).
2. **`profile.json` schema validation on load** — fail loudly on malformed profiles.
3. **ACL controller** — Forgejo team membership as the enforcement source (`src/dispatch/acl.ts` wired to the Forgejo API).
4. **Branch protection enforcement via Forgejo teams** — write access gated by team membership.
5. **AI write flows through the ACL controller** — all AI mutations carry `ai-last-action:` stamps and pass through ACL.
6. **`author-role:` populated from Forgejo team on scaffold** — audit record, not enforcement.
7. **Wikilink graph — real backlink index (`_backlinks.json`)** — replace the stub (gowtham0992/link pattern).
8. **Related-documents panel — real LLM replacement for the Jaccard stub** — dispatch LLM call.
9. **LLM Wiki engine (`src/dispatch/llmwiki.ts`)** — Ingest/Lint/Save-to-Wiki (knowledge-base profile; Karpathy pattern).
10. **`opencode-instructions.md` for all four bundled profiles** — each embeds core philosophy + security/policy prompts.
11. **Frontmatter linter (`src/dispatch/linter.ts`)** — full schema enforcement on save, surfaced in the Web UI.

> Some of these may be **partially** met by shipped feature work (e.g. AI flows, the
> knowledge graph). Phase 5 planning MUST audit each against the current codebase before
> scheduling — do not assume all eleven are greenfield. Where a related proposal already
> exists ([[profile-opencode-system-prompt]] ≈ #10; [[profile-aware-project-templates]]),
> enjoin rather than duplicate.

## Proposed Solution

Carry deliverables 1–11 into Phase 5 planning as their own decomposed plans, sequenced
after an audit pass that reconciles each against what shipped. Split into at least:
profile-engine-runtime (1,2), ACL-controller (3,4,5,6), knowledge-layer (7,8,9), and
profile-content-linting (10,11).

## Verification

- Each deliverable, when scheduled, ships as its own plan with tests (per DocWright's
  test-verified-at-every-stage principle).
- Phase 5 planning references this proposal so none of the eleven are silently dropped.
