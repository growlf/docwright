---
title: "SOP: Plan Completion Workflow"
category: workflow
created: "2026-06-04"
author: "NetYeti"
tags: [workflow, plans, completion, mcp, governance]
reviewed_by: ""
status: approved
---

# SOP: Plan Completion Workflow

## Purpose

Define the exact steps an AI agent must follow when completing a plan. This
routine exists because plan completion is a governed state transition — not a
simple field update. Skipping steps creates stale records or bypasses the
governance gate.

## When to use this SOP

Any time you are asked to:
- Mark a plan complete / done / finished
- Set `status: completed` on a plan
- Archive or close out a plan
- Transition a plan to `plans/completed/`

<agent-instructions mode="inline" triggers="complete plan,mark plan done,plan complete,status completed,finish plan,close plan">

## Plan Completion Routine — follow these steps in order

### Step 1 — Read the current plan state

```
get_plan("<plan-name>")
```

Do not rely on your context window's version of the file. Read it fresh.

### Step 2 — Self-check: are all steps done?

Scan every row in the **Implementation Steps** table. Check the status column
(the last column before the trailing `|`) for each row.

- If every row shows a ✅ marker → proceed to Step 3
- If ANY row shows a ⏳ marker → **STOP**

**If steps are pending:**
1. List each pending step by its description
2. Explain that completion cannot proceed until they are resolved
3. Ask the contributor: which of these steps are genuinely complete, and which
   still need work?
4. For steps that are complete: call `update_step` to mark them done (see below)
5. Do NOT call `update_plan_status` or `transition_to_completed` until all rows are ✅

Do not skip this check. The MCP tools will enforce it mechanically, but
self-checking first means the contributor sees the issue as a helpful message,
not as a tool error.

### Step 3 — Set status: completed via MCP

```
update_plan_status("<plan-name>", "completed")
```

This validates pending steps, updates `completed_steps`/`total_steps` counts,
and logs the transition. If the MCP tool returns an error about pending steps,
return to Step 2.

### Step 4 — Add a history entry

```
append_history("<plan-name>", "Plan marked complete — all steps verified")
```

### Step 5 — Archive the plan

```
transition_to_completed("<plan-name>")
```

This moves the file to `plans/completed/` and generates a doc in `docs/`.
Report the outcome to the contributor including the generated doc path.

---

## Related tools (reference)

| Tool | When to use |
|------|-------------|
| `update_step(name, match, status)` | Mark a single step done or pending |
| `update_plan_status(name, status)` | Change plan status with validation |
| `append_history(name, change)` | Add a Document History row |
| `set_plan_field(name, field, value)` | Set one frontmatter field |
| `transition_to_completed(name)` | Archive to plans/completed/ + generate doc |

## What you must NOT do

- Do not call `update_plan_status(..., 'completed')` before checking steps
- Do not write `status: completed` directly to the plan file — the PreToolUse
  hook will block it and redirect you here
- Do not call `transition_to_completed` before `update_plan_status` — the MCP
  tool requires status to already be set

</agent-instructions>

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — plan-completion skill for Phase 1; closes behavioral gap identified in workflow-layer-governance review | NetYeti |
