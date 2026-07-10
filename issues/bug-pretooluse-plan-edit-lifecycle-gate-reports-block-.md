---
title: PreToolUse plan-edit lifecycle gate reports block but the direct edit still persists to disk
status: new
created: 2026-07-09
author: NetYeti
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-09]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/275
tags:
  - reported-bug
---

# PreToolUse plan-edit lifecycle gate reports block but the direct edit still persists to disk

## Description

OBSERVED 2026-07-09 while editing plans/live-ai-visibility-event-relay.md (Constraint 6). A direct Edit to a plan file triggered the PreToolUse lifecycle gate, which printed: "Lifecycle gate: direct edits to plan files are not allowed. Choose the right MCP tool ... write_plan (full rewrite). See docs/SOPs/plan-mutation.md." The message reads as a block — yet the edit STILL landed on disk: the Edit tool returned success, the file content changed, and `git diff` confirmed exactly the intended change (with no corruption). It appears the hook stopped the agent's follow-up continuation but did NOT prevent the file write.

WHY IT MATTERS: this PreToolUse gate is the first line of the workflow-layer governance that is supposed to force all plan mutations through MCP tools (update_step/append_history/set_plan_field/write_plan) per policies/core/workflow-layer-governance.md. If it reports a block it isn't enforcing, agents (and humans) may believe direct plan edits are prevented when they are not. This is a defense-in-depth gap rather than a full bypass: the git pre-commit hook still validates plan frontmatter/structure at commit time (it did pass for the correctly-formed edit here), so a malformed plan would still be caught before it enters history — but a well-formed direct edit that skips the MCP tools' side effects (e.g. completed_steps recomputation, history discipline) can slip into the working tree undetected.

NEEDS INVESTIGATION: (1) Confirm whether the PreToolUse hook is actually intended to BLOCK the tool call (deny) vs merely warn; if block, why did the write persist? (2) If it is meant to block, the hook likely needs to return the correct deny signal/exit code so the harness aborts the Edit/Write rather than only halting continuation. (3) Add a regression check: attempt a direct Edit to a plan file and assert the file is unchanged afterward.

REPRO: with core.hooksPath set and the lifecycle PreToolUse hook active, use the Edit tool on any plans/*.md file. Expected: file unchanged + agent told to use MCP tools. Actual: gate message shown but file modified on disk.

Related: the correct path (write_plan) works; this bug is only about the gate not enforcing on direct Edit/Write.

## System Info

DocWright dogfood; Claude Code harness PreToolUse hook (lifecycle gate) on plans/*.md; core.hooksPath=.githooks; observed on plans/live-ai-visibility-event-relay.md
