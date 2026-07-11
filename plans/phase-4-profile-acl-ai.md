---
title: Phase 4 — Profile Engine, ACL & AI Integration
status: draft
author: NetYeti
created: 2026-06-03
tags:
  - phase-4
  - profile-engine
  - acl
  - ai
  - dispatch
priority: medium
mode: mentor
assigned_to: NetYeti
depends_on:
  - phase-3-vault-portability-pilot
_path: plans/phase-4-profile-acl-ai.md
proposal_source: phase-level — scope defined in PROJECT.md §14 Phase 4; no individual proposal
phase: 4
total_steps: 0
completed_steps: 0
github_epic: null
milestone: backlog
tests_defined: false
---
# Phase 4 — Profile Engine, ACL & AI Integration

## Overview

Phase 4 was intended to complete the profile engine with all four bundled profiles,
wire in ACL enforcement via Forgejo team membership, and enable full AI write flows
through the ACL controller.

> **PHASE CLOSED 2026-07-11 → `0.5.0` (BDFL decision).** In practice, a large body of
> AI-integration and platform work shipped during the Phase 4 window (ai-model-routing,
> chat-*, cross-tool-ai-compatibility, bundle-ai-capabilities, modular-ai-review,
> multiuser-auth, image-based deployment, the governance/lifecycle hardening cluster —
> see `plans/completed/`), but the phase's **namesake core (profile-engine runtime + ACL
> controller) was not built.** Only deliverable #12 (promote workflow) landed against
> this master list. Deliverables **1–11 are deferred to Phase 5** and captured in
> [[proposals/deferred-phase-4-carryover-profile-engine-acl-ai]] so none are lost
> ([[policies/core/capture-deferred-ideas]]). Phase 5 planning must audit each against
> the shipped codebase before scheduling (some may be partially met).

## Deliverables

| # | Deliverable | Status | Notes |
| --- | --- | --- | --- |
| 1 | Full profile engine — all four bundled profiles loaded and validated | ⏭ Deferred → Phase 5 | org-operations, doc-lifecycle, infra-topology, knowledge-base |
| 2 | `profile.json` schema validation on load | ⏭ Deferred → Phase 5 | Fail loudly on malformed profiles |
| 3 | ACL controller — Forgejo team membership as enforcement source | ⏭ Deferred → Phase 5 | `src/dispatch/acl.ts` wired to Forgejo API |
| 4 | Branch protection enforcement via Forgejo teams | ⏭ Deferred → Phase 5 | Write access gated by team membership |
| 5 | AI write flows through ACL controller | ⏭ Deferred → Phase 5 | All AI mutations carry `ai-last-action:` stamps |
| 6 | `author-role:` frontmatter populated from Forgejo team on scaffold | ⏭ Deferred → Phase 5 | Audit record, not enforcement |
| 7 | Wikilink graph — real backlink index (`_backlinks.json`) | ⏭ Deferred → Phase 5 | Replace stub; based on gowtham0992/link pattern |
| 8 | Related-documents panel — real LLM Jaccard replacement | ⏭ Deferred → Phase 5 | Replace overlap detection stub with dispatch LLM call |
| 9 | LLM Wiki engine (`src/dispatch/llmwiki.ts`) — Ingest/Lint/Save-to-Wiki | ⏭ Deferred → Phase 5 | knowledge-base profile; Karpathy pattern |
| 10 | `opencode-instructions.md` for all four bundled profiles | ⏭ Deferred → Phase 5 | See [[proposals/profile-opencode-system-prompt]] |
| 11 | Frontmatter linter (`src/dispatch/linter.ts`) — full schema enforcement | ⏭ Deferred → Phase 5 | Runs on save; surfaces violations in Web UI |
| 12 | Promote workflow (`src/dispatch/promote.ts`) — status transitions | ✅ Done | `checkTransition`, `executeTransition`, `checkWithAI`, `getBlockedDocuments`, `diffAnnotate` — 15 tests passing. Wires gates.ts + audit.ts into a single integration point. |

## Phase Closure

Phase 4 is closed by `npm run phase:close -- 4`, which bumps `VERSION`/`package.json`
to `0.5.0` and tags the release. That is a **BDFL release action** — not run by AI
([[feedback-release-is-bdfl-call]]). Deferred scope lives in the carryover proposal
above and feeds Phase 5 planning.

## Phase Context

See [[plans/phase-3-vault-portability-pilot]] for Phase 3 deliverables.

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-08 | Renumbered Phase 3 → Phase 4; depends_on updated to phase-3-vault-portability-pilot | NetYeti |
| 2026-06-03 | Created — roadmap placeholder, Phase 2 in progress | NetYeti |
| 2026-07-11 | Phase closed → 0.5.0. Deliverables 1–11 deferred to Phase 5 (captured in deferred-phase-4-carryover proposal); #12 shipped. Status flip to completed left to BDFL. | NetYeti |
