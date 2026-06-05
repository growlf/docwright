---
title: "SOP: Plan Mutation — All Scenarios"
category: workflow
created: "2026-06-04"
author: "NetYeti"
tags: [workflow, plans, mcp, governance, mutation]
reviewed_by: ""
status: approved
---

# SOP: Plan Mutation — All Scenarios

## Purpose

All mutations to plan files (`plans/*.md`) must go through MCP tools. This SOP
is the single reference for which tool to use in each scenario. Direct file
writes — via Write, Edit, Bash, Python, `cat >`, `tee`, or any shell command —
are prohibited and bypass lifecycle validation (AGENTS.md §Invariant 6).

## Governance rule

The PreToolUse hook blocks Write/Edit to `plans/*.md`. Bash and Python writes
bypass the hook but are equally prohibited by behavioral contract. The git
pre-commit hook serves as a final backstop. There are no exceptions.

**If MCP tools are unavailable:** halt and report — "MCP server is unavailable,
cannot safely mutate plan files." Ask the human to restart the server. Do NOT
fall back to direct writes. No mutation is better than an unvalidated one.

---

## Mutation tool reference

| Scenario | Tool | When to reach for it |
|----------|------|----------------------|
| Mark one step complete or pending | `update_step(name, match, status)` | Any time an individual step is done or reset |
| Change plan status | `update_plan_status(name, status)` | Status change with pending-step validation |
| Add a history entry | `append_history(name, change)` | After any significant action |
| Set a frontmatter field | `set_plan_field(name, field, value)` | Change assignee, priority, etc. |
| Full structural rewrite | `write_plan(name, content)` | Add/remove sections; validates lifecycle rules |
| Read plan fresh | `get_plan(name)` | Always read fresh before any mutation |

---

<agent-instructions mode="inline" triggers="update plan,mark step done,mark step complete,plan step,set field,change status,edit plan,modify plan,update step,plan mutation,write plan">

## Scenario 1 — Mark a step done or pending

**Read first:**
```
get_plan("<plan-name>")
```

**Then update the step:**
```
update_step("<plan-name>", "<exact text from the step description column>", "done")
```

Use `"pending"` to reset a step back to ⏳. The `match` parameter is a
substring of the step description — it does not need to be the full text, but
it must be unique enough to match exactly one row.

---

## Scenario 2 — Change plan status

Allowed values: `approved`, `in_progress`, `completed`, `canceled`.

**Read first, then:**
```
update_plan_status("<plan-name>", "in_progress")
```

For `completed`: the tool will reject the call if any Implementation Steps rows
are still pending. Self-check first — list pending steps, call `update_step`
for each, then retry `update_plan_status`. See the [Plan Completion SOP](plan-completion.md)
for the full completion flow.

---

## Scenario 3 — Add a Document History row

```
append_history("<plan-name>", "Description of what changed and why")
```

Always append after a status change or significant structural edit.

---

## Scenario 4 — Set a single frontmatter field

```
set_plan_field("<plan-name>", "assigned_to", "NetYeti")
```

The following fields are restricted and cannot be set via this tool
(they are controlled by transition tools):
`status`, `gate_status`, `approved`, `completed_steps`, `total_steps`.

---

## Scenario 5 — Full structural rewrite

Use `write_plan` only when you need to add or remove entire sections, or when
multiple fields need to change in a single atomic write. It applies the same
lifecycle validation as `update_plan_status`.

```
write_plan("<plan-name>", "<complete new content>")
```

⚠ Risk: full rewrites are more likely to lose content than targeted tools.
Prefer targeted tools whenever possible. Use `write_plan` for structural changes
only.

---

## Scenario 6 — Complete a plan

Follow the [Plan Completion SOP](plan-completion.md) exactly. Summary:

1. `get_plan(name)` — read fresh
2. Verify all Implementation Steps show ✅ — list any ⏳ and stop if found
3. `update_plan_status(name, "completed")` — validates pending steps
4. `append_history(name, "Plan marked complete — all steps verified")`
5. `transition_to_completed(name)` — archives, generates doc

Never skip step 2. Never write `status: completed` directly.

</agent-instructions>

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — comprehensive plan-mutation SOP; consolidates all mutation scenarios; supersedes ad-hoc guidance scattered across AGENTS.md and docs/ai-governance-enforcement.md | NetYeti |
