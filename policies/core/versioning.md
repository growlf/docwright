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
| `PATCH` | Release within a phase | A release ships within the current phase — bumped per release, in the release commit (it is **not** derived from a completed-plan count) |

## Examples

| Event | Version |
|-------|---------|
| Phase 1 begins | `0.1.0` |
| First Phase 1 release ships | `0.1.1` |
| Next Phase 1 release ships | `0.1.2` |
| … and so on, per release | `0.1.N` |
| Phase 1 gate signs off → Phase 2 begins (`phase:close -- 1`) | `0.2.0` |
| First Phase 2 release ships | `0.2.1` |
| Significant milestone (alpha launch) | `1.0.0` |

> **Patch is per-release, not per-completed-plan.** Earlier drafts defined patch as
> a "completed plan count within the phase"; that count was never actually derived
> (e.g. `0.4.12` shipped with zero `plans/completed/phase-4-*.md`). Patch simply
> increments each time a release ships within the current phase.

## Tracking

The current version is stored in:
- `VERSION` — single line, e.g. `0.1.1`
- `package.json` → `"version"` field (kept in sync)
- `src/webui/package.json` → `"version"` field (kept in sync by `phase-close.ts`)

These MUST agree. The CI **"Version consistency gate"** (`.github/workflows/ci.yml`)
fails the build if `VERSION` and `package.json` disagree — drift is caught by code,
not memory ([[policies/core/code-over-memory]]).

## Automation

Version is bumped at **phase close**, not per commit. The single source of
truth is `scripts/phase-close.ts`, invoked as:

```
npm run phase:close -- <N>
```

It performs the following:
1. Validate that at least one `plans/completed/phase-N-*.md` file exists containing
   `status: completed` (a presence + status check — it does **not** verify each
   plan's individual steps)
2. Calculate the next version: `0.<N+1>.0`
3. Refuse to regress — idempotent if `VERSION` is already at or beyond the target
4. Update `VERSION`, `package.json`, and `src/webui/package.json`
5. Commit, then run `npm run release:tag` to tag and push

`phase-close.ts` only handles the **minor** bump at a phase boundary
(`0.<N+1>.0`). **PATCH** increments *within* a phase (e.g. `0.4.1 → 0.4.2`) are
per-release and applied **manually** in the release commit that ships them, keeping
all three version files in sync.

> There is **no** per-commit pre-commit hook that auto-bumps the version, and
> there is no longer a `scripts/version.js` (retired — it miscomputed the
> version and could regress; see `proposals/fix-or-retire-version-js.md`).
> The minor bump happens explicitly at phase close; the patch bump happens
> explicitly per release. The version is **not** derived from `plans/completed/`
> state — it is set deliberately and guarded by the CI consistency gate.

## Release branches

DocWright is trunk-based (the `develop` branch was retired 2026-06-30). `main` is
the trunk. When a milestone is ready (phase completion, major feature set), a
release branch is cut from `main`:

```
git fetch origin && git checkout -b release/v0.<phase>.<patch> origin/main
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
| 2026-07-11 | Reconciled with practice: PATCH is per-release (not a completed-plan count); documented the CI version-consistency gate + `src/webui/package.json`; corrected the `phase-close.ts` validation description; scrubbed retired-`develop` references (trunk-based). | NetYeti |
