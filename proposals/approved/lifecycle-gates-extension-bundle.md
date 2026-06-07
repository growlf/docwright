---
title: Lifecycle Gates Extension Bundle
author: NetYeti
created: 2026-06-06
tags:
  - governance
  - gates
  - audit
  - scheduling
  - bundle
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/gates-ai-assisted-preparation.md
  - proposals/gates-multi-reviewer-quorum.md
  - proposals/gates-retroactive-audit.md
  - proposals/gates-time-based-triggers.md
  - proposals/governance-audit-log.md
  - proposals/approved/phase-gate-sign-off.md
_path: proposals/lifecycle-gates-extension-bundle.md
consumed_by: plans/completed/lifecycle-gates-extension-bundle.md
---

## Problem

The base gate mechanism ([[proposals/approved/phase-gate-sign-off.md]]) provides
event-driven single-reviewer gates. Five deferred proposals extend this into a
complete governance toolkit. Each is individually small but shares a common
dependency (stable gate mechanism) and touches the same code paths (gate
definition parsing, gate review flow, status page display). Individually they
invite rework; bundled they share infrastructure.

## Proposals Consumed

| # | Proposal | Focus | Depends On |
|---|----------|-------|------------|
| 1 | [[proposals/gates-multi-reviewer-quorum]] | Multi-reviewer sign-off with quorum count | Base gate + profile.json gate definition extension |
| 2 | [[proposals/gates-time-based-triggers]] | Scheduled/cadence gate triggers | Base gate + background eval mechanism |
| 3 | [[proposals/gates-ai-assisted-preparation]] | AI pre-review summaries for reviewers | Base gate + dispatch LLM module |
| 4 | [[proposals/gates-retroactive-audit]] | Scan past transitions for missing sign-offs | Base gate + relationship engine |
| 5 | [[proposals/governance-audit-log]] | Append-only structured lifecycle log | Base gate + lifecycle enforcement dispatch |

## Proposed Solution

Build in dependency order, with each step laying groundwork for the next:

### Phase 1 — Gate Definition Extension (covers proposals 1, 2)

Extend the gate schema in `profile.json` and the dispatch gate parser to support
two new capabilities in a backward-compatible way:

**Multi-reviewer quorum:**
- `reviewers[]` — list of required reviewer roles (references ACL tiers)
- `quorum` — minimum number of approvals required (default 1)
- Gate frontmatter gains `gate_reviews:` array — each entry is `{reviewer, role, status, date}`
- Status page shows per-reviewer state with a "N of M" progress indicator
- Gate becomes `approved` when `gate_reviews.count(status=approved) >= quorum`

**Time-based triggers:**
- New trigger type `"trigger": "schedule"` in gate definitions
- `cadence` field: `annually`, `quarterly`, `monthly`, or ISO 8601 duration
- `status_filter`: only documents in certain statuses are evaluated
- Background scan (triggered by `rebuildRelationships()` or a cron-like check on
  status page load) finds documents where `last_gate_date + cadence < now` and
  flags them as overdue on the status page
- Documents can override cadence via frontmatter `review_cadence:` and
  `gate_reviewer:` fields

### Phase 2 — Audit Infrastructure (covers proposals 4, 5)

Both the retroactive audit and the governance audit log read/write a shared
audit trail. Build the log first, then the scanner:

**Governance audit log** (`audit/lifecycle.jsonl`):
- Every lifecycle transition writes an append-only NDJSON entry: timestamp,
  document path, transition (from → to), actor, actor_type (human/ai), gate
  reference, git commit hash
- Written by the dispatch `promote()` function and the gate sign-off flow
- MCP tool `docwright_audit_query` — filter by document, actor, date range,
  transition type
- Web UI Audit tab on status page with filter controls
- Committed to git on each transition — tamper-evident via git history

**Retroactive audit** (`docwright gate-audit`):
- Scans all lifecycle docs, compares actual transitions against gate rules in
  `profile.json`
- Outputs: document path, transition, gate rule that should have applied,
  current `gate_status`
- With `--fix` flag: stamps `gate_status: waived` + `gate_note` on each finding
  (honest record of "gate did not exist at time")
- Uses the relationship engine to handle cross-document dependency scanning
- MCP tool `docwright_gate_audit` + Web UI Audit tab showing findings

### Phase 3 — AI-Assisted Preparation (covers proposal 3)

Layer AI onto the gate review flow:
- When a gate fires, before the reviewer is notified, the dispatch module runs
  an LLM pre-review
- The LLM reads all documents in scope, checks for incomplete items, and
  produces a readiness summary with specific concerns highlighted
- Summary is presented alongside the Approve / Critique / Waive options in the
  gate UI
- Each profile's `opencode-instructions.md` defines what the AI checks per gate
  type (configurable)
- AI summary is stored in `gate_note` alongside the human decision for audit

## Scope Boundaries (What This Bundle Does NOT Cover)

| Out of scope | Rationale |
|---|---|
| Base gate mechanism itself | Handled by [[proposals/approved/phase-gate-sign-off.md]] |
| Gate UI redesign | Existing gate UI is extended, not replaced |
| Email/push notification for reviewers | Out of scope for this bundle (see [[proposals/enterprise-email-intake]]) |
| Automated gate enforcement (no human) | Gates always require human approval per governance principle |
| phase-gate-sign-off migration | Existing plan handles the base mechanism |

## Alternatives Considered

**Ship each proposal independently.** Rejected — each extension touches the same
gate definition parser, gate frontmatter schema, and status page gate display.
Building them sequentially would cause merge conflicts and repeated refactoring
of the same code paths. Bundling them avoids this.

**Skip audit log, use git log only.** Rejected — git log requires CLI expertise
and does not surface gate decisions or AI actions in a structured, queryable
format. The JSONL audit log is a governance requirement, not a developer tool.

**Build AI prep first.** Rejected — AI prep is the least well-defined extension
(the LLM behavior depends on profile instructions that don't exist yet). Building
it after the gate definition extensions are stable reduces risk.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Base gate mechanism changes during this bundle | Medium | Reworks gate parser code | Lock base gate API before starting Phase 1; coordinate with phase-gate-sign-off plan owner |
| Audit log writes slow down save path | Low | UX regression on every save | Write is async (fire-and-forget); log write is separate from response |
| AI prep LLM behavior is inconsistent | Medium | Unhelpful gate summaries | Profile-defined prompts can be iterated; AI prep is advisory only, never blocks the gate |
| Time-based triggers have no reliable scheduler | Medium | Gates don't fire on schedule | Use lazy evaluation (check on status page load + on any vault write) — no separate scheduler process needed |

## Implementation Order

```
Phase 1a: Multi-reviewer quorum  ──────┐
Phase 1b: Time-based triggers  ────────┤
Phase 2a: Governance audit log  ───────┼──→ Shared: gate def parser + status page
Phase 2b: Retroactive audit  ──────────┤
Phase 3: AI-assisted preparation  ─────┘
```

Each phase builds on the gate definition extensions from Phase 1. The audit
infrastructure (Phase 2) feeds the gate review UI that AI prep (Phase 3) enriches.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-06 | Created — bundles 5 deferred gate-extension proposals | NetYeti |
