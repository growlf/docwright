---
title: Developer collaboration model - issue store of record, GitHub/Forgejo sync, and ticket hierarchy
status: completed
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
automated: full
phase: 4
milestone: v0.6.0
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
total_steps: 7
completed_steps: 7
tracked_by:
  - issues/collaboration-schema-linkage-fields.md
  - issues/collaboration-lock-deliverables-format.md
  - issues/collaboration-issue-generation-at-plan-start.md
  - issues/collaboration-derived-plan-progress.md
  - issues/collaboration-enforcement-linting.md
  - issues/collaboration-scope-freeze-enforcement.md
  - issues/collaboration-sync-strategy.md
scenario_synthesis: Developer collaboration - single store of record, bidirectional plan-issue linkage, auto-generation at plan-start, derived progress, enforcement linting, scope-freeze, sync to GitHub/Forgejo
gate_note: "Changed files are untestable types: issues/collaboration-sync-strategy.md, plans/collaboration-issue-model-and-roadmap-sync.md"
---
# Developer collaboration model: issue store of record, GitHub/Forgejo sync, and the ticket hierarchy

## Overview

Delivers the approved proposal \[\[proposals/approved/collaboration-issue-model-and-roadmap-sync.md\]\] — see it for the full _what & why_.

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
| --- | --- | --- |
| 1 | Add plan/issue linkage schema fields (tracked_by, plan, cross_link) | ✅ Done |
| 2 | Lock deliverables format (YAML array vs markdown table) | ✅ Done |
| 3 | Issue generation at plan-start (MCP tool) | ✅ Done |
| 4 | Derived plan progress (compute from issue state) | ✅ Done |
| 5 | Enforcement linting (priority, epic, tracked_by required) | ✅ Done |
| 6 | Scope-freeze enforcement (optional v0.6.0, required v0.7.0) | ✅ Done |
| 7 | Sync strategy (one-way mirror mechanics) | ✅ Done |

## Tracked Issues

All 7 implementation steps are tracked as issues in issues/collaboration-\*.md:

- collaboration-schema-linkage-fields
- collaboration-lock-deliverables-format
- collaboration-issue-generation-at-plan-start
- collaboration-derived-plan-progress
- collaboration-enforcement-linting
- collaboration-scope-freeze-enforcement
- collaboration-sync-strategy

## Sync Strategy (GitHub/Forgejo mirror)

**Direction:** One-way, `issues/` → tracker (file is source of truth; tracker is read-only projection)

**Field Mapping:**

| Vault field | GitHub/Forgejo field | Notes |
| --- | --- | --- |
| `status` | Issue state (open/closed) | open = new/triaged/scope-checked/awaiting/proposal-linked/in-progress; closed = resolved/duplicate/deferred |
| `priority` | Label (priority-high, priority-medium, priority-low) | Always set |
| `milestone` | Milestone (v0.5.0, v0.6.0, future) | Synced from issue frontmatter |
| `assigned_to` | Assignees (multi-select) | Synced as list of GitHub usernames |
| `plan` | Epic (GitHub) or Link (Forgejo) | Bidirectional: issue → plan, plan → issues |

**Conflict Resolution:** File always wins; tracker treated as stale mirror. Any out-of-sync state is resolved by re-syncing from `issues/` (Vault is canonical).

**Trigger Method:**

- **v0.6.0:** Manual CLI (`docwright sync --target github` or `--target forgejo`)
- **v0.7.0:** Post-commit hook (automatic sync after each commit)

**Forgejo Scope:** Same tool (uses REST API endpoint) but different host. Each organization runs its own Forgejo server. Sync logic handles both via parametrized API calls.

**Implementation Timeline:**

- v0.6.0: Manual CLI; blocks on Forgejo infra (Phase 5)
- v0.7.0: Post-commit automation; adds GitHub → Vault backlink for product issues (separate from dev)

### Gate Criteria

- [x] All 7 implementation steps complete and verified
- [x] Bidirectional wikilink system working end-to-end
- [x] Enforcement linting active (priority, epic, tracked_by required)
- [x] One-way sync architecture documented and validated
- [x] No production deployments affected (Phase 5 scope)

## Testing Plan

- Round-trip test: proposal → plan → issues → completion, no drift
- Schema validation: tracked_by accepts and rejects properly
- Issue generation: YAML deliverables spawn issues with linkage
- Bidirectional links: issues reference plan, plan lists issues
- Linting: priority/epic required, in-progress plans need tracked_by
- Derived progress: completion computed from issue state
- Enforcement: proposal_source edits blocked post-Start
- Sync strategy: field mapping correctly applies; conflict resolution favors file

## Rollback Procedures

- Issue generation fails: re-run with --force
- Schema migration breaks: make fields optional, backfill async
- Derived progress wrong: revert plan from git, recompute from issues

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| Schema breaking change | Make optional initially, enforce post-proposal-link only |
| Undefined deliverables format | Lock YAML array format before building tool |
| Scope-change drift | Pre-commit blocks proposal_source edits (v0.7.0) |
| Issue generation complexity | Start simple YAML, expand later |
| GitHub sync drift | Manual process in v0.6.0, automate v0.7.0 |
| Forgejo parity | Defer to Phase 5 |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-02 | Created from approved proposal | NetYeti |
| 2026-07-06 | Moved to in-progress, generated 7 tracked issues | NetYeti |