---
title: Release v0.5.0 — governance integrity, hook unification, collaboration model
status: in-progress
author: NetYeti
created: 2026-07-08
tags:
  - release
  - governance
  - infrastructure
proposal_source: proposals/approved/release-v0.5.0.md
priority: medium
automated: guided
scenario_synthesis: false
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
related_to:
  - proposals/git-panel-branch-switcher.md
  - plans/hide-consumed-issues-from-backlog.md
  - plans/completed/reconcile-versioning-policy-and-practice.md
  - plans/completed/enhance-roadplan-pending-work-visibility.md
  - plans/completed/image-based-deployment-any-directory.md
_path: plans/release-v0.5.0.md
total_steps: 6
completed_steps: 6
tests_last_run: "2026-07-11T16:51:29.917Z"
tests_last_result: pass
tests_last_commit: b8fba1e
---

# Release v0.5.0 — governance integrity, hook unification, collaboration model

## Overview

_Plan generated from approved proposal: Release v0.5.0 — governance integrity, hook unification, collaboration model_

> **RELEASED 2026-07-11.** `v0.5.0` shipped via release-branch PR #330 (squash → `main`
> `ab16b0c`), tagged `v0.5.0`, and the ghcr image published (`ghcr.io/growlf/docwright:v0.5.0`
> + `:latest`). This closes **Phase 4** (deliverables 1–11 deferred to Phase 5 — see
> [[proposals/deferred-phase-4-carryover-profile-engine-acl-ai]]).

### Problem

Many commits landed since v0.4.9 across Wave B hooks, collaboration model, WebUI write
integrity, session auto-landing, image-based deployment, a critical path-traversal fix
(#322), and a dozen+ bug fixes. `0.5.0` is the **Phase 4 close** version (minor = phase);
this release pinned that state.

### Versioning reconciliation

`0.5.0` is policy-correct (minor = phase; Phase 4 close). Patch semantics were reconciled
separately in [[plans/completed/reconcile-versioning-policy-and-practice]] (patch =
per-release; CI version-consistency gate covers all three version files). That landed
(#327) before the cut, satisfying the precondition below.

### Why a release-branch PR, not `phase:close`

`npm run phase:close -- 4` direct-pushes to `main`, which is PR-protected
(`enforce_admins: true`) — so it fails at the push step (GH #329). The cut went through
release branch `release/v0.5.0` → PR #330 → squash-merge → tag on the merged commit.

## Implementation Steps

| # | Action | Details | Status |
|---|--------|---------|--------|
| 0 | **UI/UX bug gate** — resolve all before release | 7/8 resolved; 0c cut from the gate (below). | ✅ Met |
| 0a | roadplan pending-approval/PR section | Delivered via `plans/completed/enhance-roadplan-pending-work-visibility.md` | ✅ Resolved |
| 0b | release criteria block details | Delivered via `enhance-roadplan-pending-work-visibility` | ✅ Resolved |
| 0c | consumed issues clutter backlog | ✅ **Cut from release gate** — low-priority UI polish, tracked separately in `plans/hide-consumed-issues-from-backlog.md` + `plans/implement-consumed-issues-visibility.md`. Not lost. | ✅ Cut (tracked) |
| 0d | report-bug modal form | Issue resolved | ✅ Resolved |
| 0e | report button offers feature too | Issue resolved | ✅ Resolved |
| 0f | "Pending Approval" stat relabeled | Fixed | ✅ Resolved |
| 0g | governance stat tiles clickable | Issue resolved | ✅ Resolved |
| 0h | roadplan release-target box | Delivered via `enhance-roadplan-pending-work-visibility` | ✅ Resolved |
| 1 | **Resolve v0.5.0-milestone items** | `improve-bug-feature-reporting-tool` delivered; `bug-session-start-blind-to-unmerged-work` resolved; `lifecycle-gates` carried (in Phase 5 track); `three-docwright-instance-deployment` delivered by image-based cutover; `git-panel-branch-switcher` ✅ **HELD → v0.5.1** (milestone updated on the proposal). | ✅ Done |
| 2 | **Bump VERSION + package.json to 0.5.0** | Bumped `VERSION`, `package.json`, `src/webui/package.json` → `0.5.0` on `release/v0.5.0` (PR #330); version-consistency gate green. | ✅ Done |
| 3 | **Generate release notes** | `docs/release-notes-v0.5.0.md` written from `v0.4.12..HEAD` (15 commits), grouped Security / Governance / Reliability. | ✅ Done |
| 4 | **Tag v0.5.0 on main** | `v0.5.0` tagged on merged `main` (`ab16b0c`) + pushed; tag CI green; ghcr image published (`:v0.5.0` + `:latest`). | ✅ Done |
| 5 | **CI gate against drift** | Owned by [[plans/completed/reconcile-versioning-policy-and-practice]] (extended to `src/webui/package.json`). Verified green before tagging. | ✅ Done |
| 6 | **Verify dogfood deployment** | Image-based deployment (4 instances) health-checks pass; `0.5.0` image published for pull. | ✅ Done |

## Testing Plan

- Version-consistency gate green at `0.5.0` (all three files agree) — verified on PR #330 CI.
- Tag CI (`v0.5.0`): Lint/Typecheck/Test + Docker build/health passed; ghcr push steps succeeded.
- Release notes cover the `v0.4.12..HEAD` range.

## Phase Gate

### Gate Criteria

- `v0.5.0` merged to `main` and tagged; ghcr image published.
- All three version files agree at `0.5.0` (CI gate green).
- Phase 4 closed; undelivered deliverables captured as a deferred carryover (nothing lost).
- Cut/held items recorded: `0c` cut from gate (tracked separately); `git-panel` held → v0.5.1.
- `tests_defined` + human review confirmed.

## Rollback Procedures

- **Tag deletion:** `git push --delete origin v0.5.0 && git tag -d v0.5.0`
- **Version reversal:** revert the bump commit via PR; re-tag.
- **Image:** re-publish from a prior tag if needed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Instances pull a bad `:latest` | Low | Medium | Image health-checked in CI before publish; digest-pin option available |
| `phase:close` reused and fails on main | Medium | Low | GH #329 tracks the fix; release-branch PR path documented here |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-08 | Created from approved proposal | NetYeti |
| 2026-07-08 | Added UI/UX bug gate + expanded steps + linked sub-components | NetYeti |
| 2026-07-11 | Reconciled with landed work (Step 5 de-duped, Step 6 superseded) | NetYeti |
| 2026-07-11 | RELEASED: v0.5.0 shipped (PR #330, tag v0.5.0, ghcr image). 0c cut from gate; git-panel held → v0.5.1. All steps done; added Phase Gate. Ready to complete. | NetYeti |
| 2026-07-11 | Test run recorded via verify_plan_tests: npm run test:dispatch → PASS @ b8fba1e | NetYeti |
