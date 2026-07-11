---
title: "Enforce npm run release:tag as the Only Path to Version Tags"
author: NetYeti
author-role: contributor
created: 2026-06-17
tags:
  - governance
  - ci
  - release
  - tagging
  - code-over-memory
complexity: low
estimated_effort: XS
approved: true
priority: high
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - scripts/release-tag.sh
  - policies/ci-watch-on-tag-push/atom.yaml
  - policies/core/versioning.md
milestone: v0.6.0
---

## Problem

`scripts/release-tag.sh` (exposed as `npm run release:tag`) already does everything
correctly: validates the tag format, creates the annotated tag, pushes it, and
**watches CI until it passes or fails**. It exits non-zero on CI failure and prints
an actionable diagnosis.

Despite this, version tags are still being created manually with `git tag -a ... && git push --tags`,
bypassing CI watching entirely. This happened for v0.3.3 (2026-06-17): the tag was
pushed correctly but CI was never watched until the human noticed the gap.

The `ci-watch-on-tag-push` governance atom documents the behavioral rule. The
PostToolUse Claude Code hook catches direct `git push --tags` calls. But:
1. Hooks only fire in Claude Code — not in terminal, OpenCode, or Gemini sessions
2. The behavioral rule is a judgment atom (advisory), not a deterministic block
3. Manual tag creation bypasses both

This is exactly the **code-over-memory** failure mode: a process that works correctly
(`release-tag.sh`) but is ignored in favour of memory-based "I'll just git tag manually."

## Proposed Fix

### Fix 1 — Pre-commit hook blocks direct `git tag -a` without `release:tag` context (high)

Add a check to `.githooks/commit-msg` (the commit message hook): if the commit was
triggered by a direct `git tag` command (detectable via `GIT_REFLOG_ACTION`), reject it
with a clear message:

```
✗ Direct version tag creation is not allowed.
  Use: npm run release:tag [version]
  This ensures CI is watched and the build is verified before the tag lands.
```

Alternatively: a `prepare` or `post-checkout` git hook that detects tag creation context.

### Fix 2 — `release:tag` script adds to `CHANGELOG.md` automatically (medium)

When `npm run release:tag` succeeds (CI green), auto-append a changelog entry with
the tag, date, and git log since the last tag. Keeps CHANGELOG current without
a separate manual step.

### Fix 3 — Warn in the endsession skill (low)

The `endsession` / `docwright-session-start` skills should check whether the current
VERSION has been tagged. If `v$(cat VERSION)` is not in `git tag`, emit:

```
⚠  Version 0.3.3 in VERSION file has not been tagged yet.
   Run: npm run release:tag
```

This creates a soft reminder without being a hard block.

## Why this is high priority

A broken tagged release ships a broken Docker image to `ghcr.io`. The human only
discovers this when someone tries to pull the image. The `release-tag.sh` script
was built specifically to prevent this — but it only prevents it if it's the path
of least resistance, not just an option that exists.

## Implementation order

1. Fix 3 (XS) — warn in endsession, no new hooks needed
2. Fix 1 (S) — pre-commit/commit-msg hook to block direct tagging
3. Fix 2 (S) — auto-CHANGELOG append on green CI

## Related

- [[scripts/release-tag.sh]] — already does the right thing; just needs to be enforced
- [[policies/ci-watch-on-tag-push/atom.yaml]] — governance atom documenting the behavioral rule
- [[policies/core/versioning.md]] — versioning policy (v0.MINOR.PATCH)
