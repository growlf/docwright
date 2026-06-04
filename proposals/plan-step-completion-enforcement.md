---
complexity: medium
title: "Plan Step Completion Enforcement"
author: NetYeti
created: 2026-06-04
tags:
  - governance
  - plans
  - lifecycle
  - enforcement
  - dog-fooding
approved: false
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/phase-gate-sign-off.md
  - proposals/built-in-deferred-idea-capture.md
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

### 1. Pre-commit hook validation

When a plan file is staged for commit, `scripts/gate-check.ts` (the lifecycle
gate script) also checks:

- If a task section is marked `✅ Complete`, does it still have step rows
  with `⏳ Pending`?
- If yes: warn with a clear message and block the commit:

```
⚠  plans/phase-1-ui-polish.md — Task 2 marked complete but 7 step rows
   still show ⏳ Pending. Update the step table before committing.
   (Use --no-verify to bypass if steps are intentionally omitted.)
```

The check uses a simple heuristic: look for `✅` in the task header line and
`⏳` in the lines immediately following it within the same section.

### 2. AI instruction

The AI assistant's working instructions (CLAUDE.md / this feedback memory)
should explicitly state: **when marking a task complete, update all step rows
in its table in the same edit.**

### 3. Plan template reminder

Add a note to `templates/plan-template.md`:

```markdown
> When marking a task ✅ Complete, update every step row in its table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.
```

### 4. Future: step status field (Phase 3)

In Phase 3, when plan step data moves into structured frontmatter
(not just markdown tables), step status could be tracked programmatically
and validated automatically by the dispatch module.

## Dog-fooding note

DocWright manages DocWright's own development. Stale plan steps in
DocWright's own plans are the highest-visibility example of this gap.
The enforcement should be implemented before Phase 2 begins.

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| Auto-updating step rows from git diff | Complex heuristic; human review of steps is better | Post-launch |
| Step-level frontmatter (machine-readable) | Phase 3 dispatch work | Post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — discovered during Phase 1 UI Polish plan review | NetYeti |
