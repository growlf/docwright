---
complexity: low
title: "Lifecycle Gates — Multi-Reviewer Quorum"
author: NetYeti
created: 2026-06-03
tags:
  - governance
  - gates
  - quorum
  - improvements
approved: false
deferred: true
deferred_reason: "Depends on base gate mechanism (see proposals/phase-gate-sign-off.md). Revisit after launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/phase-gate-sign-off.md
---

## Problem

The base gate mechanism supports a single reviewer per gate. For high-stakes
transitions — activating a security policy, decommissioning critical
infrastructure, approving a major architectural change — a single sign-off
may not provide sufficient assurance.

## Proposed Solution

Extend the gate definition in `profile.json` to support a quorum requirement:

```json
{
  "id": "policy-activate",
  "trigger": "status-transition",
  "from": "draft",
  "to": "active",
  "document_type": "policy",
  "reviewers": ["lead", "security-officer"],
  "quorum": 2,
  "description": "Policy activation requires sign-off from both lead and security officer"
}
```

Gate frontmatter would carry per-reviewer state:

```yaml
gate_reviews:
  - reviewer: NetYeti
    status: approved
    date: 2026-06-10
  - reviewer: security-officer
    status: pending
    date:
```

The gate remains `pending` until the quorum count is reached. Each reviewer
acts independently. The status page shows per-reviewer state so it is clear
who still needs to act.

## Deferred Because

Base gate mechanism must be stable before quorum logic is layered on.
See [[proposals/phase-gate-sign-off.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from base gate proposal out-of-scope | NetYeti |
