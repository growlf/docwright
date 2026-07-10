---
title: phase-close.ts docstring claims step verification but code only greps status completed
github_issue: https://github.com/growlf/docwright/issues/303
status: new
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: low
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
tags:
  - reported-bug
---

# phase-close.ts docstring claims step verification but code only greps status completed

## Description

scripts/phase-close.ts usage()/docstring says all matched phase plans must be fully verified (✅ steps), but findPhasePlans() only checks that file contents include the string "status: completed" — it does not verify Implementation Steps are done, and a plan body merely mentioning "status: completed" in prose would false-positive. The phase-close gate is weaker than documented. Fix: parse frontmatter properly and (per lilyetibot-style milestone gating under discussion) require a signed-off phase validation doc before allowing the close.

## System Info

None provided
