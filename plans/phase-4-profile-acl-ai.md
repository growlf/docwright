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
---
# Phase 4 — Profile Engine, ACL & AI Integration

## Overview

Phase 4 completes the profile engine with all four bundled profiles, wires in ACL enforcement via Forgejo team membership, and enables full AI write flows through the ACL controller. By the end of this phase, DocWright enforces policy automatically and every AI action is auditable.

This plan tracks all Phase 4 deliverables. Each deliverable will be broken out into its own plan when Phase 3 is complete and work begins.

## Deliverables

| # | Deliverable | Status | Notes |
| --- | --- | --- | --- |
| 1 | Full profile engine — all four bundled profiles loaded and validated | ⏳ Planned | org-operations, doc-lifecycle, infra-topology, knowledge-base |
| 2 | `profile.json` schema validation on load | ⏳ Planned | Fail loudly on malformed profiles |
| 3 | ACL controller — Forgejo team membership as enforcement source | ⏳ Planned | `src/dispatch/acl.ts` wired to Forgejo API |
| 4 | Branch protection enforcement via Forgejo teams | ⏳ Planned | Write access gated by team membership |
| 5 | AI write flows through ACL controller | ⏳ Planned | All AI mutations carry `ai-last-action:` stamps |
| 6 | `author-role:` frontmatter populated from Forgejo team on scaffold | ⏳ Planned | Audit record, not enforcement |
| 7 | Wikilink graph — real backlink index (`_backlinks.json`) | ⏳ Planned | Replace stub; based on gowtham0992/link pattern |
| 8 | Related-documents panel — real LLM Jaccard replacement | ⏳ Planned | Replace overlap detection stub with dispatch LLM call |
| 9 | LLM Wiki engine (`src/dispatch/llmwiki.ts`) — Ingest/Lint/Save-to-Wiki | ⏳ Planned | knowledge-base profile; Karpathy pattern |
| 10 | `opencode-instructions.md` for all four bundled profiles | ⏳ Planned | Each must embed core philosophy + security/policy prompts |
| 11 | Frontmatter linter (`src/dispatch/linter.ts`) — full schema enforcement | ⏳ Planned | Runs on save; surfaces violations in Web UI |
| 12 | Promote workflow (`src/dispatch/promote.ts`) — status transitions | ⏳ Planned | Validates transitions against profile state machine |

## Phase Context

See \[\[plans/phase-3-vault-portability-pilot\]\] for Phase 3 deliverables. Phase 4 begins after Phase 3 is complete and vault portability is established.

\## Review Context

  

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-08 | Renumbered Phase 3 → Phase 4; depends\_on updated to phase-3-vault-portability-pilot | NetYeti |
| 2026-06-03 | Created — roadmap placeholder, Phase 2 in progress | NetYeti |