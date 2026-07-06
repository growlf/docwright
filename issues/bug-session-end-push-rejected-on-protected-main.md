---
title: "scripts/end-session.ts pushes directly to main and fails on branch protection — needs to branch+PR instead"
status: open
github_issue: 146
author: NetYeti
author-role: contributor
created: 2026-06-30
category: bug
priority: low
complexity: low
estimated_effort: S
tags:
  - governance
  - automation
  - session-shutdown
  - trunk-migration
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: v0.5.0
---

> Hit twice in one session (2026-06-30, PRs #74 and #75) — same manual
> workaround both times. Per `.opencode/rules/one-off-formalization.md`,
> a manual dance repeated more than once should become a proposal.

## Problem

`npm run session:end` (`scripts/end-session.ts`) commits the session note and
any outstanding work directly onto the local `main` branch, then attempts
`git push origin main`. Since the trunk-based migration on 2026-06-30 (commit
`d7ab30d`), `main` has branch protection requiring a PR and passing status
checks — the direct push is always rejected (`GH006: Protected branch update
failed`).

Twice in the same session, the fix was the same manual sequence:

```
git branch <slug>
git reset --hard origin/main
git checkout <slug>
git push -u origin <slug>
gh pr create --base main ...
# wait for CI
gh pr merge <n> --squash --delete-branch
git checkout main && git pull --ff-only origin main
```

This is exactly the kind of repeated manual process this project's own
`code-over-memory` policy says should be encoded, not repeated from memory
each time.

## Proposed Solution

Update `scripts/end-session.ts` so that, when it detects the current branch
is a protected branch (or simply always, now that `develop` is retired and
`main` is always protected), it:

1. Commits the session note + outstanding work to a generated branch
   (e.g. `docs/session-<timestamp>` or `chore/session-<timestamp>`) instead of
   directly on `main`.
2. Pushes that branch and opens a PR via `gh pr create --base main` with a
   reasonable auto-generated title/body from the same session summary already
   being composed.
3. Reports the PR URL in its summary output instead of reporting a raw push
   failure that requires manual recovery.

Auto-merging is explicitly out of scope — CI still needs to run, and per this
repo's branching policy merges to `main` warrant a human's `gh pr merge` (or
at minimum a follow-up automated check once CI is green), not an
unconditional auto-merge baked into the shutdown script.

## Alternatives Considered

- **Leave main unprotected for session-note commits.** Rejected — weakens the
  branch protection invariant for no real benefit; session notes are exactly
  the kind of low-risk change a PR-then-merge flow handles fine.
- **Have session:end detect the rejection and print the exact recovery
  commands** (a smaller fix than full automation). Viable fallback if full
  PR automation is judged too risky to hand to a script, but doesn't remove
  the recurring manual step, just documents it.

## Future

If `gh pr merge --squash` after a clean CI run turns out to be safe to
automate too (e.g., only for session-note-only diffs with no code changes),
that could be a fast-follow — but should be its own explicit decision, not
bundled into this fix.

## Scope update (2026-07-04)

Partially addressed by the branch-hygiene work (bef5d43): on protected-main rejection,
`end-session.ts` now warns, tracks the commits as "stranded", and prints the exact
`git checkout -b … && gh pr create --base main` recovery commands. Remaining: it does
not auto-create the branch+PR — the manual dance is still required. Stays open for the
auto branch+PR behavior.
