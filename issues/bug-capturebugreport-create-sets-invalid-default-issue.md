---
title: capture_bug_report create sets invalid default issue status 'open'
status: new
created: 2026-07-09
author: agent
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-09]
channel: dev
related:
  - issues/bug-proposal-to-plan-lifecycle-transition-duplicates-a.md
tags:
  - reported-bug
---

# capture_bug_report create sets invalid default issue status 'open'

## Description

mcp__dw-vault__capture_bug_report action=create writes `status: open` into the new issue's frontmatter, but the issue schema's valid enum is `new, triaged, scope-checked, awaiting-proposal, proposal-linked, resolved, deferred, duplicate` (enforced by scripts/pre-commit.sh's status-enum check). Every bug filed through the sanctioned suggest->create flow therefore fails pre-commit validation and has to be hand-corrected to `status: new` before it can be committed. Caught while filing issues/bug-proposal-to-plan-lifecycle-transition-duplicates-a.md this session.

It also defaults `milestone: future`, which pre-commit separately rejects because milestone is only valid when status is `proposal-linked`, `resolved`, or `deferred` — so a freshly created bug (status: new) has to have that field stripped too. Both defaults come from the same template/defaulting logic and should be fixed together.

## System Info

None provided
