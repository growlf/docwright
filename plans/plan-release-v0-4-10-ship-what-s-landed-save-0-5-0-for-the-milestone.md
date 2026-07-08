---
title: "Plan: Release v0.4.10 — ship what's landed, save 0.5.0 for the milestone"
status: in-progress
author: "NetYeti"
created: "2026-07-08"
created_by: "NetYeti@phoenix"
tags: [release, infrastructure]
proposal_source: "proposals/release-v0.4.10"
priority: medium
phase:
automated: full
waiting_reason:
assigned_to: ["NetYeti"]
related_to: []
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:
cancellation_reason:
template_version: "1.0"
tests_defined: true
tests_human_reviewed: false
gate_reviewer:
gate_status:
gate_date:
gate_note:
gate_reviews: []
gate_quorum: 1
total_steps: 5
completed_steps: 0
---

# Plan: Release v0.4.10

## Mode

**GUIDED MODE — Agent drafts/stages, human approves**

- Agent handles mechanical steps (bump, tag, release notes generation)
- Human reviews, merges the release PR, and validates the dogfood deployment
- Agent provides SOP compliance checks

## Problem

49 commits have landed since v0.4.9 (tagged Mar 2026) across Wave B hooks, collaboration model, WebUI write integrity, session auto-landing, and a dozen+ bug fixes. No tagged release captures this state. Dogfood instance shows 0.5.0 but code is still 0.4.9 — version drift.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Bump VERSION and package.json to 0.4.10 | Update `VERSION` file and `version` field in `package.json`; commit as `chore: bump version to 0.4.10` | ⏳ Pending |
| 2 | Generate release notes | Run `git log v0.4.9..HEAD --oneline --no-decorate`, categorize into Features / Fixes / Docs / Chores, write to `docs/release-notes-v0.4.10.md` | ⏳ Pending |
| 3 | Tag and push v0.4.10 | `git tag -a v0.4.10 -m "v0.4.10"` and `git push origin v0.4.10` | ⏳ Pending |
| 4 | Add CI version-drift gate | Add step to CI workflow that fails if `VERSION` and `package.json` version mismatch, and if UI-reported version differs from `VERSION` | ⏳ Pending |
| 5 | Verify dogfood deployment | Confirm dogfood instance pulls v0.4.10 tag, health check passes, status page shows v0.4.10 | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: `VERSION` file reads `0.4.10`, `package.json` version is `0.4.10`
- [ ] Step 2: Release notes exist at `docs/release-notes-v0.4.10.md`, all 49 commits accounted for
- [ ] Step 3: `git tag -l 'v0.4.10'` returns the tag, `git ls-remote origin refs/tags/v0.4.10` confirms pushed
- [ ] Step 4: CI pipeline has a step that catches version mismatch — test by deliberately desyncing VERSION and package.json in a draft PR

### Integration & Regression

- [ ] `npm run test:dispatch` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` reports 0 errors

### Gate Criteria

- [ ] All implementation steps complete and verified
- [ ] Dogfood instance reports v0.4.10 on status page
- [ ] No regressions introduced

## Rollback Procedures

- **Version bump reversal:** `git revert <commit-hash>` and force-push; re-tag `v0.4.10` to the revert
- **Release notes revert:** Same revert covers the notes file
- **Tag deletion:** `git push --delete origin v0.4.10 && git tag -d v0.4.10`
- **CI gate revert:** Revert the workflow change

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Version mismatch after bump | Low | Low | CI drift gate catches it |
| Release notes miss commits | Medium | Low | Review step; human validates before tagging |
| Dogfood deployment broken by tag | Low | Medium | Verify health check in staging-like env first |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-08 | Created | NetYeti |
