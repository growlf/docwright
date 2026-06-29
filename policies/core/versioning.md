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
| `PATCH` | Completed plan count | A plan completes within the current phase (bumped manually in the release commit) |

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

Version is bumped at **phase close**, not per commit. The single source of
truth is `scripts/phase-close.ts`, invoked as:

```
npm run phase:close -- <N>
```

It performs the following:
1. Validate that `plans/completed/phase-N-*.md` plans exist and are `status: completed`
2. Calculate the next version: `0.<N+1>.0`
3. Refuse to regress — idempotent if `VERSION` is already at or beyond the target
4. Update `VERSION` and `package.json`
5. Commit, then run `npm run release:tag` to tag and push

`phase-close.ts` only handles the **minor** bump at a phase boundary
(`0.<N+1>.0`). **PATCH** increments *within* a phase (e.g. `0.4.1 → 0.4.2` as
individual plans complete) are applied **manually** in the release commit that
ships them, keeping `VERSION` and `package.json` in sync.

> There is **no** per-commit pre-commit hook that auto-bumps the version, and
> there is no longer a `scripts/version.js` (retired — it miscomputed the
> version and could regress; see `proposals/fix-or-retire-version-js.md`).
> The version is bumped explicitly at phase close and is always derivable from
> the `plans/completed/` state.

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
