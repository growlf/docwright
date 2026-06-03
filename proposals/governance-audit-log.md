---
complexity: low
title: "Governance Audit Log — Lifecycle Transition Logging"
author: NetYeti
created: 2026-06-03
tags:
  - governance
  - audit
  - lifecycle
  - dispatch
  - improvements
approved: false
deferred: true
deferred_reason: "Depends on gate mechanism and dispatch module being stable. Revisit after Phase 3 lifecycle enforcement is complete."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/enforce-lifecycle-compliance.md
  - proposals/phase-gate-sign-off.md
  - plans/phase-3-profile-acl-ai.md
---

## Problem

DocWright enforces lifecycle rules (status transitions, frontmatter validation,
gate sign-offs) but does not produce a queryable audit record of what changed,
when, and by whom. Git history provides a partial record but requires `git log`
expertise to interrogate. There is no structured log that a governance officer
or automated tool can query: "show me every document that transitioned from
`draft` to `active` in the last 30 days and who signed off."

## Proposed Solution

A structured governance audit log that records every lifecycle transition as
an append-only entry:

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

**What is logged:**
- Every status transition (via pre-commit hook or dispatch `promote()`)
- Gate approvals, critiques, and waivers
- AI write actions (`actor_type: "ai"`, `ai_model`, `ai_action` fields)
- Deferred idea captures (so the audit trail shows ideas were considered)

**Query interface:**
- MCP tool: `docwright_audit_query` (filter by document, actor, transition, date range)
- Web UI: an Audit tab on the status page with filter controls
- CLI: `docwright audit [--since 30d] [--document path] [--actor name]`

The log file is committed to git on each transition, so it is itself
version-controlled and tamper-evident.

## Deferred Because

Meaningful audit logging requires the gate mechanism and dispatch-level
lifecycle enforcement to be complete and stable — otherwise the log is
incomplete from day one and gives false assurance.
See [[proposals/phase-gate-sign-off.md]] and [[plans/phase-3-profile-acl-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from enforce-lifecycle-compliance proposal | NetYeti |
