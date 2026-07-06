---
title: "Issue-cluster remediation waves B–D — hooks/identity, report-intake UX, workflow tooling QoL"
author: NetYeti
author-role: contributor
created: 2026-07-05
tags:
  - governance
  - hooks
  - ux
  - tooling
  - backlog
approved: false
deferred: true
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: medium
milestone: backlog
---

## Problem

The 2026-07-05 backlog grouping found four coherent clusters among the open code-issues.
Cluster A (Web UI write integrity) became [[plans/webui-write-integrity]] immediately.
The remaining three are captured here so they aren't lost (per
[[policies/core/capture-deferred-ideas]]), each a natural single plan when picked up:

## Wave B — Hook & identity integrity (`.githooks`/`scripts` enforcement plumbing)

- #140 — approving by moving a proposal to `proposals/approved/` bypasses the HUMAN-APPROVED gate
- #143 — governance hooks silently disabled when `DOCWRIGHT_PATH` is unset
- #144 — hook source drift (.githooks vs scripts/pre-commit.sh); commit-msg never installed for vaults
- #160 — hook identity cache is a global `/tmp` file; test runs poison real commit banners

Shared shape: the enforcement layer itself has integrity gaps. Fixing #144 first
(single hook source + install both hooks) makes the others one-place fixes.

## Wave C — Report/intake UX (the bug-report bridge and governance panel)

**PROMOTED TO v0.5.0:** [[proposals/improve-bug-feature-reporting-tool.md|Wave C proposal]]

- #175 — Report Bug doesn't create the linked GH issue
- #176 — issues have no forward path in the UI (issue → plan promotion)
- #177 — report form should be a styled modal, not bottom-of-page
- #178 — report button should capture feature requests (feature demand heatmap)
- #112 — governance panel "Pending Approval" stat mislabeled
- #113 — governance panel stat tiles not clickable (no drill-in)

Shared shape: the intake loop works but is unlovable; one UI-focused plan covers all six.

## Wave D — Workflow tooling QoL

- #93 — release dogfood-window uses a fixed 7-day clock (needs a real dogfood signal)
- #97 — roadplan CLI `--check` drift guard for CI
- #136 — plan doc generator: raw JS date + unquoted colon titles
- #146 — end-session should auto-branch+PR on protected-main rejection
- #166 — complete_issue_branch merge=true must wait for required checks

Shared shape: sharp edges in the automation that force manual dances.

## Proposed Solution

When cluster A completes, promote one wave at a time (suggested order: B for
governance integrity, then C for contributor experience, then D). Each wave
becomes one plan consuming its issues, following the webui-write-integrity
pattern: issue-per-step, shared-root-cause step ordering, per-step PR.

## Security / Policy / Verification

- **Security:** Wave B is itself the security work — the enforcement layer's own gaps.
- **Policy:** [[policies/core/capture-deferred-ideas]], [[policies/core/bugs-before-features]].
- **Verification:** each wave's plan defines per-step tests; the standing pattern is the
  contribution-pipeline/webui-write-integrity testing discipline (evidence-cited boxes,
  verify_plan_tests recorded runs).
