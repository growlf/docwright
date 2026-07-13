---
title: "Lifecycle Gates Phase 2 — AI Assistance, Quorum, Scheduled Triggers, Retroactive Audit, and Governance Log"
status: completed
completed_date: 2026-07-11
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
part_of: plans/release-v0.5.0.md
tests_defined: true
tests_human_reviewed: true
total_steps: 5
completed_steps: 5
phase: 4
github_epic: null
milestone: v0.5.0
channel: stable
scenario_synthesis: "Happy path: before a reviewer signs off a gate, the AI pre-review engine surfaces a readiness summary (ready/needs-work/blocked + concerns) for the human; the quorum, scheduled-trigger, retroactive-audit, and governance-log engines shipped in gates.ts/audit.ts and wire through promote.ts. Failure paths: AI summary generation fails → the offline KeywordEngine fallback still returns a summary and the human path is never blocked on AI; retroactive audit --fix only proposes corrections, a human commits them; the audit log is append-only NDJSON — a failed write aborts the transition rather than losing the record."
automated: full
gate_note: "AI pre-review is display-only / non-blocking by design; orphaned checkWithAI removed in PR #331."
tests_last_run: "2026-07-11T17:37:10.940Z"
tests_last_result: pass
tests_last_commit: e5f783b
_path: plans/completed/lifecycle-gates
---

# Lifecycle Gates Phase 2 — AI Assistance, Quorum, Scheduled Triggers, Retroactive Audit, and Governance Log

## Overview

Five deferred gate proposals consolidated: AI-assisted preparation (surveys scope, drafts readiness summary for reviewers), multi-reviewer quorum (per-reviewer state tracking, quorum requirement in profile.json), time-based and scheduled triggers (cadence-based gate firing with overdue detection), retroactive audit (vault scan for transitions that bypassed gates, with --fix option), and governance audit log (append-only JSONL log of every lifecycle transition, committed to git).

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | AI-assisted gate preparation | Before a reviewer signs off a gate, the AI reads the doc + scope (related_to/depends_on/blocks), flags incomplete items, and drafts a readiness summary (ready/needs-work/blocked). Shipped via `src/dispatch/ai.ts` `AIEngine.gatePreReview()` (offline KeywordEngine + OpenCode + Ollama engines) surfaced through the `/api/gate-pre-review` endpoint and the status-page per-gate "AI" readiness badge. Per-gate prompts live in `profile.json` `ai_pre_review_prompt`. Display-only / non-blocking: the human always decides. The originally-anticipated `promote.ts::checkWithAI()` wiring was superseded by the engine path and removed as dead code (PR #331). | ✅ Done | — | #331 |
| 2 | Multi-reviewer quorum | GateDefinition type (quorum, gate_reviews array, per-reviewer state), evaluateGate() quorum check, applyReview() — all fully implemented in src/dispatch/gates.ts. Integration into promote.ts completes this step. | ✅ Done | — | — |
| 3 | Time-based and scheduled triggers | parseCadence(), isOverdue(), getScheduleGatesForDocument(), schedule trigger type with status_filter — all fully implemented in src/dispatch/gates.ts. | ✅ Done | — | — |
| 4 | Retroactive audit of past transitions | retroactiveAudit() with AuditFinding type, findings array, and --fix option fully implemented in src/dispatch/gates.ts. | ✅ Done | — | — |
| 5 | Governance audit log | writeAuditEntry(), logTransition(), readAllEntries(), queryAudit() — append-only NDJSON with git_commit tracking fully implemented in src/dispatch/audit.ts. Integration into promote.ts completes the dispatch wiring. | ✅ Done | — | — |

## Parallelism Map

Steps that share no overlapping files can be worked simultaneously on separate `feat/` branches.
Fill in Depends On and Parallel With based on reviewing the step details above.

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | ✅ Shipped | — | ai.ts gatePreReview() + /api/gate-pre-review + status-page AI badge; dead promote.ts wiring removed (PR #331) |
| 2 | ✅ Already shipped | — | gates.ts: evaluateGate(), applyReview(), GateDefinition.quorum |
| 3 | ✅ Already shipped | — | gates.ts: parseCadence(), isOverdue(), schedule trigger type |
| 4 | ✅ Already shipped | — | gates.ts: retroactiveAudit() |
| 5 | ✅ Already shipped | — | audit.ts: writeAuditEntry(), logTransition(), queryAudit() |

## Testing Plan

- [x] Step 1: AI-assisted gate preparation — `AIEngine.gatePreReview()` covered by test/dispatch/ai.test.ts (23 passing incl. KeywordEngine gatePreReview ready/needs-work/blocked + scope-doc handling); wiring intact via `/api/gate-pre-review` → status-page AI badge; orphaned `checkWithAI` removed (PR #331), typecheck clean, 63 dispatch tests green
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

## Phase Gate

Completion criteria — all must be checked before the plan transitions to completed:

- [x] All 5 implementation steps are ✅ Done
- [x] Testing Plan fully verified with per-step evidence (see above)
- [x] Automated suite recorded green via verify_plan_tests (`npm run test:dispatch` → PASS @ e5f783b)
- [x] AI pre-review confirmed display-only / non-blocking; orphaned `checkWithAI` removed and merged (PR #331)
- [x] Rollback procedures documented per feature

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Plan filled in from proposal — AI prep, quorum, scheduled triggers, retroactive audit, audit log — 5 steps with testing and risk | NetYeti |
| 2026-07-11 | Test run recorded via verify_plan_tests: npm run test:dispatch → PASS @ e5f783b | NetYeti |
| 2026-07-11 | Step 1 closed: AI-assisted gate prep shipped via ai.ts engine + /api/gate-pre-review + status-page badge; orphaned promote.ts checkWithAI removed (PR #331). Plan 5/5, Phase Gate added, staged for completion. | NetYeti |
