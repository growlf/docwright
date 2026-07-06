---
title: Developer collaboration model: issue store of record, GitHub/Forgejo sync, and the ticket hierarchy
status: draft
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
tests_defined: false
tests_human_reviewed: false
---

# Developer collaboration model: issue store of record, GitHub/Forgejo sync, and the ticket hierarchy

## Overview

Delivers the approved proposal [[proposals/approved/collaboration-issue-model-and-roadmap-sync.md]] — see it for the full *what & why*.

DocWright now tracks work in **two places** and this ambiguity already caused a concrete
failure. This proposal picks a **single store of record** for developer work, defines how the
other surface **mirrors** it, and codifies the **prioritized hierarchy** that lets independent
contributors take clearly-scoped chunks without colliding.

**Status:** Plan skeleton; filled with critical gaps identified in 2026-07-06 code review (see Critique Notes below).
When this plan moves to `in-progress`, these gaps will auto-generate as tracked issues per the collaboration model.

## Critique Notes (2026-07-06 — keep as direction reminders)

**From comprehensive review by research agent aea8d1dd:**

### What's Good
- ✅ Proposal is durable governance; vision is sound
- ✅ Triage/scope-check schema (just-shipped) aligns well with 3-phase model
- ✅ One-way mirror design respects invariants (git-canonical, no external DB)
- ✅ Correctly prevents issue-tracking on proposals (governance vs. work tickets)

### Critical Gaps to Fill (become deliverables)
1. **Schema linkage fields** — Add `tracked_by:` (on plans), `plan:` + `cross_link:` (on issues) to org-operations schema
2. **Deliverables format** — Lock format for plan deliverables (recommend YAML array; determines issue-generation tool design)
3. **Implementation steps** — Outline 7–8 concrete steps with acceptance criteria (see Implementation Steps table)
4. **Sync mechanics** — Brief one-way mirror strategy: field mapping (priority→labels, milestone→milestone), trigger (on-demand CLI in v0.6.0), conflict (file wins)
5. **Testing plan** — Fixtures: plan→issue round-trip, derived progress computation, scope-freeze enforcement
6. **Rollback procedures** — Recovery from issue-generation failure, schema migration rollback
7. **Risk assessment** — Schema breaking change migration path, scope-change drift prevention, enforcement strictness

### Dependencies & Scope Decision
- **In v0.6.0 scope:** Schema, issue generation, derived progress, linting (critical path)
- **Defer to v0.7.0:** Sync tool, scope-change decision flow, Forgejo parity

## Implementation Steps

| # | Action | Acceptance Criteria | Status |
|---|--------|-------------------|--------|
| 1 | Add plan/issue linkage schema fields | `tracked_by: []` on plan, `plan:` + `cross_link:` on issue in org-operations; backward-compat (optional initially) | ⏳ Pending |
| 2 | Lock deliverables format | Decision: YAML array vs. markdown table; document in profiles; build issue-generation tool against it | ⏳ Pending |
| 3 | Issue generation at plan-start (MCP) | When plan transitions to `in-progress`, scaffold one issue per deliverable; populate `tracked_by:` list; each issue gets back-link via `plan:` field | ⏳ Pending |
| 4 | Derived plan progress | Plan completion computed from linked issues' state (all resolved → plan eligible for completion); retire hand-updated step-table once issues exist | ⏳ Pending |
| 5 | Enforcement linting | Pre-commit + CI: every open issue must have priority; planned issues must have epic link; plan must have non-empty `tracked_by:` if in-progress | ⏳ Pending |
| 6 | Scope-freeze enforcement (optional v0.6.0, required v0.7.0) | Post-Start, block edits to plan's `proposal_source` without decision doc; or defer to v0.7.0 | ⏳ Pending |
| 7 | Sync strategy (mechanics deferred to sync-tool step) | Brief: one-way (file→tracker), fields, trigger (on-demand CLI), conflict resolution (file wins) | ⏳ Pending |

## Testing Plan

**Round-trip test:** proposal → approved → plan draft → plan in-progress (generates issues) → issues linked to plan → plan completion derived from issues. No drift.

**Fixture tests:**
- [ ] Schema validation: `tracked_by:` accepts list of issue references; rejects invalid format
- [ ] Issue generation: plan with `deliverables:` YAML array spawns one issue per item; `tracked_by:` list populated
- [ ] Bidirectional linkage: each generated issue has `plan:` field pointing back; each plan has `tracked_by:` with all issues
- [ ] Linting: `pre-commit.sh` rejects issue without priority; pre-commit rejects planned issue without epic; rejects in-progress plan without `tracked_by:` list
- [ ] Derived progress: plan's completion status correctly reflects issue state (reads from issues/ not hand-updated step-table)
- [ ] Enforcement: attempt to edit `proposal_source` on in-progress plan → rejected (or proposal of decision document required, per v0.7.0 design)

**Integration:** Full end-to-end in temp vault; no manual intervention; all generated files git-canonical.

## Rollback Procedures

| Scenario | Procedure |
|----------|-----------|
| Issue generation fails mid-stream | Re-run tool with `--force` to regenerate missing issues; `tracked_by:` list auto-reconciles on next plan transition |
| Schema migration breaks existing issues | Make `plan:` / `tracked_by:` optional; backfill async; pre-commit only enforces post-proposal-link |
| Derived progress computation incorrect | Manually revert plan step-table from git history; recompute from issue state using dryrun mode |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Schema breaking change (new fields) | Medium | High | Make fields optional; enforce only post-proposal-link; asynch backfill existing issues |
| Deliverables format undefined → tool can't extract | Medium | High | Lock format in decision step before building tool; test with fixtures |
| Scope-change silently breaks issue tracking | Medium | High | Pre-commit hook blocks `proposal_source` edits post-Start (v0.7.0); or require decision doc + manual override |
| Issue generation automation complexity | Medium | Medium | Start with simple YAML array format; expand to regex/markdown later if needed |
| Manual GitHub sync drift during v0.6.0 | High | Low | Document manual process in docwright-issue-workflow skill; automate in v0.7.0 (not critical path) |
| Forgejo parity (self-hosters) | Low | Medium | Defer to Phase 5 (when Forgejo is actual git server); interim: manual sync or GitHub-only |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-02 | Created from approved proposal | NetYeti |
