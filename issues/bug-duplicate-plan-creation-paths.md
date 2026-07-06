---
title: "Two plan-creation paths (approve-proposal vs create-plan) let a proposal get duplicate plans"
status: resolved
github_issue: 115
closed_by_pr: "#127"
author: NetYeti
author-role: contributor
created: 2026-07-05
category: bug
priority: high
tags:
  - webui
  - lifecycle
  - plan-generation
  - data-integrity
  - governance
created_by: "NetYeti@phoenix"
assigned_to: ""
milestone: backlog
---

> Found dogfooding 2026-07-02 (recurring — also hit at session start).

## Problem

A proposal can end up with **two plans**:
- `/api/approve-proposal` → `plans/<proposal-slug>.md` (clean draft, committed) — the #108 path.
- `/api/create-plan` → `plans/plan-<title-derived-slug>.md` (a `"Plan:"`-prefixed, `tags: [planning]` skeleton).

If a user approves and then also clicks a "Create Plan" affordance (easy to do when the post-approve UI is confusing — see the sibling issue), they get a duplicate plan for one proposal. This is a data-integrity/governance hazard: which plan is real? `consumed_by` points at only one.

## Acceptance Criteria

- [ ] A proposal can have at most one plan; the second creation path detects an existing plan (via `consumed_by` / proposal_source) and refuses or routes to the existing one.
- [ ] Both paths converge on the same slug + generator (no `"Plan:"`-prefix skeleton divergence).
- [ ] Clear UI: once a proposal has a plan, "Create Plan" becomes "Open Plan".

## Resolution (2026-07-04)

Fixed by PR #127 (commit 3da29e6) — both creation paths now detect an existing plan and
refuse: create-plan sets `consumed_by` so approve-proposal short-circuits, and each path
cross-checks the other's slug. GH #115 closed. Residual polish NOT implemented: the two
paths still diverge on slug/generator (AC2) and the plan button is hidden rather than
relabeled "Open Plan" (AC3) — accepted as out of scope for the bug.
