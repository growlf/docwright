---
title: "release-tag.sh repo slug keeps .git suffix — CI watch fails on every release"
status: open
author: NetYeti
author-role: contributor
created: 2026-07-04
category: bug
priority: medium
complexity: low
estimated_effort: S
tags:
  - release
  - ci
  - tooling
  - dogfooding
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: v0.5.0
---

> Found by dogfooding on 2026-07-04 while cutting the **v0.4.7** release. The tag pushed
> and the tag-triggered CI run passed, but `release-tag.sh` reported
> "⚠️ No tag-triggered CI run appeared within 45s" and exited non-zero.

## Problem

`scripts/release-tag.sh` derives the GitHub repo slug with:

```sh
REPO=$(git remote get-url origin | sed -E 's|.*github\.com[:/]([^/]+/[^/]+?)(\.git)?$|\1|')
```

The non-greedy `[^/]+?` plus the optional `(\.git)?` group leaves the `.git` suffix in
capture group 1, so `REPO` becomes `growlf/docwright.git` instead of `growlf/docwright`.
Every subsequent `gh ... --repo "$REPO"` call then targets a nonexistent repo and fails
silently (the calls are guarded with `|| true`), so the CI-watch loop never finds the run.

## Impact

- The release-safety check is effectively dead: `release-tag.sh` **always** fails to
  observe the CI result, printing "No tag-triggered CI run appeared" and exiting 1 even
  when the release CI is green (as happened for v0.4.7).
- Worse, it means a genuinely **failing** release CI would also go unreported by the
  script — the exact failure mode this tooling exists to catch. A broken safety check
  reads as "no safety check." ([[policies/core/code-over-memory]])

## Fix

Strip the host prefix and the `.git` suffix independently:

```sh
| sed -E 's|.*github\.com[:/]||; s|\.git$||'
```

Verified against both `git@github.com:growlf/docwright.git` and
`https://github.com/growlf/docwright.git` → `growlf/docwright`.

**Fix applied in this PR.**

## Acceptance

- `release-tag.sh` resolves `REPO=growlf/docwright` for both SSH and HTTPS origins.
- After pushing a tag, the script finds the triggered run, watches it, and exits 0 on
  success / non-zero on failure with the failed-step log.
