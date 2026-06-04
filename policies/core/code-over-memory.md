---
title: "Code Over Memory — Automate Process Enforcement"
status: active
author: NetYeti
created: 2026-06-04
tags:
  - core
  - governance
  - automation
  - enforcement
gate_reviewer: NetYeti
gate_status: approved
gate_date: 2026-06-04
---

# Code Over Memory — Automate Process Enforcement

## Policy

When a process rule, quality check, or workflow step can be enforced by code
or infrastructure, it MUST be. Relying on AI memory, human discipline, or
documentation reminders to enforce a process is a known failure mode.

Every time a rule is written down in a README, captured in an AI's memory, or
added as a "reminder" comment in a template, ask: **can this be a pre-commit
hook, a CI check, an MCP tool, a dispatch validation, or a UI constraint?**
If yes — do it. Document the rule too, but code is the enforcement mechanism.

## Why this matters

- AI memory is imperfect and session-scoped. A rule in memory that isn't
  checked by code will eventually be missed.
- Human discipline is also imperfect. The best processes are the ones that
  are hard to violate accidentally.
- Code runs every time. It doesn't forget, get distracted, or assume
  something was already done.
- DocWright is a governance layer. Governance that requires discipline to
  enforce is governance in name only.

## The question to ask constantly

> "Can I enforce this with code? Is it feasible and viable to do so?"

If yes: implement it — even if it takes longer than writing a reminder.
If no: document it clearly, and add it to the deferred backlog to revisit
when feasibility improves.

## Where to look first

Before adding a behavioral reminder, check whether enforcement belongs in:

| Mechanism | Good for |
|-----------|----------|
| **Pre-commit hook** (`scripts/`) | Frontmatter validation, step table consistency, lifecycle rule checking, commit message format |
| **MCP tool** | AI-callable governance checks — lifecycle transitions, gate status, schema validation |
| **Dispatch module** (`src/dispatch/`) | Programmatic plan/proposal validation, status transition rules, backlink integrity |
| **UI constraint** | Disable buttons that would create invalid state; warn before destructive actions |
| **CI check** (`.github/workflows/`) | Cross-document consistency, broken wikilinks, orphaned references |
| **Phase gate** | Human checkpoint before phase transition — but the gate itself is enforced by code |

## Examples from DocWright's own development

- **Lifecycle compliance**: proposals require `approved: true` before a plan
  can reference them — enforced by pre-commit hook, not documentation.
- **Self-approval prevention**: AI cannot set `approved: true` — enforced by
  pre-commit hook checking the commit environment.
- **Plan step completeness**: tasks marked ✅ Complete with ⏳ Pending steps
  is a contradiction — should be caught by pre-commit hook
  (see [[proposals/plan-step-completion-enforcement.md]]).
- **Deferred idea capture**: "Out of Scope" rows without matching proposals
  — should be caught by pre-commit hook
  (see [[proposals/built-in-deferred-idea-capture.md]]).
- **Phase gates**: phase completion without sign-off — enforced by hook
  (see [[proposals/phase-gate-sign-off.md]]).

## AI memory as fallback, not primary

AI memory (this project's memory files) captures behavioral guidelines for
cases where code enforcement is not yet implemented or not feasible. It is a
**fallback** and a **development aid** — not the primary enforcement mechanism.

When a rule moves from memory to code: keep the memory entry (it explains
the why), but note that code now enforces it. The memory is then documentation,
not the guard.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — distilled from plan-step-completion gap and general development practice | NetYeti |
