---
title: "Release v0.4.10 — ship what's landed, save 0.5.0 for the milestone"
author: NetYeti
created: 2026-07-08
tags:
  - release
  - infrastructure
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
consumed_by: plans/plan-release-v0-4-10-ship-what-s-landed-save-0-5-0-for-the-milestone.md
---

## Problem

49 commits have landed since v0.4.9 (tagged Mar 2026) across Wave B hooks, collaboration model, WebUI write integrity, session auto-landing, and a dozen+ bug fixes. No tagged release captures this state. The dogfood instance already shows 0.5.0 but the code is still 0.4.9 — version drift bug #258.

## Proposed Solution

Cut v0.4.10 with what's actually on main. Keep the 5 v0.5.0-milestone items unpinned for the real 0.5.0.

1. **Bump VERSION + package.json** to 0.4.10
2. **Tag v0.4.10** on main
3. **Generate release notes** from commit log since v0.4.9
4. **Fix the dogfood 0.5.0 display** — the instance shows the wrong version because it's running ahead of any tag; bumping to 0.4.10 resolves this
5. **CI gate against drift** — fail if VERSION and package.json mismatch

### Scope

49 commits since v0.4.9:
- Collaboration issue model (7-step workflow, phase tracking)
- Hook unification — single source, per-repo identity cache, approve-by-move seal
- WebUI write integrity — WYSIWYG round-trip, safe body-only saves
- Session auto-landing — protected-main commits auto-branch+PR
- Plan test/certify state machine, phase-complete gating, version-based milestones
- 15+ bug fixes across approve, hook resolution, round-trip, drift detection

### Deferred to v0.5.0 (5 items)
| Item | Type |
|------|------|
| `proposals/improve-bug-feature-reporting-tool.md` | Proposal |
| `proposals/three-docwright-instance-deployment.md` | Proposal |
| `proposals/git-panel-branch-switcher.md` | Proposal |
| `plans/lifecycle-gates.md` | Draft plan |
| `issues/bug-session-start-blind-to-unmerged-work.md` | Bug |

## Alternatives Considered

- **Call it 0.5.0** — rejected per BDFL direction: save the number for when the milestone items actually ship.

## Future

The deferred items plus the remaining 40+ approved proposals become the v0.5.0 release scope.
