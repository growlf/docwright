---
title: "Lifecycle Gates Phase 2 — AI Assistance, Quorum, Scheduled Triggers, Retroactive Audit, and Governance Log"
status: draft
author: "NetYeti"
created: "2026-06-08"
created_by: "NetYeti@phoenix"
tags: [governance, gates, audit, ai, lifecycle]
proposal_source: "proposals/approved/bundle-lifecycle-gates-phase-2"
priority: high
mode: guided
assigned_to: netyeti
related_to:
  - plans/completed/lifecycle-gates-extension-bundle.md
  - plans/phase-4-profile-acl-ai.md
depends_on:
  - plans/completed/lifecycle-gates-extension-bundle.md
  - plans/phase-4-profile-acl-ai.md
blocks: []
tests_defined: true
tests_human_reviewed: true
total_steps: 5
completed_steps: 4
phase: 4
github_epic: null
milestone: v0.5.0
channel: beta
---

# Lifecycle Gates Phase 2 — AI Assistance, Quorum, Scheduled Triggers, Retroactive Audit, and Governance Log

## Overview

Five deferred gate proposals consolidated: AI-assisted preparation (surveys scope, drafts readiness summary for reviewers), multi-reviewer quorum (per-reviewer state tracking, quorum requirement in profile.json), time-based and scheduled triggers (cadence-based gate firing with overdue detection), retroactive audit (vault scan for transitions that bypassed gates, with --fix option), and governance audit log (append-only JSONL log of every lifecycle transition, committed to git).

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | AI-assisted gate preparation | Before presenting a gate to a reviewer, AI reads all documents in scope, checks for incomplete items, flags inconsistencies, drafts readiness summary. Summary stored in gate_note. Profile's opencode-instructions.md defines AI checks per gate type. Wires into promote.ts once that ships (Phase 4 Step 12). | ⏳ Pending | — | — |
| 2 | Multi-reviewer quorum | GateDefinition type (quorum, gate_reviews array, per-reviewer state), evaluateGate() quorum check, applyReview() — all fully implemented in src/dispatch/gates.ts. Integration into promote.ts completes this step. | ✅ Done | — | — |
| 3 | Time-based and scheduled triggers | parseCadence(), isOverdue(), getScheduleGatesForDocument(), schedule trigger type with status_filter — all fully implemented in src/dispatch/gates.ts. | ✅ Done | — | — |
| 4 | Retroactive audit of past transitions | retroactiveAudit() with AuditFinding type, findings array, and --fix option fully implemented in src/dispatch/gates.ts. | ✅ Done | — | — |
| 5 | Governance audit log | writeAuditEntry(), logTransition(), readAllEntries(), queryAudit() — append-only NDJSON with git_commit tracking fully implemented in src/dispatch/audit.ts. Integration into promote.ts completes the dispatch wiring. | ✅ Done | — | — |

## Parallelism Map

Steps that share no overlapping files can be worked simultaneously on separate `feat/` branches.
Fill in Depends On and Parallel With based on reviewing the step details above.

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | phase-4-profile-acl-ai Step 12 (promote.ts), Step 5 (AI write ACL) | — | Only remaining work; wires OpenCode call into gate_note on pre-review |
| 2 | ✅ Already shipped | — | gates.ts: evaluateGate(), applyReview(), GateDefinition.quorum |
| 3 | ✅ Already shipped | — | gates.ts: parseCadence(), isOverdue(), schedule trigger type |
| 4 | ✅ Already shipped | — | gates.ts: retroactiveAudit() |
| 5 | ✅ Already shipped | — | audit.ts: writeAuditEntry(), logTransition(), queryAudit() |

## Testing Plan

- [ ] Step 1: AI-assisted gate preparation (wires into promote.ts + opencode-instructions.md)
- [x] Step 2: Multi-reviewer quorum — implemented in gates.ts
- [x] Step 3: Time-based and scheduled triggers — implemented in gates.ts
- [x] Step 4: Retroactive audit — implemented in gates.ts
- [x] Step 5: Governance audit log — implemented in audit.ts
1. Gate fires with AI summary present — verify reviewer sees AI output
2. Quorum: single reviewer approves — gate stays pending until quorum met
3. Quorum: all reviewers approve — gate transitions
4. Scheduled gate: document past cadence — shows as overdue on status page
5. Retroactive audit: scan detects pre-gate transitions correctly
6. Audit log: every status transition produces a JSONL entry
7. Audit log: entries survive git commit and clone

## Rollback Procedures

- AI gate prep: remove AI review step from gate flow
- Quorum: revert to single-reviewer gate definition
- Scheduled triggers: remove schedule trigger type from gate definitions
- Retroactive audit: the --fix flag stamps are reversible by editing frontmatter
- Audit log: entries are append-only; no rollback needed. If format changes, migrate the JSONL file.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI-assisted prep produces inaccurate summaries | Medium | Medium | AI prepares, human decides always; reviewer can override/dismiss AI summary |
| Quorum causes gate deadlock if reviewer is unavailable | Medium | High | Gates support waiver option to bypass stalled quorum; profile.json can set quorum=1 |
| Audit log file grows large over time | Low | Low | JSONL is line-oriented and compressible; implement log rotation for large vaults |
| Retroactive audit floods with false positives | Medium | Low | Audit findings are advisory — --fix is explicit opt-in; false positives are searchable and can be ignored |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Plan filled in from proposal — AI prep, quorum, scheduled triggers, retroactive audit, audit log — 5 steps with testing and risk | NetYeti |
