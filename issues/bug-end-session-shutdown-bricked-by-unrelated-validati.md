---
title: end-session shutdown bricked by unrelated validation debt in working tree
github_issue: https://github.com/growlf/docwright/issues/306
status: new
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

# end-session shutdown bricked by unrelated validation debt in working tree

## Description

scripts/end-session.ts stages everything outstanding and makes ONE commit, so any working-tree file with pre-existing validation debt (e.g. plans missing scenario_synthesis, approved plans with empty assigned_to, proposal approved-flips lacking the HUMAN-APPROVED seal) hard-fails the pre-commit hook and blocks the entire session shutdown — including the already-written session note and SESSION-LOG entry. Reproduced 2026-07-10: shutdown failed twice (6 validation errors from UI-session plan edits, then human-approval seals on three proposals) and required manual unstaging to complete. Fix ideas: commit in two passes (session artifacts first, then best-effort rest), or exclude files that fail validation with a loud report listing them, or support --exclude paths. Related but distinct from the protected-main push bugs already filed against end-session.

## System Info

None provided
