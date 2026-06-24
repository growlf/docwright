---
title: Lifecycle Gates Phase 2 — AI Assistance, Quorum, Scheduled Triggers, Retroactive Audit, and Governance Log
author: NetYeti
created: 2026-06-06
tags:
  - governance
  - gates
  - audit
  - ai
  - lifecycle
  - phase-3
complexity: high
estimated_effort: XL
approved: true
created_by: NetYeti@phoenix
assigned_to: netyeti
absorbs:
  - proposals/gates-ai-assisted-preparation.md
  - proposals/gates-multi-reviewer-quorum.md
  - proposals/gates-retroactive-audit.md
  - proposals/gates-time-based-triggers.md
  - proposals/governance-audit-log.md
depends_on:
  - plans/completed/lifecycle-gates-extension-bundle.md
  - plans/phase-4-profile-acl-ai.md
_path: proposals/approved/bundle-lifecycle-gates-phase-2.md
consumed_by: plans/bundle-lifecycle-gates-phase-2.md
---

## Problem

The completed lifecycle gates mechanism (Phase 1 gates) establishes the base
sign-off flow. Five deferred proposals represent the logical next layer:
making gates smarter (AI-assisted), more authoritative (quorum), time-aware
(scheduled triggers), retroactively enforceable (audit of pre-gate transitions),
and queryable (structured audit log). All five share the same prerequisite —
a stable base gate mechanism — and should ship together in Phase 3.

## Proposed Solution

### 1. AI-Assisted Gate Preparation

Before presenting the gate to a reviewer, an AI agent surveys the scope and
drafts a readiness summary:

1. Gate fires (phase complete, transition attempted)
2. AI reads all documents in scope, checks for incomplete items, flags
   inconsistencies, drafts a "ready for sign-off?" summary with specific
   concerns highlighted
3. Reviewer receives the AI summary alongside Approve / Critique / Waive options
4. Human makes the final call — AI prepares, never decides

The AI summary is stored in `gate_note` alongside the reviewer's decision for
audit. Each profile's `opencode-instructions.md` defines what the AI checks
during pre-review for each gate type.

### 2. Multi-Reviewer Quorum

Extend gate definitions in `profile.json` to support a quorum requirement:

```json
{
  "id": "policy-activate",
  "trigger": "status-transition",
  "from": "draft", "to": "active",
  "document_type": "policy",
  "reviewers": ["lead", "security-officer"],
  "quorum": 2,
  "description": "Policy activation requires sign-off from both lead and security officer"
}
```

Gate frontmatter carries per-reviewer state:

```yaml
gate_reviews:
  - reviewer: NetYeti
    status: approved
    date: 2026-06-10
  - reviewer: security-officer
    status: pending
    date:
```

Gate remains `pending` until quorum is reached. Status page shows per-reviewer
state. Each reviewer acts independently.

### 3. Time-Based and Scheduled Triggers

Extend gate definitions with a `schedule` trigger type:

```json
{
  "id": "policy-annual-review",
  "trigger": "schedule",
  "cadence": "annually",
  "document_type": "policy",
  "status_filter": ["active"],
  "description": "All active policies must be reviewed annually"
}
```

Document frontmatter gains `review_cadence:` to override the profile default.
Scheduled gates surface as overdue on the status page when the cadence has
elapsed since `gate_date` was last stamped. Fires the same approve / critique /
waive flow as event-based gates.

Evaluation strategy: lazy evaluation on pre-commit hook (or server-side cron
when [[proposals/bundle-enterprise-tier.md]] lands).

### 4. Retroactive Audit of Past Transitions

A vault scan that finds transitions that should have had a gate but did not:

```
docwright gate-audit [--profile org-operations] [--fix]
```

Output: lists every document where a gated transition occurred without a
recorded `gate_status: approved` or `gate_status: waived`, annotated with the
gate rule that would have applied.

With `--fix`: stamps each flagged document with `gate_status: waived` and
`gate_note: "Retroactive audit — gate did not exist at time of transition"`
so the record is honest and searchable.

MCP server gains a `docwright_gate_audit` tool. Status page gains an optional
**Audit** tab showing outstanding retroactive findings.

Particularly valuable for organizations adopting DocWright into an existing
vault where transitions predate the gate mechanism.

### 5. Governance Audit Log

A structured, append-only log of every lifecycle transition:

**Log format** (`audit/lifecycle.jsonl` — one JSON object per line):

```json
{
  "ts": "2026-06-03T14:22:00Z",
  "document": "policies/core/data-retention.md",
  "transition": { "from": "draft", "to": "active" },
  "actor": "NetYeti",
  "actor_type": "human",
  "gate": { "id": "policy-activate", "status": "approved", "reviewer": "NetYeti" },
  "commit": "a1b2c3d"
}
```

Logged events: every status transition (via pre-commit hook or dispatch
`promote()`), gate approvals/critiques/waivers, AI write actions (`actor_type:
"ai"` with `ai_model` and `ai_action` fields), deferred idea captures.

Query interface:
- MCP tool: `docwright_audit_query` (filter by document, actor, transition, date range)
- Web UI: Audit tab on the status page with filter controls
- CLI: `docwright audit [--since 30d] [--document path] [--actor name]`

Log file is committed to git on each transition — version-controlled and
tamper-evident.

## Relationship to Existing Work

| Proposal / Plan | Relationship |
|-----------------|-------------|
| [[plans/completed/lifecycle-gates-extension-bundle.md]] | Base gate mechanism this phase builds on |
| [[plans/phase-3-profile-acl-ai.md]] | AI-assisted preparation requires dispatch LLM integration; audit log belongs in Phase 3 |
| [[proposals/approved/enforce-lifecycle-compliance.md]] | Audit log is the queryable record of what enforcement produced |
| [[proposals/bundle-enterprise-tier.md]] | Scheduled triggers rely on server-side job scheduler for background evaluation |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| AI making gate decisions autonomously | AI prepares, human decides — always |
| Cross-vault gate federation | Phase 4+ multi-org concern |
| External gate approvals (email click-to-approve) | Enterprise future; requires server-side AI |
| Real-time gate violation alerting | Requires server-side scheduler (Enterprise Tier) |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-06 | Created — consolidated from 5 individual deferred proposals | NetYeti |
