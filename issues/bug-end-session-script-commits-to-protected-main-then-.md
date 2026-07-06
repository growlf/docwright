---
title: end-session script commits to protected main then push is rejected, stranding commits
status: scope-checked
author: NetYeti
author-role: user
created: 2026-07-05
category: bug
priority: medium
complexity: medium
estimated_effort: S
tags: []
reported_dates: [2026-07-05]
demand_count: 1
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as bug / medium.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: https://github.com/growlf/docwright/issues/191
assigned_to: []
created_by: NetYeti@cluster-llm
channel: dev
---

# end-session script commits to protected main then push is rejected, stranding commits

## Description

`npm run session:end` (scripts/end-session.ts) commits the session note + SESSION-LOG.md update directly on whatever branch the tree is on. When that branch is `main` (the normal end-of-session state), the subsequent push is rejected by branch protection (GH006: changes must be made through a pull request), leaving the commits STRANDED on local main. The script detects this and prints recovery guidance (`git checkout -b <type>/<slug> && gh pr create`), but makes the human/AI perform the recovery by hand every time.

The script already knows main is protected — this is a known-failure path, not an edge case. Per policies/core/code-over-memory.md, the recovery it prescribes should be the behavior it performs: when on a protected branch (or after a rejected push), automatically create `docs/session-note-<timestamp>`, move/commit the note there, push, and open the PR via `gh pr create --base main` (optionally auto-merge when checks pass). Direct push can remain the fast path for unprotected setups.

Observed 2026-07-05 on phoenix: endsession after the agent-roles proposal session; recovery required manual branch creation + PR #190. Every endsession run on this repo will hit the same wall.

## System Info

DocWright source repo as vault; phoenix; main protected (squash-only PRs, 3 required checks)
