---
title: Lifecycle Gates Extension Bundle
status: in-progress
author: NetYeti
created: 2026-06-06
tags: governance, gates, audit, scheduling, bundle
proposal_source: proposals/approved/lifecycle-gates-extension-bundle.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: true
total_steps: 15
completed_steps: 15
_path: plans/lifecycle-gates-extension-bundle.md
---
# Lifecycle Gates Extension Bundle

## Overview

Five deferred gate-extension proposals bundled into three phases. Each builds on the base gate mechanism from \[\[proposals/approved/phase-gate-sign-off.md\]\] and shares the same code paths (gate definition parser, frontmatter schema, status page display).

Phase 1: Multi-reviewer quorum + time-based triggers Phase 2: Governance audit log + retroactive audit scanner Phase 3: AI-assisted gate preparation (LLM pre-review summaries)

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Phase 1a — Multi-reviewer quorum: Extend gate schema in profile.json | Add `reviewers[]` (list of role refs), `quorum` (min approvals, default 1) to gate definition. Gate frontmatter gains `gate_reviews:` array: `{reviewer, role, status, date}`. Gate becomes approved when `count(status=approved) >= quorum`. | ✅ Done |
| 2 | Phase 1a — Multi-reviewer quorum: Status page gate display | Show per-reviewer state with N of M progress indicator in gate badge. | ✅ Done |
| 3 | Phase 1a — Multi-reviewer quorum: Dispatch gate parser update | Parse new gate\_reviews field from frontmatter. Quorum evaluation logic in gate evaluation path. | ✅ Done |
| 4 | Phase 1b — Time-based triggers: New trigger type "schedule" | Add `"trigger": "schedule"` option in gate definitions. `cadence` field: annually, quarterly, monthly, or ISO 8601 duration. `status_filter` for which doc statuses to evaluate. | ✅ Done |
| 5 | Phase 1b — Time-based triggers: Background overdue scan | Lazy evaluation on status page load + vault write. Finds docs where `last_gate_date + cadence < now`, flags as overdue. Document-level overrides: `review_cadence:` and `gate_reviewer:` frontmatter fields. | ✅ Done |
| 6 | Phase 1b — Time-based triggers: Status page overdue display | Show overdue gates in gate display with visual indicator. | ✅ Done |
| 7 | Phase 2a — Governance audit log: JSONL append-only log | Write `audit/lifecycle.jsonl` with NDJSON entries: timestamp, doc path, transition (from→to), actor, actor\_type (human/ai), gate reference, git commit hash. Written by dispatch `promote()` and gate sign-off flow. Fire-and-forget async writes. | ✅ Done |
| 8 | Phase 2a — Governance audit log: MCP audit query tool | `docwright_audit_query` — filter by document, actor, date range, transition type. | ✅ Done |
| 9 | Phase 2a — Governance audit log: Web UI Audit tab | Audit tab on status page with filter controls (doc, actor, date, type). | ✅ Done |
| 10 | Phase 2b — Retroactive audit: Scanner tool | `docwright gate-audit` — scans lifecycle docs, compares transitions against gate rules in profile.json. Outputs: doc path, transition, gate rule, current `gate_status`. Uses relationship engine for cross-doc dependency scanning. | ✅ Done |
| 11 | Phase 2b — Retroactive audit: --fix flag and MCP tool | `--fix` flag stamps `gate_status: waived` + `gate_note`. MCP `docwright_gate_audit` tool. Web UI findings display on Audit tab. | ✅ Done |
| 12 | Phase 3 — AI-assisted preparation: LLM pre-review on gate fire | When gate fires, before reviewer notification, dispatch runs LLM pre-review. Reads all docs in scope, checks incomplete items, produces readiness summary. | ✅ Done |
| 13 | Phase 3 — AI-assisted preparation: AI summary UI and storage | Summary presented alongside Approve/Critique/Waive in gate UI. Stored in `gate_note` with human decision. | ✅ Done |
| 14 | Phase 3 — AI-assisted preparation: Profile-configurable AI prompts | Each profile's `opencode-instructions.md` defines AI checks per gate type. Configurable, not hardcoded. | ✅ Done |
| 15 | End-to-end test coverage | Verify each phase with integration tests: gate parser, status display, audit log writes, retroactive scan, AI pre-review. | ✅ Done |

