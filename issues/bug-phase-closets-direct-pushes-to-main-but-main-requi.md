---
title: phase-close.ts direct-pushes to main but main requires PRs — release script cannot close a phase
status: new
created: 2026-07-11
author: agent
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-11]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/329
related:
  - plans/release-v0.5.0.md
  - plans/reconcile-versioning-policy-and-practice.md
  - policies/core/versioning.md
tags:
  - reported-bug
---

# phase-close.ts direct-pushes to main but main requires PRs — release script cannot close a phase

## Description

OBSERVED 2026-07-11 preparing the Phase 4 close (0.5.0). `scripts/phase-close.ts` (npm run phase:close -- N) does `git commit` on the current branch then `execSync('npm run release:tag ...')` which pushes to origin and tags. When run against `main`, the direct push is REJECTED: main branch protection has required_pull_request_reviews=YES and enforce_admins=true (verified via gh api repos/.../branches/main/protection). So the documented "single source of truth" phase-close mechanism cannot actually close a phase — the bump must instead go through a release-branch PR + a manual tag on the merged commit.

IMPACT: policies/core/versioning.md presents `phase:close -- N` as the canonical close mechanism (it commits, tags, pushes), but it is incompatible with the PR-protected trunk. Anyone following the policy hits a push rejection at release time. The prior 0.4.10-0.4.12 bumps went via PRs, not this script.

FIX DIRECTIONS (pick): (a) make phase-close.ts operate on a release/vX.Y.Z branch (create branch off main, bump + commit there, push branch, open PR to main, and tag only after the merge — decoupling the tag from the direct push); (b) detect branch protection and, when PRs are required, print the exact release-branch + PR + tag steps instead of attempting a direct push; (c) at minimum, fail fast with a clear message when the current branch is a protected main, rather than erroring mid-push. Also update policies/core/versioning.md so the Automation section describes the PR-based release path that actually works.

RELATED: this surfaced immediately after plans/reconcile-versioning-policy-and-practice landed (which documented phase-close behaviour) — the policy now accurately describes the script, but the script itself doesn't fit the protected-main reality.

## System Info

None provided
