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
tests_human_reviewed: false
related_to:
  - issues/design-consumed-issues-should-not-show-as-awaiting-processing.md
  - proposals/git-panel-branch-switcher.md
  - proposals/three-docwright-instance-deployment.md
  - plans/lifecycle-gates.md
  - plans/reconcile-versioning-policy-and-practice.md
  - plans/completed/enhance-roadplan-pending-work-visibility.md
  - plans/completed/image-based-deployment-any-directory.md
_path: plans/release-v0.5.0.md
total_steps: 6
completed_steps: 2
---

# Release v0.5.0 — governance integrity, hook unification, collaboration model

## Overview

_Plan generated from approved proposal: Release v0.5.0 — governance integrity, hook unification, collaboration model_

> **Reconciled 2026-07-11.** Much of this plan was overtaken by work landed after
> it was written (2026-07-08): the UI/UX bug gate is 7/8 resolved, deployment was
> re-architected image-based (Step 6 superseded), and the version-drift CI gate
> (Step 5) is now owned by [[plans/reconcile-versioning-policy-and-practice]] to
> avoid duplication. What genuinely remains is the mechanical cut (Steps 2–4),
> one open UI item, and a git-panel ship/hold call.

### Problem

Many commits have landed since v0.4.9 across Wave B hooks, collaboration model,
WebUI write integrity, session auto-landing, image-based deployment, a critical
path-traversal fix (#322), and a dozen+ bug fixes. `VERSION` is currently `0.4.12`
(patch-per-release), and `0.5.0` is the **Phase 4 close** version — `npm run
phase:close -- 4` writes `0.{N+1}.0 = 0.5.0`. This release pins that state.

### Versioning reconciliation (why this couples to another plan)

`0.5.0` is policy-correct on its own (minor = phase; Phase 4 close → `0.5.0`). What
is **not** yet settled is PATCH semantics: `policies/core/versioning.md` says
"patch = completed-plan count in the phase", but practice is patch-per-release
(0.4.10/.11/.12). [[plans/reconcile-versioning-policy-and-practice]] resolves that
and owns the VERSION↔package.json↔scheme drift CI check. **That plan should land
before the tag** so the scheme is coherent and Step 5's gate exists — but it does
not change the `0.5.0` number. Step 5 below is therefore de-duplicated (pointer,
not a second implementation).

### Gate: UI/UX bugs must be resolved before release

All Step 0 UI/UX items must be resolved — or explicitly cut — before the mechanical
release steps. As of 2026-07-11, 7 of 8 are resolved; the lone open item
(`design-consumed-issues…`) is low-priority and may be cut from the release gate.

### Alternatives Considered

- **Ship immediately without sweeping milestones** — risks shipping unresolved
  v0.5.0-tagged issues. Rejected: milestone accuracy matters.
- **Skip tagged release entirely** — Rejected: version drift already caused
  confusion (#258); the phase-close bump is the canonical mechanism.

### Future

v0.5.1+ picks up the remaining approved proposals and deferred milestones,
including the newly-prioritized feature backlog.

## Implementation Steps

| # | Action | Details | Status |
|---|--------|---------|--------|
| 0 | **UI/UX bug gate** — resolve all before release proceeds | 7/8 resolved (see 0a–0h). Only 0c remains. Gate substantially met. | ✅ Substantially met |
| 0a | roadplan pending-approval/PR section | Delivered via `plans/completed/enhance-roadplan-pending-work-visibility.md` | ✅ Resolved |
| 0b | release criteria block details | Delivered via `enhance-roadplan-pending-work-visibility` | ✅ Resolved |
| 0c | consumed issues clutter backlog | Still `proposal-linked`, low priority — CANDIDATE TO CUT from release gate | ⏳ Pending |
| 0d | report-bug modal form (not page-bottom) | Issue resolved | ✅ Resolved |
| 0e | report button offers feature too | Issue resolved | ✅ Resolved |
| 0f | "Pending Approval" stat relabeled | Fixed (relabeled "Awaiting Plan") | ✅ Resolved |
| 0g | governance stat tiles clickable | Issue resolved | ✅ Resolved |
| 0h | roadplan release-target box | Delivered via `enhance-roadplan-pending-work-visibility` | ✅ Resolved |
| 1 | **Resolve v0.5.0-milestone items** — ship/hold/cut each | `improve-bug-feature-reporting-tool` delivered (proposal gone); `bug-session-start-blind-to-unmerged-work` resolved; `plans/lifecycle-gates.md` at 4/5 — finish or cut; `three-docwright-instance-deployment` largely delivered by image-based cutover — mark delivered or cut; `git-panel-branch-switcher` (now `priority: medium`) — SHIP or HOLD to v0.5.1 (recommend HOLD). | 🔄 In progress |
| 2 | **Bump VERSION + package.json to 0.5.0 via phase close** | Use `npm run phase:close -- 4` (canonical Phase 4 close → writes `0.5.0`, commits, tags, pushes). GATED on [[plans/reconcile-versioning-policy-and-practice]] landing first. BDFL-run (release is the BDFL's call). | ⏳ Pending |
| 3 | **Generate release notes** | `git log v0.4.12..HEAD --oneline --no-decorate`, categorize, write `docs/release-notes-v0.5.0.md`. | ⏳ Pending |
| 4 | **Tag v0.5.0 on main** | Handled by `phase:close` in Step 2 (it tags + pushes). Verify the tag CI publishes the ghcr image. | ⏳ Pending |
| 5 | **CI gate against drift** | ~~Implement here~~ — DE-DUPLICATED. Owned by [[plans/reconcile-versioning-policy-and-practice]] Step 3 (VERSION↔package.json↔scheme drift check). This plan only verifies that gate is green before tagging. | ✅ Redirected |
| 6 | **Verify dogfood deployment** | SUPERSEDED by image-based deployment (`plans/completed/image-based-deployment-any-directory.md`): 4 instances cut over, health checks pass, status pages read the baked version. Re-confirm the dogfood instance pulls the `0.5.0` image post-tag. | ✅ Superseded (re-confirm post-tag) |

## Testing Plan

- Step 2: after `phase:close -- 4`, `VERSION` and `package.json` both read `0.5.0` and match (the reconcile-versioning drift gate passes).
- Step 3: release notes file exists and categorizes the `v0.4.12..HEAD` range.
- Step 4: `v0.5.0` tag present on `main`; tag CI publishes the ghcr image.
- Step 6: the dogfood instance pulls the `0.5.0` image; health check green; status page shows `0.5.0`.

## Rollback Procedures

- **Version bump reversal:** `git revert <commit>`; delete + re-tag if needed.
- **Tag deletion:** `git push --delete origin v0.5.0 && git tag -d v0.5.0`
- **UI/UX bug fixes:** individual reverts per PR.
- **CI gate:** owned by reconcile-versioning — revert there.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Versioning scheme not reconciled before tag | Medium | Medium | Land reconcile-versioning first; Step 2 gated on it |
| `git-panel-branch-switcher` scope creep | Low | Low | Recommend HOLD to v0.5.1 |
| Dogfood deployment broken by tag | Low | Medium | Image-based health check before announcing |
| 0c cut without note | Low | Low | Explicitly record cut in history if dropped |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-08 | Created from approved proposal | NetYeti |
| 2026-07-08 | Added UI/UX bug gate (7 items) + expanded steps | NetYeti |
| 2026-07-08 | Linked to all 14 sub-components via related_to | NetYeti |
| 2026-07-08 | Added step 0h: roadplan release-target UI feature | NetYeti |
| 2026-07-08 | 0a+0h linked to enhance-roadplan-pending-work-visibility | NetYeti |
| 2026-07-11 | Reconciled with landed work: 7/8 gate resolved; Step 5 de-duplicated to reconcile-versioning; Step 6 superseded by image-based deploy; Step 2 reframed to phase:close and gated on the versioning reconciliation. Remaining: cut (2–4), 0c cut/keep, git-panel ship/hold. | NetYeti |
