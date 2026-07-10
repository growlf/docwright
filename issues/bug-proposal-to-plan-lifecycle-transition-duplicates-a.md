---
title: Proposal-to-plan lifecycle transition duplicates approved/ path segment
status: new
created: 2026-07-09
author: agent
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-09]
channel: dev
related:
  - plans/release-v0.5.0.md
  - plans/improve-bug-feature-reporting-tool.md
tags:
  - reported-bug
---

# Proposal-to-plan lifecycle transition duplicates approved/ path segment

## Description

The transition-to-approved / plan-generation flow (invoked via OpenCode/docwright-lifecycle) intermittently:
1. Moves an approved proposal to a doubly-nested path `proposals/approved/approved/<name>.md` instead of `proposals/approved/<name>.md`.
2. Simultaneously leaves behind an orphan skeleton plan at `plans/approved/<name>.md` (status: draft, empty steps) whose `proposal_source:` correctly points at the doubly-nested path, while a separate, fully-authored plan is generated at `plans/<name>.md` (status: in-progress) whose `proposal_source:` points at the (non-existent) singly-nested path.

Observed three times now: once for `release-v0.5.0` (already committed in f7b8e0f — `plans/approved/release-v0.5.0.md` and `proposals/approved/approved/release-v0.5.0.md` are stray artifacts still in the tree), again for `improve-bug-feature-reporting-tool` (caught before commit, mid-session when OpenCode ran out of tokens), and a third time for `executor-panel-live-feedback` (2026-07-10) — this time the orphan skeleton landed under a garbled title-derived filename (`plans/plan-bug-ux-plan-executor-panel-has-no-feedback-during-bigpickle-session-humans-panic-and-interrupt.md`) rather than `plans/approved/<name>.md`, with an entirely empty Implementation Steps row (`| 1 | | | ⏳ Pending |`) alongside the real, actually-used `plans/executor-panel-live-feedback.md`. Confirms the duplication isn't tied to one specific filename pattern -- it's the underlying double-generation, not just the path-nesting logic.

Net effect: two competing plan files for the same proposal, a doubly-nested proposal copy, and dangling `proposal_source`/`consumed_by` cross-references that point at paths that don't exist. Root cause is likely path concatenation logic in the transition tool appending `approved/` to a path that already contains it, combined with the plan-generation step running twice (once producing the thin skeleton, once producing the full plan).

## System Info

Caught 2026-07-09 resuming an OpenCode session in Claude Code, DocWright repo phoenix/feat/completed-roadplan-enhancement
