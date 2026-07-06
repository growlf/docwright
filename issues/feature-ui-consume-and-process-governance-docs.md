---
title: Web UI cannot consume/supersede or process one proposal or plan into another
status: scope-checked
author: NetYeti
author-role: contributor
created: 2026-07-04
category: feature
priority: medium
complexity: medium
estimated_effort: M
tags: []
triage_date: 2026-07-04
triage_by: NetYeti
triage_notes: Triaged as feature / medium.
scope_check_date: 2026-07-04
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 150
milestone: v0.6.0
assigned_to: []
created_by: NetYeti@cluster-llm
---

> Found by dogfooding on 2026-07-04 while reconciling
> [[proposals/three-docwright-instance-deployment]] with two already-approved Phase-3
> sub-plans it now realizes ([[proposals/approved/sub-plan-cascade-steam-early-access]]
> and [[proposals/approved/sub-plan-msp-pilot-vault]]). There was no UI affordance to
> express "this proposal absorbs those," so the merge was done by hand in Markdown and
> the sub-plans' formal disposition was deferred.

## Problem

The Web UI has no way to relate or transform governance documents to each other:

1. **Consume / supersede.** Mark proposal/plan A as absorbed into B — recording the
   relationship on both docs and transitioning the consumed doc's status (e.g.
   `superseded`) — without hand-editing frontmatter. This must respect the
   AI-governance boundary (a human performs/authorises the status change) and work on
   `approved: true` documents.
2. **Process one into another.** Derive or fold one doc into another as a first-class
   operation — e.g. promote a proposal to a plan, or merge several proposals/sub-plans
   into a single target — instead of manually copying content between files.

Today both are manual Markdown edits. That is error-prone, invisible to the relationship
graph, and — for consuming an approved doc — risks an ad-hoc status change that bypasses
the governance path the UI is supposed to enforce.

## Impact

- Reconciliation of overlapping/duplicated work (a known multi-agent collaboration
  hazard) has no supported path, so it happens off-model in raw Markdown.
- Consumed docs linger in `proposals/approved/` with no machine-readable "superseded by"
  link, so the relationship graph and any collation view are wrong.
- Contradicts [[policies/core/code-over-memory]]: a lifecycle relationship that should be
  enforced/recorded by tooling relies on human discipline instead.

## Proposed capability

- A UI action on a proposal/plan to **link a relationship** to another doc
  (`supersedes` / `superseded_by`, `consumes` / `consumed_by`) that writes both sides.
- A **supersede/absorb** action that, on human authorisation, transitions the consumed
  doc's status and records the link — never setting `approved`/`completed` on the AI's
  behalf.
- A **promote/transform** action (proposal → plan; merge N → 1) that carries content and
  provenance forward rather than requiring copy-paste.

## Acceptance criteria

- From the UI, a user can mark one proposal/plan as consuming/superseding another; both
  docs gain the reciprocal relationship field and the consumed doc's status updates.
- The operation is blocked or requires explicit human approval when it would change an
  `approved`/`completed` field (AI-governance boundary preserved).
- The relationship is visible in the doc properties pane and in any relationship/collation
  view — no hand-edited frontmatter required.

## Related

- Blocks clean reconciliation for [[proposals/three-docwright-instance-deployment]].
- Consumed docs pending formal supersession once this ships:
  [[proposals/approved/sub-plan-cascade-steam-early-access]],
  [[proposals/approved/sub-plan-msp-pilot-vault]].
