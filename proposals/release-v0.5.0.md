---
title: "Release v0.5.0 — governance integrity, hook unification, collaboration model"
author: NetYeti
created: 2026-07-08
tags:
  - release
  - governance
  - infrastructure
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
---

## Problem

49 commits have landed since v0.4.9 (tagged Mar 2026) across Wave B hooks, collaboration model, WebUI write integrity, session auto-landing, and a dozen+ bug fixes. The codebase has drifted past 0.4.9 but no tagged release captures this state. Several open v0.5.0-milestone items remain unpinned, and one dogfood instance reports 0.5.0 while VERSION still says 0.4.9.

## Proposed Solution

Cut v0.5.0 with a release plan:

1. **Resolve remaining v0.5.0-milestone items** — sweep the 4 open items (3 proposals, 1 draft plan, 1 issue) and decide ship/hold/cut
2. **Bump VERSION + package.json** to 0.5.0
3. **Tag v0.5.0** on main
4. **Generate release notes** from commit log since v0.4.9
5. **Verify dogfood deployment** pulls the tagged build and reports correct version
6. **CI gate against drift** — fail if VERSION and package.json mismatch or if UI reports a different version than VERSION

### Scope

Already shipped since v0.4.9 (49 commits):
- Collaboration issue model (7-step workflow, phase tracking)
- Hook unification — single source, per-repo identity cache, approve-by-move seal
- WebUI write integrity — WYSIWYG round-trip, safe body-only saves
- Session auto-landing — protected-main commits auto-branch+PR
- Plan test/certify state machine, phase-complete gating, version-based milestones
- 15+ bug fixes across approve, hook resolution, round-trip, drift detection

### UI/UX bug gate — all must be resolved before v0.5.0 ships

| Item | Status | Type |
|------|--------|------|
| `issues/ui-roadplan-pending-work-visibility.md` | triaged | ux |
| `issues/UX-release-criteria-visibility.md` | triaged | ux |
| `issues/design-consumed-issues-should-not-show-as-awaiting-processing.md` | proposal-linked | ux |
| `issues/bug-report-bug-button-should-pop-up-a-form.md` | proposal-linked | bug |
| `issues/bug-report-button-should-offer-feature-as-well.md` | proposal-linked | bug |
| `issues/governance-panel-pending-approval-stat-is-mislabel.md` | scope-checked | bug |
| `issues/governance-panel-status-stat-tiles-aren-t-clickabl.md` | scope-checked | feature |

All 7 must be resolved (done, superseded, or explicitly cut from scope) before the release can proceed. Any UI/UX bugs filed between now and release must also be resolved or explicitly deferred — optional additions land under this same gate.

### Milestone items to resolve (5 open)
| Item | Type | Decision |
|------|------|----------|
| `proposals/improve-bug-feature-reporting-tool.md` | Proposal | Evaluate ship readiness |
| `proposals/three-docwright-instance-deployment.md` | Proposal | Evaluate ship readiness |
| `proposals/git-panel-branch-switcher.md` | Proposal | Evaluate ship readiness |
| `plans/lifecycle-gates.md` | Draft plan | Needs approval or defer |
| `issues/bug-session-start-blind-to-unmerged-work.md` | Bug | Fix or defer |

## Alternatives Considered

- **Ship immediately without sweeping milestones** — risks shipping with unresolved issues tagged v0.5.0. Rejected: milestone accuracy matters.
- **Skip tagged release entirely** — dogfood instances already running post-0.4.9 code, version is cosmetic. Rejected: version drift is already causing confusion per #258.

## Future

v0.5.1+ will pick up the remaining 49+ approved proposals and deferred milestones.
