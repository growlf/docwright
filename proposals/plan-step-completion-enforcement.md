---
complexity: medium
title: Plan Step Completion Enforcement
author: NetYeti
created: 2026-06-04
tags:
  - governance
  - plans
  - lifecycle
  - enforcement
  - phase-1
  - dog-fooding
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/phase-gate-sign-off.md
  - proposals/built-in-deferred-idea-capture.md
_path: proposals/plan-step-completion-enforcement.md
---

## Problem

When a plan task is marked `✅ Complete`, the implementation step rows in its
table are not automatically updated — they remain as `⏳ Pending`. A developer
reading the plan sees completed tasks with all steps still pending, which is
misleading and undermines trust in the governance documents.

This was discovered in the Phase 1 UI Polish plan: all 4 tasks were marked
complete but 15+ step rows still showed ⏳ Pending. The plan looked like it
described unfinished work.

This is a governance failure. Plans are audit records. If the steps don't
reflect what was actually built, the record is wrong.

## Proposed Solution

### 1. Structured step frontmatter (replace emoji heuristic)

Instead of parsing emoji from markdown tables, add a `steps` field to plan
frontmatter — a structured YAML list with explicit status per step:

```yaml
steps:
  - id: 1
    action: "Panel.svelte created — side, collapse, overlay, scrim"
    status: done
  - id: 2
    action: "Left sidebar refactored to <Panel side=\"left\">"
    status: done
  - id: 3
    action: "Right panel moved to layout level"
    status: pending
```

This makes step status:
- **Machine-readable** — validated by JSON Schema (existing linter), no emoji parsing
- **Queryable** across plans  — "show me all plans with pending steps"
- **Enforceable at the schema level** — hook checks frontmatter fields, not markdown
- **Immutable to AI bypass** — the pre-commit hook already validates frontmatter schema;
  adding `steps` as a required field means the hook catches stale status without
  a new heuristic

The markdown step table in the body becomes a **rendered view** of the
frontmatter data, not the source of truth. Plan templates get a comment:

```markdown
<!-- steps are defined in frontmatter; update status there, not in this table -->
```

### 2. Migration script

`scripts/migrate-plan-steps.sh` — one-time script that:

1. Finds all plans with markdown step tables
2. Extracts the step rows (id, action, status emoji)
3. Appends a `steps:` block to the frontmatter
4. Replaces the markdown table with a `<!-- generated -->` comment
5. Runs `npm run lint` to validate the new frontmatter

Existing plans are migrated in-place, not deferred.

### 3. Linter rule (dispatch module)

Add a rule to `src/dispatch/linter.ts`:

```
rule: plan-step-completion
check: for each task with status: completed, all steps must be status: done
severity: error
```

This is the same validation the emoji heuristic was trying to do, but at
the data level instead of markdown parsing. The linter already integrates
with the pre-commit hook and properties pane.

### 4. AI instruction

When marking a task complete, the AI must:
1. Set `task.status: completed` in the frontmatter
2. Set `step.status: done` for all steps in that task
3. Update the rendered markdown table to match

This is enforced by the linter at commit time. No separate emoji check needed.

### 5. Plan template update

Replace the emoji-reminder note with a structured frontmatter example in
`templates/plan-template.md` showing the `steps:` block format.

## Dog-fooding note

DocWright manages DocWright's own development. Stale plan steps in
DocWright's own plans are the highest-visibility example of this gap.
The enforcement should be implemented before Phase 2 begins.

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| Auto-updating step rows from git diff | Complex heuristic; human review of steps is better | Post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — discovered during Phase 1 UI Polish plan review | NetYeti |
| 2026-06-04 | Revised: emoji heuristic → structured frontmatter steps field; migration script; linter rule; Phase 3 deferral eliminated | NetYeti |
