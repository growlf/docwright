---
title: "Automated Test Lifecycle — AI generates and certifies tests on every plan mutation"
author: NetYeti
created: 2026-06-06
tags:
  - governance
  - testing
  - ai
  - lifecycle
  - automation
  - phase-2
complexity: high
estimated_effort: L
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
related_to:
  - plans/lifecycle-gates-extension-bundle.md
  - proposals/approved/plan-test-certification-checkboxes.md
  - proposals/split-agent-governance.md
---

## Problem

`tests_defined` is currently a one-time human checkbox. Once set, it stays true
even as a plan evolves — new steps are added, implementations change, and the
test suite drifts out of sync silently. The human who set `tests_defined: true`
may have reviewed a very different plan than the one that ships.

More fundamentally: writing tests is currently a manual, forgettable step. The
AI that implements features should also generate their tests. The human should
review and certify — not author from scratch.

## Proposed Solution

Make `tests_defined` a living status, automatically maintained by the lifecycle:

### Rule 1 — Reset on mutation
Any mutation to a plan's Implementation Steps section (via `update_step`,
`write_plan`, or `update_plan_status`) resets `tests_defined: false`.
Rationale: a changed plan has changed coverage requirements.

### Rule 2 — AI generates tests on step completion
When a step is marked `✅ Done`, the orchestrator dispatches an AI task:
- Identify what was implemented (files changed, functions added)
- Generate or update tests covering the new implementation
- Write the tests to the appropriate test file
- Report coverage gaps if any exist

### Rule 3 — AI verifies coverage and auto-certifies
After test generation, the AI:
- Runs the test suite
- Analyses coverage against all completed steps
- If full coverage: sets `tests_defined: true` automatically
- If a gap exists but is untestable (UI-only, LLM output, external service):
  records the blocker in `gate_note` and leaves `tests_defined: false`
- If tests fail: leaves `tests_defined: false` and records failure reason

### Rule 4 — Human first-review gate
The first time a plan's tests are AI-generated, `tests_defined` is set to
`false` until a human explicitly reviews and clicks "Certify tests" in the
properties pane. This is the human's confirmation that the AI-generated suite
is adequate. After initial certification, subsequent AI cycles can auto-certify.

### Rule 5 — Blocker handling
If AI cannot generate a test (UI interaction, LLM response, external API),
it records a blocker note: `gate_note: "Tests for step N require UI/LLM — manual
verification needed"`. The plan remains at `tests_defined: false` until a human
certifies, with the blocker note giving them the context.

## Implementation Approach

### Phase A — MCP mutation hook
Extend `update_step`, `write_plan` to reset `tests_defined: false` when an
Implementation Steps row changes from any status to ✅ or when a new step is
added. Status-only changes (e.g. `in-progress → completed`) do NOT reset since
no new code was written.

### Phase B — AI test generation dispatch
Extend the orchestrator role (from [[proposals/split-agent-governance.md]]) with
a `test-generation` task type:
```
POST /api/generate-tests
{
  "plan": "lifecycle-gates-extension-bundle",
  "step": "End-to-end test coverage",
  "changed_files": ["src/dispatch/gates.ts", "src/dispatch/ai.ts"]
}
```
The orchestrator spawns a code agent (no governance context) to write tests.
Returns: `{ coverage: "full" | "partial" | "blocked", blockers: string[] }`

### Phase C — Coverage analysis and auto-certification
After test generation, the MCP server:
1. Runs `npm run test:dispatch` (or the relevant test suite)
2. If all pass AND coverage is "full": `set_plan_field("tests_defined", "true")`
3. If blocked: `append_history` with blocker note, leaves `tests_defined: false`
4. If tests fail: `append_history` with failure output, `tests_defined: false`

### Phase D — Human-first-review flag
Add `tests_human_reviewed: false` to plan frontmatter on creation.
First AI auto-certify requires human to click "Certify tests" first.
After that, AI auto-certify is allowed.

## Relationship to Existing Work

- [[plans/lifecycle-gates-extension-bundle.md]] — Phase 3 (AI-assisted gate
  prep) provides the LLM scaffolding this builds on. This proposal takes AI
  participation one step further: AI writes tests, not just gate summaries.
- [[proposals/approved/plan-test-certification-checkboxes.md]] — Defined the
  `tests_defined` field and the "single checkbox" design. This proposal evolves
  it to a living automated status.
- [[proposals/split-agent-governance.md]] — The orchestrator/code-agent split
  is required for Phase B: test generation must run as a code agent with no
  governance context access.

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Test quality scoring (mutation testing, coverage %) | Phase 3+ — start with pass/fail |
| Multi-language test generation (Python MCP tests) | Phase 3 — TypeScript dispatch first |
| UI component tests (Playwright/Cypress) | Phase 3 — framework decision needed |
| Automatic test repair when tests break | Post-launch — requires careful AI boundaries |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-06 | Created — captured during lifecycle-gates plan closure | NetYeti |
