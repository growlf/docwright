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
  - issues/ui-roadplan-pending-work-visibility.md
  - issues/UX-release-criteria-visibility.md
  - issues/design-consumed-issues-should-not-show-as-awaiting-processing.md
  - issues/bug-report-bug-button-should-pop-up-a-form.md
  - issues/bug-report-button-should-offer-feature-as-well.md
  - issues/governance-panel-pending-approval-stat-is-mislabel.md
  - issues/governance-panel-status-stat-tiles-aren-t-clickabl.md
  - issues/bug-roadplan-view-lacks-release-target-box-with-burn-d.md
  - proposals/improve-bug-feature-reporting-tool.md
  - proposals/three-docwright-instance-deployment.md
  - proposals/git-panel-branch-switcher.md
  - plans/lifecycle-gates.md
  - issues/bug-session-start-blind-to-unmerged-work.md
  - plans/enhance-roadplan-pending-work-visibility.md
_path: plans/release-v0.5.0.md
total_steps: 6
completed_steps: 0
---

# Release v0.5.0 — governance integrity, hook unification, collaboration model

## Overview

_Plan generated from approved proposal: Release v0.5.0 — governance integrity, hook unification, collaboration model_

### Problem

49 commits have landed since v0.4.9 (tagged Mar 2026) across Wave B hooks, collaboration model, WebUI write integrity, session auto-landing, and a dozen+ bug fixes. The codebase has drifted past 0.4.9 but no tagged release captures this state. Several open v0.5.0-milestone items remain unpinned, and one dogfood instance reports 0.5.0 while VERSION still says 0.4.9.

### Gate: UI/UX bugs must be resolved before release

All UI/UX bugs listed in Step 0 below must be resolved — or explicitly cut from scope — before the mechanical release steps begin. Any additional UI/UX bugs filed between now and release are OPTIONALLY added to this gate.

### Alternatives Considered

- **Ship immediately without sweeping milestones** — risks shipping with unresolved issues tagged v0.5.0. Rejected: milestone accuracy matters.
- **Skip tagged release entirely** — dogfood instances already running post-0.4.9 code, version is cosmetic. Rejected: version drift is already causing confusion per #258.

### Future

v0.5.1+ will pick up the remaining 49+ approved proposals and deferred milestones.

## Implementation Steps

| # | Action | Details | Status |
|---|--------|---------|--------|
| 0 | **UI/UX bug gate** — resolve all before release proceeds | See sub-steps below | ⏳ Pending |
| 0a | `issues/ui-roadplan-pending-work-visibility.md` — roadplan needs pending-approval/PR section | Plan: `plans/enhance-roadplan-pending-work-visibility.md` | ⏳ Pending |
| 0b | `issues/UX-release-criteria-visibility.md` — release criteria "1/2 done" lacks block details | Plan: `plans/enhance-roadplan-pending-work-visibility.md` | ⏳ Pending |
| 0c | `issues/design-consumed-issues-should-not-show-as-awaiting-processing.md` — consumed issues clutter backlog | proposal-linked, ux | ⏳ Pending |
| 0d | `issues/bug-report-bug-button-should-pop-up-a-form.md` — modal form instead of page-bottom form | proposal-linked, bug | ⏳ Pending |
| 0e | `issues/bug-report-button-should-offer-feature-as-well.md` — report button needs feature option | proposal-linked, bug | ⏳ Pending |
| 0f | `issues/governance-panel-pending-approval-stat-is-mislabel.md` — "Pending Approval" stat mislabeled | scope-checked, bug | ⏳ Pending |
| 0g | `issues/governance-panel-status-stat-tiles-aren-t-clickabl.md` — stat tiles not clickable | scope-checked, feature | ⏳ Pending |
| 0h | `issues/bug-roadplan-view-lacks-release-target-box-with-burn-d.md` — roadplan needs release-target box | Plan: `plans/enhance-roadplan-pending-work-visibility.md` | ⏳ Pending |
| 1 | **Resolve v0.5.0-milestone items** — sweep 5 open items, decide ship/hold/cut per proposal | `proposals/improve-bug-feature-reporting-tool.md`, `proposals/three-docwright-instance-deployment.md`, `proposals/git-panel-branch-switcher.md`, `plans/lifecycle-gates.md`, `issues/bug-session-start-blind-to-unmerged-work.md` | ⏳ Pending |
| 2 | **Bump VERSION + package.json** to 0.5.0 | Update VERSION file and version field in package.json; commit as `chore: bump version to 0.5.0` | ⏳ Pending |
| 3 | **Generate release notes** | Run `git log v0.4.10..HEAD --oneline --no-decorate`, categorize, write to `docs/release-notes-v0.5.0.md` | ⏳ Pending |
| 4 | **Tag v0.5.0** on main | `git tag -a v0.5.0 -m "v0.5.0"` and `git push origin v0.5.0` | ⏳ Pending |
| 5 | **CI gate against drift** | Add/verify CI step that fails if VERSION and package.json mismatch | ⏳ Pending |
| 6 | **Verify dogfood deployment** | Confirm dogfood instance pulls v0.5.0 tag, health check passes, status page shows v0.5.0 | ⏳ Pending |

## Testing Plan

_Testing plan TBD — will be filled before completion_

## Rollback Procedures

- **Version bump reversal:** `git revert <commit-hash>` and force-push; re-tag to the revert
- **Tag deletion:** `git push --delete origin v0.5.0 && git tag -d v0.5.0`
- **UI/UX bug fixes:** Individual reverts per bug fix PR
- **CI gate revert:** Revert the workflow change

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| UI/UX bugs take longer than expected | Medium | High | Gate blocks release, but can cut scope explicitly |
| Milestone items not shippable | Medium | Medium | Decide ship/hold/cut early in process |
| Version drift between PR merges and tag | Low | Low | CI drift gate catches mismatch |
| Dogfood deployment broken by tag | Low | Medium | Verify health check before announcing release |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-08 | Created from approved proposal | NetYeti |
| 2026-07-08 | Added UI/UX bug gate (7 items) + expanded steps | NetYeti |
| 2026-07-08 | Linked to all 14 sub-components via related_to | NetYeti |
| 2026-07-08 | Added step 0h: roadplan release-target UI feature | NetYeti |
| 2026-07-08 | 0a+0h linked to plans/enhance-roadplan-pending-work-visibility.md | NetYeti |
