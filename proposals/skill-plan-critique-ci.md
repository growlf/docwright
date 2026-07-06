---
complexity: high
title: CI-Triggered Plan Critique (Headless)
author: NetYeti
created: 2026-06-04
approved: false
tags:
  - governance
  - ci
  - ai
  - automation
  - improvements
deferred: false
deferred_reason: Requires headless Claude Code invocation mode. Doesn't exist yet. Manual /critique-plan skill ships first.
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/approved/skill-plan-critique.md
_path: proposals/skill-plan-critique-ci.md
milestone: backlog
---
## Problem

The manual `/critique-plan` skill requires a developer to remember to run it. For CI enforcement — running automatically when a plan is created or a proposal is added — we need headless (non-interactive) invocation of Claude Code.

## Proposed Solution

When `plans/` is modified in a PR, a GitHub Actions workflow:

1.  Detects which plan files changed
2.  Invokes Claude Code headlessly: `claude --non-interactive /critique-plan [file]`
3.  Posts the findings as a PR comment
4.  Does NOT commit changes (human reviews the comment and decides)

This requires stable headless Claude Code support, which does not currently exist in a production-ready form.

## Deferred Because

Manual skill ships first. CI automation is a quality-of-life improvement, not a blocker. See \[\[proposals/approved/skill-plan-critique.md\]\].

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-04 | Created — deferred from skill-plan-critique proposal | NetYeti |