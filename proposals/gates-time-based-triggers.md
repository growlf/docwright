---
complexity: low
title: "Lifecycle Gates — Time-Based and Scheduled Triggers"
author: NetYeti
created: 2026-06-03
tags:
  - governance
  - gates
  - scheduling
  - improvements
deferred: true
deferred_reason: "Depends on base gate mechanism (see proposals/phase-gate-sign-off.md). Revisit after launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/phase-gate-sign-off.md
---

## Problem

The base gate mechanism fires on event triggers (transition attempts, phase
completions). Some governance obligations are time-driven rather than
event-driven: a policy must be reviewed annually, a security audit runs every
quarter, an infrastructure inventory is verified each month. There is currently
no way to express these cadences in DocWright.

## Proposed Solution

Extend gate definitions in `profile.json` with a `schedule` trigger type:

```json
{
  "id": "policy-annual-review",
  "trigger": "schedule",
  "cadence": "annually",
  "document_type": "policy",
  "status_filter": ["active"],
  "reviewer_field": "gate_reviewer",
  "description": "All active policies must be reviewed annually"
}
```

Scheduled gates would:
- Be evaluated by a background process (or a pre-commit hook on any file in
  the vault, lazy evaluation)
- Surface on the status page as overdue when the cadence has elapsed since
  `gate_date` was last stamped
- Fire the same approve / critique-round / waive flow as event-based gates

Document frontmatter gains a `review_cadence:` field so individual documents
can override the profile default:

```yaml
review_cadence: quarterly   # overrides profile default of annually
gate_reviewer: NetYeti
gate_status: approved
gate_date: 2026-03-01       # next review due 2026-06-01
```

## Deferred Because

Base gate mechanism must be stable. Scheduled triggers also require a
background evaluation process that is not yet in scope.
See [[proposals/phase-gate-sign-off.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from base gate proposal out-of-scope | NetYeti |
