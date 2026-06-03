---
complexity: medium
title: "Enterprise — Scheduled Compliance Scans and Gate Notifications"
author: NetYeti
created: 2026-06-03
tags:
  - enterprise
  - compliance
  - scheduling
  - notifications
  - automation
  - improvements
deferred: true
deferred_reason: "Requires server-side AI and gate mechanism. Phase 3+."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/enterprise-server-ai.md
  - proposals/phase-gate-sign-off.md
  - proposals/gates-time-based-triggers.md
  - docs/deployment.md
---

## Problem

Governance compliance degrades silently between active sessions. Policies go
stale without anyone noticing. Phase gates sit `pending` for weeks. Plans
drift without status updates. No one is reminded because the system only
checks things when a human opens a document.

## Proposed Solution

A server-side job scheduler running on a configured cadence:

**Compliance scan (daily or weekly):**
- Scan all active documents against their profile schema
- Flag frontmatter violations, missing required fields, broken wikilinks
- Produce a compliance report committed to `docs/compliance/[date].md`
- Surface violations on the status page

**Gate reminder (configurable threshold, e.g. 3 days):**
- Find all gates with `gate_status: pending` older than the threshold
- Generate an AI summary: what is pending, why it matters, what action is needed
- Send notification to the `gate_reviewer` (email, or a committed reminder
  document in `inbox/`)

**Stale plan detection:**
- Plans with `status: in-progress` and no commits touching them for N days
- Reminder sent to `assigned_to`

**Delivery channels (configurable):**
- Email (SMTP) — notification to the responsible person
- Committed document — adds to `inbox/` for visibility in the vault
- Status page — a "Pending Attention" section for overdue items

Connects to [[proposals/gates-time-based-triggers.md]] for the scheduling
mechanism.

## Deferred Because

Requires server-side AI, the gate mechanism, and a job scheduler. Phase 3+.
See [[proposals/enterprise-server-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — enterprise deployment scenario | NetYeti |