## Phase Gate

*    All Phase 1 steps done (steps 1–6)
*    All Phase 2 steps done (steps 7–11)
*    All Phase 3 steps done (steps 12–14)
*    E2E test coverage verified (step 15)
*    `tests_defined: true` set in frontmatter
*    Documentation generated from completed plan

## Testing Plan

*   Unit tests for gate definition parser extensions (Phase 1)
*   Unit tests for quorum evaluation logic (Phase 1a)
*   Integration test for time-based trigger overdue detection (Phase 1b)
*   Integration test for audit log writes and query (Phase 2a)
*   Integration test for retroactive audit scanner (Phase 2b)
*   Integration test for AI pre-review invocation and summary storage (Phase 3)
*   E2E: Gate sign-off flow with multi-reviewer quorum
*   E2E: Status page gate display with all new features

## Rollback Procedures

*   **Per-step rollback**: Each step touches distinct code paths (schema, parser, UI, query tool) — revert the specific files
*   **Phase rollback**: If a phase introduces regressions, revert its commits and re-evaluate dependencies on subsequent phases
*   **Full rollback**: `git revert` the bundle merge commit; re-set consumed\_by on any transitional proposals
*   **Audit log data**: JSONL append-only — no deletion. If log format changes, write to a new versioned file (`audit/lifecycle-v2.jsonl`) and migrate readers.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Base gate mechanism changes during bundle | Medium | Reworks gate parser code | Lock base gate API before Phase 1; coordinate with phase-gate-sign-off plan owner |
| Audit log writes slow down save path | Low | UX regression on every save | Fire-and-forget async writes; log I/O is separate from response |
| AI prep LLM behavior inconsistent | Medium | Unhelpful gate summaries | Profile-defined prompts are iterable; AI prep is advisory only, never blocks gate |
| Time-based triggers have no scheduler | Medium | Gates don't fire on schedule | Lazy evaluation on status page load + vault write — no separate scheduler needed |
| Multi-reviewer quorum conflicts with existing single-reviewer gates | Low | Backward compatibility break | Default quorum is 1; existing gates continue to work unchanged |

## Dependencies

*   Base gate mechanism (\[\[proposals/approved/phase-gate-sign-off.md\]\]) — must be stable before Phase 1
*   Relationship engine (\[\[proposals/approved/proposal-relationship-engine-and-plan-button.md\]\]) — used by Phase 2b retroactive audit
*   Dispatch LLM module (AI engine) — used by Phase 3

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-06 | Created from approved proposal | NetYeti |
| 2026-06-06 | Populated with phase-structured implementation steps from proposal | NetYeti@phoenix |
| 2026-06-06 | Phase 1a complete: gate schema in profile.json, dispatch gates.ts engine, status page Pending Gates display | NetYeti |
| 2026-06-06 | Phase 1b complete: schedule trigger type, cadence parsing, overdue scan on status load, Overdue Reviews section on status page | NetYeti |
| 2026-06-06 | Phase 2a complete: dispatch audit.ts module, audit/lifecycle.jsonl writer, /api/audit-query endpoint, Audit tab on status page with filters | NetYeti |
| 2026-06-06 | Phase 2b complete: retroactive audit scanner in gates.ts, /api/gate-audit endpoint with --fix, findings display on Audit tab | NetYeti |
| 2026-06-06 | Phase 3 complete: AI gatePreReview() engine, /api/gate-pre-review endpoint, AI button per pending gate with inline readiness summary, profile-configurable AI prompts per gate type | NetYeti |
| 2026-06-06 | Step 15 complete — 6 retroactiveAudit tests (fix mode, mixed states, type filtering) + 6 gatePreReview tests (ready/needs-work, step counts, interface conformance) written and passing. 90/90 dispatch tests green. | NetYeti |
| 2026-06-06 | Deferred proposal captured: automated-test-lifecycle.md — AI auto-generates tests on step completion, resets tests_defined on mutation, auto-certifies when coverage is full. Builds on Phase 3 AI scaffolding from this plan. | NetYeti |