---
title: Web UI lifecycle actions write to the working tree but never commit to git — the root of the approval-flow friction
status: resolved
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: high
complexity: medium
estimated_effort: M
tags: []
github_issue: 147
milestone: backlog
assigned_to: []
created_by: NetYeti@cluster-llm
closed_by_pr: #199
resolved: 2026-07-06
---

> Found by dogfooding on 2026-07-01 (GitHub #68 approval). This is the **root cause** that
> ties together the other three findings from the same session:
> [[proposals/bug-plan-generator-from-approved-proposal]],
> [[proposals/bug-approve-not-idempotent-stale-consumed-by]], and
> [[proposals/bug-approve-by-move-bypasses-self-approval-gate]]. Fixing this dissolves most
> of the friction the other three describe.

## Problem

The Web UI performs governance/lifecycle actions — Approve a proposal, generate a plan,
approve a plan — by **writing to the working tree** (setting `approved: true`, moving files
into `proposals/approved/`, creating `plans/*.md`). It then **stops there.** It does not
`git add`/`commit`/`push` the change.

As a result, every UI action leaves the repository in an uncommitted state, and a human (or
the AI) has to drop to the CLI afterward to persist it. During the #68 approval this forced a
manual `git commit` with a hand-added `HUMAN-APPROVED:` marker — the exact CLI detour the UI
is supposed to spare contributors, and a step that felt like over-engineering precisely
*because the human had already approved on the sanctioned surface.*

## Impact

1. **Approvals aren't durable.** The human clicks Approve and believes it is done; nothing is
   in git until a separate manual commit runs. A crash, refresh, or `git checkout` loses it.
2. **The human seal gets applied at the wrong layer.** Because the UI doesn't commit, the
   `HUMAN-APPROVED:` marker has to be typed by hand at the CLI — instead of being applied
   automatically and honestly by the surface where the human actually authenticated and
   clicked. The UI already knows the human's identity (OAuth); it is the *correct* place to
   author the seal.
3. **It masks the gate bypass.** Because approval-by-move never triggers the pre-commit gate
   (see [[proposals/bug-approve-by-move-bypasses-self-approval-gate]]), and the UI doesn't
   commit at all, an approval can exist on disk with no seal anywhere. The two bugs compound.
4. **Working-tree drift.** Successive UI actions stack uncommitted changes, making it unclear
   what is persisted vs. pending — the opposite of "git is the canonical store" (invariant #3).

## Proposed Fix

- **The UI commits its own lifecycle actions.** On Approve / generate-plan / plan-approve,
  the server-side handler stages exactly the files it changed and commits them, attributing
  the commit to the authenticated user (name/email from OAuth), and — for approval
  transitions — **authoring the `HUMAN-APPROVED:<name>` marker itself**, because the click by
  an authenticated human *is* the seal.
- **Prefer a branch + PR, not a direct commit to `main`** (trunk-based; `main` is protected).
  The UI should create/reuse a working branch and open/update a PR, or commit to the user's
  current working branch — never push straight to protected `main` (cf.
  [[proposals/bug-session-end-push-rejected-on-protected-main]]).
- **Surface the git result** in the UI (committed / pushed / PR link, or a clear error) so
  the human sees that their action persisted — closing the same "silent, did-it-work?" gap as
  [[proposals/bug-approve-not-idempotent-stale-consumed-by]].
- Coordinate with the gate fix so the UI-authored marker and the pre-commit gate agree on the
  move path (don't double-require or bypass).

## Verification

- Approving a proposal in the UI results in a commit (on a branch / PR, not protected `main`)
  with the `HUMAN-APPROVED:` marker and the authenticated user as author — no manual CLI step.
- After the action, `git status` is clean for those files; the UI shows the commit/PR link.
- A failed persist (e.g. protected branch, hook rejection) shows a clear error in the UI
  rather than silently leaving the change uncommitted.

## Scope update (2026-07-04)

GH #110 was closed by PR #111 (commit ef1a4d0), but that fix covers **only the
approve-proposal path** (approve → move + generate plan now auto-commits via
`git-commit.ts`/`commitPaths`). Still uncommitted: approving a plan
(approve-sub-plan / plan-review), create-plan, and document edits (`/api/write`); the
fix also commits to the current branch locally rather than branch+PR. This file stays
**open** for the remaining paths and needs a fresh GH mirror issue (the old #110 is
closed with narrower scope).
