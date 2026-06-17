---
title: Add next_action MCP tool — intelligent step-level recommendation
status: completed
completed_date: 2026-06-11
author: NetYeti
created: 2026-06-11
tags:
  - mcp
  - tooling
  - lifecycle
  - ux
proposal_source: proposals/approved/next-action-mcp-tool.md
priority: high
mode: guided
assigned_to: netyeti
tests_defined: true
tests_human_reviewed: true
total_steps: 4
completed_steps: 4
---

# Add next_action MCP tool — intelligent step-level recommendation

## Overview

Add a `next_action` MCP tool that returns a structured JSON recommendation for
"what should I work on right now?" — scans active plans by priority, finds the
first pending step, checks dependencies.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Implement `nextAction()` in `src/mcp/tools/query.ts` | Sort active plans by priority, find first ⏳ Pending step, check sub-plan dependencies, return structured JSON recommendation | ✅ Done |
| 2 | Register `next_action` tool in `query_index.ts` | Wire handler with `McpTool` schema — no required inputs, returns JSON content | ✅ Done |
| 3 | Write tests for the recommendation logic | 7 tests: priority sorting, pending detection, all-done, empty state, approved plans | ✅ Done |
| 4 | Verify it works end-to-end | Confirmed — recommends Phase 3 Step 2 (contribution pipeline), 5/11 steps done, 7 next-action tests + all 190 MCP/dispatch tests pass | ✅ Done |

## Testing Plan

- **Priority sorting:** High-priority plan appears before medium
- **Pending step detection:** Returns first ⏳ Pending step after completed ones
- **All clear:** When all steps done, returns `{ status: "all-clear" }`
- **Empty state:** No plans found returns `all-clear`
- **Approved plans:** Included as actionable (not yet started)
- **End-to-end:** Against live vault, correctly recommends Phase 3

## Rollback Procedures

Revert changes to `query.ts` and `query_index.ts`, remove tool registration.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Plan has malformed steps table | Low | Low | Graceful skip to next plan |
| No active plans | Low | Low | Returns `all-clear` status |

## Phase Gate

- [x] Step 1: `nextAction()` implemented in query.ts
- [x] Step 2: Tool registered in query_index.ts as MCP tool
- [x] Step 3: 7 tests passing
- [x] Step 4: End-to-end verified against live vault

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-11 | Created from approved proposal | NetYeti |
