---
title: dw-vault MCP server runs a stale dist/ build — capture_bug_report emits invalid status/milestone
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

# dw-vault MCP server runs a stale dist/ build — capture_bug_report emits invalid status/milestone

## Description

`mcp__dw-vault__capture_bug_report action=create` writes `status: open` + `milestone: future` into the new issue's frontmatter, which pre-commit's schema/status-enum checks reject (valid status enum: `new, triaged, scope-checked, awaiting-proposal, proposal-linked, resolved, deferred, duplicate`; `milestone` is only valid once status is `proposal-linked`, `resolved`, or `deferred`).

**This is not a source bug.** `src/dispatch/bridge.ts`'s `createReportedBug()` (which `src/mcp/tools/issue_workflow.ts`'s `captureBugReport()` correctly imports and calls) was already fixed on 2026-07-08 to emit `status: new` with no `milestone` field — confirmed by reading both files directly. The problem is that `.mcp.json` points `dw-vault`/`dw-upstream` at the **compiled** `dist/mcp/server.js`, and `dist/` was last built 2026-07-05 (`dist/dispatch/bridge.js`, `dist/mcp/tools/issue_workflow.js`), three days *before* the source fix — so the running MCP server still ships the old broken template. Rebuilding `dist/` (`npm run build`) and restarting the MCP connection resolves it immediately; no code change needed.

Root cause / fix: add a CI or pre-commit check (or a post-commit build hook) that fails when `dist/` is older than the `src/` files it's built from, so this class of "fixed in source, still broken at runtime" bug can't recur silently. Caught while filing issues/bug-proposal-to-plan-lifecycle-transition-duplicates-a.md this session — rebuilt `dist/` manually as a workaround.

## System Info

None provided
