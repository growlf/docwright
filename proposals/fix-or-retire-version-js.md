---
title: "Fix or retire scripts/version.js — it miscomputes version below current"
author: NetYeti
created: 2026-06-29
tags:
  - tooling
  - versioning
  - dx
  - reliability
approved: true
created_by: "NetYeti@cluster-llm"
assigned_to: ""
---

## Problem

`scripts/version.js` computes a **wrong, regressive** version and will silently
roll the project backward if anyone runs `node scripts/version.js --update`.

On 2026-06-29, running it against the repo (at `VERSION=0.4.4`) produced `0.3.0`
and wrote it to both `VERSION` and `package.json`. The write was reverted before
commit, but the script is wired into `package.json` as a maintained tool and is
referenced by `policies/core/versioning.md` and `CLAUDE.md` as the source of
automatic versioning — so it is a live footgun.

Two root causes in `calculateVersion()`:

1. **It counts the wrong directory for PATCH.** PATCH is defined as "completed
   plans in the current phase," but the script counts `status: completed` plans
   among **top-level `plans/*.md`** only. Completed plans are *moved* to
   `plans/completed/` (58 currently live there). So the top-level scan finds
   ~zero completed plans and PATCH is structurally almost always `0`.

2. **It picks the phase from stale open drafts.** "Current phase = lowest open
   phase" selects `plans/typed-proposals.md` (`phase: 3, status: draft`), a
   stale Phase-3 draft never closed out — even though active work is in phases
   4–5. That single file pins MINOR at `3`, yielding `0.3.0`.

The result directly contradicts the **actual, maintained** versioning mechanism,
`scripts/phase-close.ts`, which counts `plans/completed/phase-N-*.md` and bumps
to `0.{N+1}.0` at phase close. Two scripts claim to own the same number and
disagree.

There is also a **documentation drift** dimension: `CLAUDE.md` and
`policies/core/versioning.md` state the pre-commit hook auto-bumps VERSION on
plan completion, but neither `.githooks/pre-commit` nor `scripts/pre-commit.sh`
contains any version logic. Versioning is in fact a manual/phase-close step.

This violates **code-over-memory** (a maintained script encodes a broken rule)
and **bugs-before-features** (a latent correctness bug in release tooling).

## Proposed Solution

**Option A (Recommended): Retire `version.js`, make `phase-close.ts` the single
source of truth.**

- Delete `scripts/version.js`.
- Confirm nothing else invokes it (grep `package.json` scripts, hooks, CI). If a
  read-only "what version am I" helper is wanted, add a trivial
  `node -p "require('./package.json').version"` npm script instead.
- Update `CLAUDE.md` and `policies/core/versioning.md` to describe the real
  mechanism: `phase-close.ts` bumps `0.{N+1}.0` at phase close; there is no
  per-commit auto-bump. Remove the "pre-commit hook updates VERSION" claim.

**Option B: Fix `version.js` to match the spec.**

- Count completed plans from `plans/completed/phase-N-*.md`, not top-level.
- Derive the active phase from an explicit source (a `CURRENT_PHASE` marker, the
  highest phase with a completed plan, or `phase-close` state) rather than the
  lowest open draft.
- Add a guardrail: never write a version **lower** than the current `VERSION`
  file; abort with a clear error if the computed value would regress.
- Add a unit test asserting it never regresses and matches `phase-close.ts` for
  a fixture vault.

Recommendation: **Option A.** Two scripts owning the same number is the deeper
problem; consolidating on `phase-close.ts` removes the conflict entirely rather
than maintaining a second, redundant computation. Keep a regression guard (never
write a lower version) wherever the write ultimately lives, as defense in depth.

## Verification

- Grep confirms no remaining caller of `version.js` (or the read-only helper
  replaces it cleanly).
- `CLAUDE.md` / `versioning.md` describe only the mechanism that exists in code.
- If Option B: test proves no-regression and parity with `phase-close.ts`.
- Manual: a clean checkout + phase-close dry run yields the expected `0.{N+1}.0`.

## Alternatives Considered

- **Leave it and rely on "don't run that script"** — rejected; it's wired into
  `package.json` and cited by policy as the canonical tool. Memory/discipline is
  exactly the failure mode code-over-memory forbids.
- **Commit `plans/completed/` count into a cache** — adds a derived-state file
  that can drift from frontmatter (violates "frontmatter is source of truth").

## Future

- Separately, close out or advance the stale `plans/typed-proposals.md`
  (`phase: 3, draft`) — it is the proximate trigger for the bad computation and
  likely misrepresents roadmap state regardless of this fix.
- Consider a CI check that asserts `VERSION` == `package.json` version and never
  decreases between commits.
