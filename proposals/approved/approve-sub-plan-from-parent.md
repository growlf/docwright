---
title: Approve sub-plans from parent plan — critique, approve, create plan
author: NetYeti
created: 2026-06-11
tags:
  - mcp
  - workflow
  - lifecycle
  - webui
approved: true
created_by: NetYeti@phoenix
assigned_to: netyeti
_path: proposals/approve-sub-plan-from-parent.md
consumed_by: plans/completed/approve-sub-plan-from-parent.md
---

## Problem

After a parent phase plan is approved, each sub-plan deliverable requires a
manual, multi-step workflow: find the proposal, critique it, improve it,
approve it, create the plan, populate it. This is done outside the parent plan,
with no correlation between the two.

This breaks flow and discourages breaking work into small sub-plans — exactly
the opposite of what Phase 3's decomposition was meant to enable.

## Proposed Solution

### 1. MCP tool: `approve_sub_plan`

```
approve_sub_plan(parent_plan, proposal_name)
```

**Guard:** Rejects if `parent_plan` does not have `status: approved` or
`status: in-progress`. This ensures sub-plans are only created under an active
parent.

**Steps:**
1. Load the proposal file
2. Run `OpenCodeEngine.critiqueDocument()` — collect AI critique
3. Run `OpenCodeEngine.fillProposal()` — improve sparse sections
4. Write the improved body back to the proposal file
5. Set `approved: true` and `assigned_to` (inherited from parent plan's assigned_to)
6. Call `transition_to_approved` — moves to `proposals/approved/`, creates populated plan
7. Mark the parent plan's deliverable row as 🚧 In Progress
8. Return: critique summary + plan path

**Fallback:** If no AI engine is available (no OpenCode URL), use the
KeywordEngine stubs and still create the plan. The critique will say
"(AI unavailable)" but the approval flow completes.

### 2. Web UI button on parent plan deliverables table

In the parent plan view, each deliverable row that references an unapproved
sub-plan proposal (`[[proposals/sub-plan-*.md]]`) gets an "Auto-approve" button.

Clicking it:
- Calls the same underlying logic (MCP tool or shared dispatch function)
- Shows critique findings in a side panel
- On completion, refreshes the plan view to show the deliverable as 🚧 In Progress

### 3. Consistency: Web UI → MCP tool → dispatch

Both the Web UI and CLI/MCP paths call the same dispatch function in
`src/dispatch/`. The MCP tool is the thin wrapper. The Web UI endpoint
calls the MCP tool via the server.

## Dependencies

- `next_action` MCP tool (just completed) — provides the "what's next?"
  context that leads users to the approve button
- `plan-content-from-proposal-body` (just completed) — ensures generated
  sub-plans are populated with content, not empty skeletons

## Acceptance Criteria

1. `approve_sub_plan` MCP tool exists and works from CLI
2. Guard rejects if parent plan is not approved/in-progress
3. AI critique runs and results are returned
4. Proposal is improved, approved, moved to `proposals/approved/`
5. Sub-plan is created with content populated from proposal body
6. Parent plan's deliverable row updates to 🚧 In Progress
7. Web UI shows auto-approve buttons on parent plan deliverables table
8. Web UI and MCP tool use the same underlying logic

## Future

- Add a "Review critique" step before auto-approving (human-in-the-loop)
- Batch-approve all remaining sub-plans at once
- Track auto-approved sub-plans in audit log with a distinct event type
