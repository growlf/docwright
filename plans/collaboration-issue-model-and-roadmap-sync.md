---
title: Developer collaboration model - issue store of record, GitHub/Forgejo sync, and ticket hierarchy
status: in-progress
author: NetYeti
created: 2026-07-02
tags:
  - governance
  - process
  - collaboration
  - issues
  - milestones
  - roadmap
proposal_source: proposals/approved/collaboration-issue-model-and-roadmap-sync.md
priority: high
automated: guided
phase: 4
milestone: v0.6.0
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
total_steps: 7
completed_steps: 0
tracked_by:
  - issues/collaboration-schema-linkage-fields.md
  - issues/collaboration-lock-deliverables-format.md
  - issues/collaboration-issue-generation-at-plan-start.md
  - issues/collaboration-derived-plan-progress.md
  - issues/collaboration-enforcement-linting.md
  - issues/collaboration-scope-freeze-enforcement.md
  - issues/collaboration-sync-strategy.md
scenario_synthesis: Developer collaboration - single store of record, bidirectional plan-issue linkage, auto-generation at plan-start, derived progress, enforcement linting, scope-freeze, sync to GitHub/Forgejo
---

# Developer collaboration model: issue store of record, GitHub/Forgejo sync, and the ticket hierarchy

## Overview

Delivers the approved proposal [[proposals/approved/collaboration-issue-model-and-roadmap-sync.md]] — see it for the full *what & why*.

DocWright now tracks work in **two places** and this ambiguity already caused a concrete failure. This proposal picks a **single store of record** for developer work, defines how the other surface **mirrors** it, and codifies the **prioritized hierarchy** that lets independent contributors take clearly-scoped chunks without colliding.

**Status:** Plan in-progress with 7 tracked issues generated per collaboration model.

## Critique Notes (2026-07-06)

From comprehensive 2026-07-06 code review (agent aea8d1dd):

### What's Good
- Proposal is durable governance; vision is sound
- Triage/scope-check schema aligns with 3-phase model
- One-way mirror design respects invariants
- Correctly prevents issue-tracking on proposals

### Critical Gaps (now implementation steps)
All 7 critical gaps are now tracked as implementation deliverables (see Implementation Steps below).

## Implementation Steps

| # | Action | Status |
|---|--------|--------|
| 1 | Add plan/issue linkage schema fields (tracked_by, plan, cross_link) | ⏳ Pending |
| 2 | Lock deliverables format (YAML array vs markdown table) | ⏳ Pending |
| 3 | Issue generation at plan-start (MCP tool) | ⏳ Pending |
| 4 | Derived plan progress (compute from issue state) | ⏳ Pending |
| 5 | Enforcement linting (priority, epic, tracked_by required) | ⏳ Pending |
| 6 | Scope-freeze enforcement (optional v0.6.0, required v0.7.0) | ⏳ Pending |
| 7 | Sync strategy (one-way mirror mechanics) | ⏳ Pending |

## Tracked Issues

All 7 implementation steps are tracked as issues in issues/collaboration-*.md:
- collaboration-schema-linkage-fields
- collaboration-lock-deliverables-format
- collaboration-issue-generation-at-plan-start
- collaboration-derived-plan-progress
- collaboration-enforcement-linting
- collaboration-scope-freeze-enforcement
- collaboration-sync-strategy

## Testing Plan

- Round-trip test: proposal → plan → issues → completion, no drift
- Schema validation: tracked_by accepts and rejects properly
- Issue generation: YAML deliverables spawn issues with linkage
- Bidirectional links: issues reference plan, plan lists issues
- Linting: priority/epic required, in-progress plans need tracked_by
- Derived progress: completion computed from issue state
- Enforcement: proposal_source edits blocked post-Start

## Rollback Procedures

- Issue generation fails: re-run with --force
- Schema migration breaks: make fields optional, backfill async
- Derived progress wrong: revert plan from git, recompute from issues

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Schema breaking change | Make optional initially, enforce post-proposal-link only |
| Undefined deliverables format | Lock YAML array format before building tool |
| Scope-change drift | Pre-commit blocks proposal_source edits (v0.7.0) |
| Issue generation complexity | Start simple YAML, expand later |
| GitHub sync drift | Manual process in v0.6.0, automate v0.7.0 |
| Forgejo parity | Defer to Phase 5 |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-02 | Created from approved proposal | NetYeti |
| 2026-07-06 | Moved to in-progress, generated 7 tracked issues | NetYeti |
