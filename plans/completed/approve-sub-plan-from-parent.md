---
title: Approve sub-plans from parent plan — critique, approve, create plan
status: completed
completed_date: 2026-06-11
author: NetYeti
created: 2026-06-11
tags:
  - mcp
  - workflow
  - lifecycle
  - webui
proposal_source: proposals/approved/approve-sub-plan-from-parent.md
priority: high
automated: guided
assigned_to: netyeti
tests_defined: true
tests_human_reviewed: false
total_steps: 5
completed_steps: 5
---

# Approve sub-plans from parent plan — critique, approve, create plan

## Overview

One-click approval of sub-plan proposals from the parent plan. Chains:
critique → improve → approve → create populated plan → update parent deliverable.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Implement `approveSubPlan()` in `src/dispatch/` | Pure function: guard (parent plan approved), load proposal, critique, fill proposal, write approved frontmatter, call transitionToApproved, update parent deliverable row. AI engine via `getAIEngine()`, falls back to KeywordEngine stubs. | ✅ Done |
| 2 | Register `approve_sub_plan` MCP tool | Thin wrapper in `src/mcp/tools/` — calls dispatch function, returns critique + plan path. Input: `parent_plan`, `proposal_name`. | ✅ Done |
| 3 | Add Web UI `/api/approve-sub-plan` endpoint | HTTP endpoint calling the same dispatch function. Returns JSON with critique findings, plan path, deliverable status. | ✅ Done |
| 4 | Add "Auto-approve" button to parent plan view | In the plan renderer, detect deliverable rows referencing unapproved sub-plan proposals. Render actionable button that calls the endpoint. On success, refresh to show 🚧 In Progress. | ✅ Done |
| 5 | Tests | Unit tests: guard rejection, critique+improve flow, deliverable update, full end-to-end against Phase 3. | ✅ Done |

## Testing Plan

- **Guard test:** `approveSubPlan(parent='unapproved-plan', proposal='x')` → rejects
- **Critique test:** critique runs and results are returned (or stub fallback)
- **Deliverable test:** parent plan row updates from ⏳ to 🚧
- **E2E test:** Run against Phase 3 parent with `sub-plan-vault-migration-system.md`

## Rollback Procedures

- Un-approve the proposal: move it back to `proposals/` and set `approved: false`
- Delete the generated plan from `plans/`
- Revert parent deliverable status

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI engine unavailable (no OpenCode) | Medium | Low | KeywordEngine stubs; flow still completes |
| Parent deliverable row not found | Low | Low | Graceful skip; deliverable update is best-effort |
| Wikilink in deliverable table is malformed | Low | Low | Skip that row; log warning |

## Phase Gate

- [x] Step 1: `approveSubPlan()` dispatch function implemented
- [x] Step 2: MCP tool registered and working
- [x] Step 3: Web UI endpoint added
- [x] Step 4: Auto-approve button renders on parent plan
- [x] Step 5: Tests passing
- [x] E2E: Phase 3 sub-plan approved and plan created end-to-end

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-11 | Created from approved proposal | NetYeti |
| 2026-06-11 | All 5 steps done. 18 tests pass. MCP tool, Web UI endpoint, and auto-approve button implemented. | NetYeti |
| 2026-06-11 | E2E pass with Phase 3 parent — approve_sub_plan creates plan + updates deliverable. Fixed wikilink matching (with/without .md). | NetYeti |
| 2026-06-11 | Plan completed — all steps done, tests passing, E2E verified with Phase 3 parent. | NetYeti |
