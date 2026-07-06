---
title: Approve button silently no-ops when a stale consumed_by points at a missing plan
status: scope-checked
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: medium
complexity: low
estimated_effort: S
tags: []
triage_date: 2026-07-01
triage_by: NetYeti
triage_notes: Triaged as bug / medium.
scope_check_date: 2026-07-01
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 141
milestone: backlog
assigned_to: []
created_by: NetYeti@cluster-llm
---

> Found by dogfooding on 2026-07-01 approving
> [[proposals/separate-dev-tracking-milestones-and-beta-channel]] (GitHub #68) via the Web
> UI. Related to [[proposals/bug-plan-generator-from-approved-proposal]] (same session,
> same approve flow).

## Problem

The proposal carried a `consumed_by:` field pointing at a plan file that had since been
deleted. Clicking **Approve** in this state **silently did nothing on disk** — the proposal
stayed `approved: false`, stayed in `proposals/`, and the UI simply left the user on a tab
(first the Related tab, then Properties) with no error, toast, or explanation. The user
reasonably believed they had approved when nothing had happened.

Only after the `consumed_by:` pointer was reset (and the stale/duplicate plan files removed)
did a fresh Approve click complete the full flow (set `approved: true`, move to
`proposals/approved/`, generate a plan).

## Impact

A silent no-op on a governance action is a trust hazard: the human believes an approval
happened when the frontmatter source-of-truth says otherwise. This is exactly the class of
divergence between "what the UI showed" and "what's on disk" that governance-by-frontmatter
is supposed to prevent.

## Proposed Fix

- Make the approve flow **idempotent and self-healing**: if `consumed_by:` points at a
  missing plan, either regenerate the plan or clear the stale pointer and proceed — do not
  abort.
- **Never fail silently.** Any approve that does not complete must surface a clear error
  toast stating what blocked it (e.g. "consumed_by references a plan that no longer exists").
- Consider validating `consumed_by:` targets at page load and flagging dangling pointers.

## Verification

- Approving a proposal whose `consumed_by:` points at a deleted plan either completes
  cleanly or shows an explicit error — never a silent no-op.
- After a successful approve, the proposal is `approved: true` and located in
  `proposals/approved/`, matching what the UI reports.
