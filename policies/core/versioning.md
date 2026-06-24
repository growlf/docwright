---
title: "Versioning Policy"
status: active
author: NetYeti
created: 2026-06-04
tags:
  - core
  - governance
  - versioning
  - releases
gate_reviewer: NetYeti
gate_status: approved
gate_date: 2026-06-04
---

# Versioning Policy

## Format

`MAJOR.MINOR.PATCH`

| Segment | Maps to | Increments when |
|---------|---------|-----------------|
| `MAJOR` | Milestone release | Defined separately — represents a significant public milestone (alpha, beta, 1.0) |
| `MINOR` | Phase number | A new phase begins (Phase 1 = 1, Phase 2 = 2, etc.) |
| `PATCH` | Completed plan count | A plan is marked `status: completed` within the current phase |

## Examples

| Event | Version |
|-------|---------|
| Phase 1 begins | `0.1.0` |
| `phase-1-ui-polish` completes | `0.1.1` |
| `phase-1-critique-skill` completes | `0.1.2` |
| `phase-1-containerization` completes | `0.1.3` |
| `phase-1-plan-step-enforcement` completes | `0.1.4` |
| Phase 1 gate signs off → Phase 2 begins | `0.2.0` |
| First Phase 2 plan completes | `0.2.1` |
| Significant milestone (alpha launch) | `1.0.0` |

## Tracking

The current version is stored in:
- `VERSION` — single line, e.g. `0.1.1`
- `package.json` → `"version"` field (kept in sync)

## Automation

When a plan file transitions to `status: completed` in a commit, the
pre-commit hook calls `scripts/version.js` to:
1. Count completed plans in the current phase
2. Calculate the new version: `0.<phase>.<completed-count>`
3. Update `VERSION` and `package.json`
4. Stage both files as part of the commit

This is automatic — no human needs to remember to bump the version.
The version is always derivable from the plan state.

## Release branches

When a milestone is ready (phase completion, major feature set), a release
branch is created from `develop`:

```
git checkout -b release/v0.<phase>.<patch> develop
```

The release branch is where:
- The version is finalized (auto-bumped or manually reviewed)
- `CHANGELOG.md` release notes are written
- Final validation CI runs
- The PR to `main` is created and reviewed

Once merged to `main`, the release branch is deleted and the tag is applied.
This keeps `main` as a clean release record.

## Major version milestones

Major versions are not automatic. They are proposed, approved, and tagged
explicitly as releases. Examples of milestone candidates:
- `1.0.0` — First organization using DocWright in production
- `2.0.0` — VSCodium extension ships
- `3.0.0` — Enterprise deployment with ACL

Major version proposals will be captured in `proposals/` when relevant.

When a major version milestone is approved, the release plan **must** include:
- Updating the CI trigger pattern in `.github/workflows/ci.yml` (currently `v0.*.*`)
- Updating the tag-detection pattern in `scripts/claude-tag-push-watch.sh`

These are policy-gated changes — do not update them outside of an approved release plan.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created | NetYeti |
