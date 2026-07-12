---
title: versioning policy still references retired develop branch for release branches
github_issue: https://github.com/growlf/docwright/issues/299
status: resolved
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
tags:
  - reported-bug
---

# versioning policy still references retired develop branch for release branches

**RESOLVED 2026-07-11** by `plans/completed/reconcile-versioning-policy-and-practice.md`.
`policies/core/versioning.md` now scrubs the retired-`develop` release-branch flow —
release branches cut from `origin/main` (trunk-based); the only remaining `develop`
mention states it was retired 2026-06-30.

> **Proposal-linked 2026-07-11** (backlog cleanup) → captured by `proposals/reconcile-versioning-policy-and-practice.md`. Not lost; will be delivered as part of that proposal/plan.


## Description

policies/core/versioning.md instructs cutting release branches with `git checkout -b release/v0.<phase>.<patch> develop`. The develop branch was retired 2026-06-30 (trunk-based migration; CLAUDE.md and CONTRIBUTING.md say release/v*.*.* branches are cut from main). Anyone (human or agent) following the versioning policy verbatim will fail or recreate a develop branch. Fix: update the release-branch section of versioning.md to branch from main, and sweep the policy for any other develop references.

## System Info

None provided
