---
title: Release v0.5.0 — governance integrity, hook unification, collaboration model
status: draft
author: NetYeti
created: 2026-07-08
tags:
  - release
  - governance
  - infrastructure
proposal_source: proposals/approved/approved/release-v0.5.0.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/approved/release-v0.5.0.md
---

# Release v0.5.0 — governance integrity, hook unification, collaboration model

## Overview

Delivers the approved proposal [[proposals/approved/approved/release-v0.5.0.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Resolve milestone items | Sweep 4 open v0.5.0-milestone items and decide ship/hold/cut for each | ⏳ Pending |
| 2 | Bump version to 0.5.0 | Update both VERSION file and version field in package.json to 0.5.0 | ⏳ Pending |
| 3 | Tag v0.5.0 on main | Create and push an annotated git tag `v0.5.0` targeting the main branch HEAD | ⏳ Pending |
| 4 | Generate release notes | Produce release notes from the commit log between v0.4.9 and v0.5.0 | ⏳ Pending |
| 5 | Verify dogfood build | Confirm the dogfood deployment pulls the tagged build and reports version 0.5.0 | ⏳ Pending |
| 6 | Gate CI against drift | Fail CI if VERSION and package.json mismatch or if UI reports a different version | ⏳ Pending |

## Testing Plan

### Step Verification
- [ ] **Step 1** — All 4 milestone items resolved: each shows `status: ship|hold|cut` with rationale; no item left un-triaged
- [ ] **Step 2** — `VERSION` file and `package.json` both read `0.5.0`; diff confirms no other incidental changes
- [ ] **Step 3** — `git tag -l v0.5.0` returns the tag; `git describe` on `main` matches the tag
- [ ] **Step 4** — Release notes exist at target path and reference commits between `v0.4.9..v0.5.0` (not a truncated or placeholder file)
- [ ] **Step 5** — Dogfood deployment's `/version` endpoint or equivalent returns `0.5.0`; build ID matches the tagged commit SHA
- [ ] **Step 6** — CI job fails on `VERSION`/`package.json` mismatch and fails when UI-reported version differs from `VERSION`

### Integration & Regression
- [ ] `npm test` (or equivalent suite) passes on the release branch with no regressions
- [ ] `npm run typecheck` passes with zero errors
- [ ] Existing UI tests pass — version-dependent assertions updated to `0.5.0` as needed
- [ ] Dogfood staging environment deploys cleanly from the `v0.5.0` tag without manual intervention
- [ ] Release notes CI step does not break the normal build pipeline (non-blocking if notes generation fails)

### Gate Criteria
- [ ] All 7 UI/UX bugs resolved or explicitly deferred with a tracking issue
- [ ] All 5 milestone items resolved (ship, hold, or cut) and documented in the plan
- [ ] `npm test` and `npm run typecheck` both passing on `main` at the tagged commit
- [ ] `VERSION`, `package.json`, and `git tag` all report `0.5.0` and are internally consistent
- [ ] CI drift gate deployed and enforcing on the release branch before merge

## Rollback Procedures

| Scenario | Rollback |
|---|---|---|
| Ship/hold/cut decision breaks downstream expectations | `git revert <commit>` on the decision, re-triage the item in the next patch |
| VERSION or package.json bump is wrong | `git revert <bump-commit>`, re-bump with correct value |
| Tag v0.5.0 points at wrong commit | `git tag -d v0.5.0 && git push --delete origin v0.5.0`, re-tag at the correct commit |
| Release notes contain errors or miss commits | `git tag -d v0.5.0 && git push --delete origin v0.5.0`, regenerate notes from corrected log, re-tag |
| Dogfood deployment reports wrong version | Pin the deployment back to the last known-good tag (`v0.4.9`), investigate the build pipeline |
| CI gate fails on version drift | Revert the commit that introduced the mismatch; re-align VERSION, package.json, and UI version before re-merging |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| VERSION and package.json diverge after merge | Medium | High | Pre-commit hook checks consistency; CI gate blocks PRs with mismatch |
| 7 UI/UX bugs not fully resolved by release date | Medium | Medium | Bugs are gating — any unresolved blocks the tag; cut scope rather than ship with known regressions |
| Milestone item marked "done" isn't actually done | Low | High | Each item verified against acceptance criteria during sweep; a second reviewer signs off |
| Generated release notes omit breaking changes or manual steps | Medium | Low | Release notes reviewed by human before publishing; template includes sections for migration notes and breaking changes |
| `git tag v0.5.0` applied to wrong commit (e.g. before final fix lands) | Low | Medium | Tag created via script that pins to `main` HEAD after all gates pass; annotated tag with `git tag -a` for provenance |
| Dogfood deployment pulls stale build from cache | Medium | Medium | Deployment uses `:latest` tag pinned to release commit; smoke test asserts version string from live UI matches `v0.5.0` |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-08 | Created from approved proposal | NetYeti |
