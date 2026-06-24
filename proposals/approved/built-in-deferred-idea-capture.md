---
complexity: high
title: Built-in Deferred Idea Capture
author: NetYeti
created: 2026-06-03
tags:
  - governance
  - workflow
  - templates
  - dispatch
  - ai
  - dog-fooding
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - policies/core/capture-deferred-ideas.md
  - proposals/approved/phase-gate-sign-off.md
_path: proposals/built-in-deferred-idea-capture.md
consumed_by: plans/completed/enforce-lifecycle-compliance.md
---

## Problem

Good ideas that arise during implementation — but are out of scope for the
current work — are routinely lost. They get noted in a comment, a chat message,
or a mental footnote, and are gone by the time they would have been relevant.

DocWright is a governance layer. It should make capturing these ideas the path
of least resistance, not an extra step that requires discipline to remember.

This proposal was itself triggered by discovering a backlog of uncaptured
deferred ideas across all of DocWright's completed Phase 1 plans and approved
proposals. The practice works; it just needs to be built in rather than relied
on as habit.

## Proposed Solution

Make deferred idea capture automatic at every natural closing point in the
workflow: plan completion, proposal approval, and phase gate sign-off.

### 1. Template changes

All plan and proposal templates gain an "## Out of Scope" section:

```markdown
## Out of Scope

List any ideas that arose during this work but are outside its scope.
Each item becomes a deferred proposal — capture the idea and the context
so it is never lost.

| Idea | Why deferred | Depends on |
|------|-------------|------------|
|      |             |            |
```

When the section is non-empty at closing time, DocWright (or the AI agent)
creates deferred proposals for each row before allowing the document to close.

### 2. Pre-commit hook integration

`scripts/gate-check.ts` (from the lifecycle gate proposal) is extended to
also check for non-empty "Out of Scope" sections in plans or proposals that
are being transitioned to `completed` or `approved`. If any rows are present
without a corresponding deferred proposal, the commit is blocked with a prompt:

```
⚠  plan/phase-1-ui-polish.md has 2 uncaptured out-of-scope items.
   Create deferred proposals before closing, or mark each row [captured].
```

### 3. Phase gate integration

The gate reviewer prompt (from the lifecycle gate proposal) includes an
explicit question before sign-off:

> "Did anything come up during this phase that you are setting aside?
> If so, describe it briefly — DocWright will create a deferred proposal."

The reviewer can answer inline. The gate does not require a response (ideas
are optional) but the prompt ensures the question is always asked.

### 4. AI agent instructions

All bundled `opencode-instructions.md` files are updated to instruct the AI:

- When working on a plan, note any ideas that surface that are out of scope
  for the current work
- When a plan or proposal is being closed, ask: "Is there anything we touched
  on that you want to set aside for later?"
- Draft deferred proposals for anything the contributor identifies

The AI does not create deferred proposals silently — it drafts them and asks
for confirmation, so the contributor controls what is captured.

### 5. Status page visibility

The existing **Deferred** section on the Vault Status page already shows
deferred proposals. No changes needed there — the visibility is already built
in once proposals exist.

## Scope

- Plan and proposal templates: add "## Out of Scope" section with table
- `scripts/gate-check.ts`: extend to detect uncaptured out-of-scope rows
- Phase gate prompt: add deferred-idea question to reviewer flow
- All bundled `opencode-instructions.md` files: add deferred-idea capture
  instructions
- `profile.json` for all bundled profiles: add `capture_deferred_ideas: true`
  feature flag (allows profiles to opt out for lightweight use cases)

## Out of Scope

| Idea | Why deferred | Depends on |
|------|-------------|------------|
| Automatic deferred proposal creation from Out of Scope rows (no human confirmation) | Human should control what is captured; AI drafts, human confirms | Base implementation stable |
| Deferred idea expiry / staleness detection | Nice-to-have; deferred proposals are cheap to keep | Post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created | NetYeti |
