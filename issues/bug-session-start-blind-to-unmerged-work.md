---
title: "Session-start is blind to unmerged branches and open issues — parked work silently vanishes"
status: resolved
closed_by_pr: "#77"
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: high
complexity: medium
estimated_effort: M
tags:
  - governance
  - session-start
  - tooling
  - code-over-memory
  - roadmap
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: next
---

> Root cause of the 2026-07-01 near-loss of the urgent #68 base process-flow
> proposal. It was designed the prior session, pushed to a branch, and then
> dropped from the "what's next" picture entirely until the human noticed.

## Problem

`scripts/vault-status.js` — which drives the `docwright-session-start` skill —
enumerates proposals and plans by reading the **working tree on the current
branch** (effectively `main`). It has no awareness of:

- **Unmerged remote branches** carrying committed-but-unlanded work.
- **Open GitHub issues** (e.g. discussion/tracking issues).
- **Open PRs** awaiting merge.

So any work parked on a branch — a common, legitimate state under trunk-based
flow — is **invisible** at session start. The AI then builds a "what's next"
recommendation from an incomplete picture and can confidently omit the single
most important queued item.

## Concrete failure (2026-07-01)

The urgent umbrella proposal
`separate-dev-tracking-milestones-and-beta-channel.md` (309 lines: code-issue vs
governance split, milestones, beta channel, deployment model — discussion issue
#68) lived only on the unmerged branch `docs/dev-tracking-milestones-beta`.
Session-start reported "1 active plan" and a bug backlog, never mentioning #68.
The session's entire plan-of-work was built around it being absent. It was
recovered only because the human remembered it and asked.

## Impact

This is a `code-over-memory` hole: the process silently depends on human memory
to not lose branch-parked work. Under trunk-based branching (where in-progress
work *lives* on branches by design) this failure mode is not an edge case — it
is the normal case. Governance that forgets its own in-flight work is worse than
none, because it projects false completeness.

## Proposed Fix

Extend `vault-status.js` / the session-start skill to surface, **before** the
summary:

- **Unmerged remote branches**: `git branch -r --no-merged origin/main` (with
  ahead/behind counts and last-commit subject), flagged as "parked work."
- **Open issues**: `gh issue list --state open` (at minimum title + number),
  especially those labeled discussion/tracking/urgent.
- **Open PRs**: `gh pr list --state open` with mergeable state.

Fold these into the session-start report and the todo seeding so parked work is
impossible to miss. Degrade gracefully when `gh` is unavailable or offline
(branches from `git` still work without network). Per
[[policies/core/code-over-memory.md]], the enforcement must be mechanical — the
AI must not have to *remember* to check.

## Related

- [[proposals/separate-dev-tracking-milestones-and-beta-channel]] — the near-lost work that exposed this
- [[policies/core/code-over-memory.md]] — the principle this violates
- [[proposals/formalize-roadmap-sequencing-enforcement]] — related roadmap-visibility gap
- [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user]] — sibling visibility gap

## Resolution (2026-07-04)

Fixed by PR #77 (a028378). `scripts/vault-status.js` reports `parked_branches`
(`git branch -r --no-merged origin/main`), the MCP `getSessionContextStructured` mirrors
it, and both `.claude` and `.opencode` session-start skills consume it plus gh PR/issue
state.
