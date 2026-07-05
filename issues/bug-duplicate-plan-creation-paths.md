---
title: "Two plan-creation paths (approve-proposal vs create-plan) let a proposal get duplicate plans"
status: open
github_issue: 115
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
milestone: future
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
