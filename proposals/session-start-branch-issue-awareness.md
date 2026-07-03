---
title: "Session-start should surface unmerged branches and open issues"
author: NetYeti
author-role: contributor
created: 2026-07-02
tags:
  - governance
  - session-start
  - tooling
  - code-over-memory
  - roadmap
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---

> Root cause of the 2026-07-01 near-loss of the urgent #68 base process-flow
> proposal — parked on a branch, invisible to session-start, forgotten by the AI.

## Problem

`scripts/vault-status.js` — which drives the `docwright-session-start` skill —
enumerates proposals and plans by reading the **working tree on the current
branch** (effectively `main`). It has no awareness of:

- **Unmerged remote branches** carrying committed-but-unlanded work.
- **Open GitHub issues** (e.g. discussion/tracking issues).
- **Open PRs** awaiting merge.

Under trunk-based branching this is not an edge case — it is the normal case.
Parked work silently vanishes from the session-start picture, producing "what's
next" recommendations that are confidently wrong. This violates the
`code-over-memory` policy.

## Proposed Solution

Extend `vault-status.js` / the session-start skill to surface, **before** the
summary:

1. **Unmerged remote branches**: `git branch -r --no-merged origin/main` with
   ahead/behind counts and last-commit subject, flagged as "parked work."
2. **Open issues**: `gh issue list --state open` with title + number,
   especially discussion/tracking/urgent labeled items.
3. **Open PRs**: `gh pr list --state open` with mergeable state.

Fold these into the session-start report and todo seeding so parked work is
impossible to miss. Degrade gracefully when `gh` is unavailable (branches from
`git` still work without network).

## Alternatives Considered

- **Rely on human memory during session start** — rejected per
  [[policies/core/code-over-memory.md]]. The 2026-07-01 incident proves memory fails.
- **Only surface branches, not issues/PRs** — partial fix; issues are how we track
  discussions and urgent items, equally critical.
- **Use a separate daemon/tracker** — over-engineered; the fix lives in the
  existing vault-status.js in ~100 lines.

## Future

Once landed, this pattern should be ported to the `docwright-session-start`
skill instructions so other vaults automatically benefit.
