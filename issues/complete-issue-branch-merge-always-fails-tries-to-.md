---
title: "complete_issue_branch --merge always fails: tries to merge before required checks finish"
status: open
github_issue: 166
category: bug
priority: high
tags:
  - github-issue
  - issue-workflow
created: 2026-07-05
created_by: "NetYeti@host"
assigned_to: ""
milestone: backlog
---

Hit on every single use this session (PRs #154, #161, #164): `complete_issue_branch(num, merge=true)` pushes, creates the PR, then immediately calls `gh pr merge` — but branch protection requires 3 status checks that have barely started, so the merge fails with `GraphQL: 3 of 3 required status checks are expected` and a human (or AI) has to watch checks and merge manually. The `merge: true` option is effectively dead code under branch protection.

## Proposed fix
After PR creation, when merge=true: poll/watch the required checks (`gh pr checks --watch` or the checks API) with a bounded timeout (~10 min), then merge. Surface check failures distinctly from timeout. Respect the repo's merge method (squash — no merge commits allowed).

## Acceptance criteria
- [ ] `complete_issue_branch(num, merge=true)` on a protected branch merges once checks pass, without manual intervention.
- [ ] Check failure → clear error naming the failing check; timeout → clear error with the PR URL.
- [ ] Unit tests with a stubbed checks-poller (no live GitHub in tests).

**Verification:** next issue completed via the tool merges hands-off.
**Policy:** policies/core/code-over-memory.md — the manual watch-then-merge dance is exactly the kind of memory-dependent process this bans.
