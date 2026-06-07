---
title: Proposal Relationship Engine and Plan Button
status: completed
completed_date: 2026-06-05
author: NetYeti
created: 2026-06-05
tags:
  - workflow
  - collation
  - plans
  - relationships
  - dependencies
  - proposals
proposal_source: proposals/approved/proposal-relationship-engine-and-plan-button.md
priority: medium
automated: guided
assigned_to: NetYeti
total_steps: 12
completed_steps: 12
gate_status: none
tests_defined: true
---

## Summary

Replace the auto-plan-on-approval flow with a shared Relationship Detection Engine that powers: (a) automatic hierarchy detection when new proposals are created, and (b) a manual "Plan" button on approved proposals that scans all proposals and bundles related ones into a cohesive plan.

## Implementation Steps

### Part 1 — Relationship Detection Engine

| # | Deliverable | Details | Status |
| --- | --- | --- | --- |
| 1 | Define relationship schema and classification logic | Types, interfaces, multi-signal engine, confidence scoring, map I/O (`src/dispatch/relationships.ts`) | ✅ Done |
| 2 | Jaccard keyword similarity scanner across proposals + plans | Existing `KeywordEngine` with signal layering | ✅ Done |
| 3 | `.docwright/proposal-relationships.json` + incremental rebuild | Save hook triggers async `rebuildRelationships()` on proposal/plan writes | ✅ Done |
| 4 | LLM-based semantic analysis as optional upgrade | Existing `OpenCodeEngine` with graceful KeywordEngine fallback | ✅ Done |

### Part 2 — Hierarchy Detection on New Proposal Creation

| # | Deliverable | Details | Status |
| --- | --- | --- | --- |
| 5 | Wire engine to run on new proposal creation (async, non-blocking) | Hook into save endpoint; background scan | ✅ Done |
| 6 | Build relationship confirmation dialog (accept/reject/adjust detected links) | UI component for reviewing detected relationships | ✅ Done |
| 7 | Implement re-scan on meaningful proposal body updates | Diff-based trigger for update detection | ✅ Done |

### Part 3 — "Plan" Button on Approved Proposals

| # | Deliverable | Details | Status |
| --- | --- | --- | --- |
| 8 | Add "Plan →" button to properties pane, document toolbar, and status page | Visible on approved:true; gated by ACL tier | ✅ Done |
| 9 | Build results panel showing bundle candidates (auto-selected) and suggestions | Checkbox UI with confidence indicators | ✅ Done |
| 10 | Implement plan scaffolding: template-based, consumes selected proposals | Sets consumed_by frontmatter; status: draft; phase inheritance | ✅ Done |
| 11 | Handle edge cases: no related proposals, existing plan overlap, dependency chains, already-planned proposals | Graceful fallbacks for all edge cases | ✅ Done |

### Part 4 — Per-Profile Configuration

| # | Deliverable | Details | Status |
| --- | --- | --- | --- |
| 12 | Add `relationship_engine` config block + respect profile flags | ProfileConfig type, validation, wiring | ✅ Done |

## Phase Gate

- [x] All 12 implementation steps complete
- [x] Relationship engine tests passing (52/52)
- [x] Edge cases handled (no related, existing plan, dependency chains, already-planned)
- [x] Profile config wired (show_plan_button, similarity_threshold, auto_detect flags)
- [x] Plan template updated (tests_defined: false included for future plans)

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-05 | Part 1 complete — schema, scanner, map rebuild, LLM upgrade path | NetYeti |
| 2026-06-06 | Part 2 complete (steps 5-7) — auto-scan, confirmation dialog, diff gate. Part 3 steps 8-10 — Plan button, bundle UI, scaffold endpoint | NetYeti |
| 2026-06-06 | Steps 11-12 done — edge cases (dep chains, already-planned, existing plan) + profile config wiring (show_plan_button, similarity_threshold, auto_detect flags) | NetYeti |