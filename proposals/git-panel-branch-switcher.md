---
title: "Git panel branch switcher"
author: "NetYeti"
created: "2026-07-05"
tags: [ui, git, dogfooding, ux]
category:
  - ui
complexity: medium
approved: false
priority: medium
created_by: "NetYeti@cluster-llm"
assigned_to: []
related_to:
  - "[[proposals/three-docwright-instance-deployment]]"
depends_on: []
blocks: []
part_of: plans/release-v0.5.0.md
milestone: v0.5.1
---

# Git panel branch switcher

## Summary

Add a branch selector to the Git view container (`GitPanel.svelte` + a new `/api/git/branch`
endpoint) so a user can see the vault's current branch and switch to another one from the UI,
changing which branch the running server serves.

## Problem Statement

There's no way to change which branch the dev server is showing without dropping to a shell and
running `git checkout` on the host. This is most painful for the dev-cloud instances — e.g.
previewing a docs branch in `csdocs`, or a different `dogfood`/`main` view in the dev instance —
which is exactly the dogfooding workflow the four-instance dev-cloud is meant to support
([[proposals/three-docwright-instance-deployment]]).

## Proposed Solution

- **`GET /api/git/branch`** — list local (and optionally remote) branches + the current branch.
- **`POST /api/git/branch`** — `git checkout <branch>` (or `-b` for a new branch), gated by the
  same auth/ACL as the other mutating `/api/git/*` routes.
- **`GitPanel.svelte`** — a current-branch indicator + dropdown to switch; on switch, refresh the
  file tree / current page (and the SSE watch picks up the changed files).

**Safety / preconditions:**
- Refuse (or require confirm) when the working tree is **dirty** — a checkout would fail or stash
  silently; surface the state instead.
- Only offer real branches of the vault repo — no arbitrary refs; validate against the branch list.
- `git checkout` can run hooks and rewrite many files — treat it as a privileged, audited action.

## Expected Outcomes
- From the Git panel, switch the vault's branch and see the tree/pages reflect it, with a clear
  current-branch indicator.
- Dirty-tree and invalid-branch cases are handled with a clear message, not a 500.

## Resources Required
- One new API route (`/api/git/branch`), dispatch/git helper for branch list + checkout, and
  GitPanel UI. Small-to-medium; no new deps.

## Related Documents
- [[proposals/three-docwright-instance-deployment]] — the dev-cloud this most benefits.
- `docs/deployment-bms-devcloud.md` — instance/vault topology.

## Discussion Notes
- **Key design decision — the dev instance (#1) serves *itself*.** For the release instances
  (#2/#3/#4) the vault is a *content* repo separate from the running code, so switching its branch
  changes only the served content — clean and safe. But #1's vault **is** the DocWright checkout, so
  switching its branch also swaps the **source code the server is running** (Vite would hot-reload,
  possibly into a broken/incompatible tree). Options to resolve in the plan:
  1. Guard/warn when the vault root == the app's own source tree (offer switch but flag the risk).
  2. Only enable content-affecting switches; require a server restart for code-affecting ones.
  3. Allow it unconditionally (pure dogfood) and accept the occasional self-inflicted breakage.
- **Bugs before features:** per [[policies/core/bugs-before-features]], this queues behind the open
  bug issues; flagged here for prioritization, not immediate implementation.
