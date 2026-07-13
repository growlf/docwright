---
title: Approve pipeline not idempotent across surfaces — parallel UI + MCP processing double-nests proposal and generates duplicate draft plan
status: proposal-linked
created: 2026-07-09
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-09]
channel: dev
tags:
  - reported-bug
github_issue: 353
---

# Approve pipeline not idempotent across surfaces — parallel UI + MCP processing double-nests proposal and generates duplicate draft plan

> **Proposal-linked 2026-07-11** (backlog cleanup) → captured by `proposals/harden-plan-proposal-lifecycle-tooling.md`. Not lost; will be delivered as part of that proposal/plan.


## Description

**Observed 2026-07-09** during live-ai-visibility-event-relay approval (dogfood):

1. Human clicked Approve in Web UI → set `approved: true` on `proposals/live-ai-visibility-event-relay.md` (flag only).
2. Agent ran MCP `transition_to_approved` → moved proposal to `proposals/approved/`, created `plans/live-ai-visibility-event-relay.md`. Agent then rewrote the plan via `write_plan` (critique pass).
3. At 09:44, the container web-UI pipeline (running as root) processed the SAME approval again: re-moved the proposal to `proposals/approved/approved/` (double-nest), generated its OWN stale draft plan at `plans/approved/live-ai-visibility-event-relay.md` (wrong directory — plans live flat in `plans/`), and stamped the proposal `consumed_by: plans/approved/...` pointing at the duplicate.

**Impact:** duplicate/conflicting plans, broken consumed_by backlink, root-owned files in the repo (later EACCES failures for the host user), and a governance audit trail that shows two different actors "approving" once-approved content. Hand-repaired in commit 4dfed35.

**Root-cause candidates (unconfirmed):** the UI approve endpoint (or a watcher/sweeper such as gate-audit --fix / stale-approvals batch) does not check whether a proposal is already in `proposals/approved/` or whether a plan already exists before acting; no idempotency key or path-based guard. Trigger for the 09:44 re-run unknown — possibly a second Approve click on the already-approved doc (UI should disable the button) or an automated sweep.

**Fix directions:** (a) make every transition idempotent — no-op with a clear message if the proposal is already under `proposals/approved/` or a plan with the same slug exists in `plans/` or `plans/completed/`; (b) UI hides/disables Approve on already-approved docs; (c) sweepers must never re-nest `approved/approved/`; (d) all governance writers should run as the acting user, not root (related: hook-identity-cache and webui-write-integrity work).

Related: [[issues/hook-identity-cache-is-global-tmp-opencode-identit.md]] (identity banner also misread during the repair commit; git author was correct).

## System Info

dogfood container (root) + host MCP dw-upstream; DocWright v0.4.9; observed during live-ai-visibility approval flow
