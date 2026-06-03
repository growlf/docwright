---
title: Test cycle option for code-based plans
author: NetYeti
created: 2026-06-02
tags:
  - engine
  - policy
  - testing
  - tdd
approved: true
deferred: true
deferred_to: phase-2
created_by: NetYeti@phoenix
assigned_to: ""
---
## Problem

When working on a code or engineering plan there needs to be policy and
enforcement for test-driven development — ensuring a clean, secure foundation
for all generated artifacts as work progresses, not as an afterthought.
Without this, AI-assisted code generation in particular can produce plausible-
looking output that lacks proper test coverage and fails silently.

## Proposed Solution

Add a `test_cycle` block to the plan frontmatter schema for code/engineering
plans. When present, it signals that TDD is required and surfaces verification
checkpoints in the UI.

```yaml
test_cycle:
  required: true          # enforced by pre-commit on plans with type: engineering
  strategy: unit+integration  # unit | integration | e2e | unit+integration | full
  coverage_target: 80     # minimum % — enforced by CI, not the hook
  frameworks: []          # e.g. [vitest, playwright]
```

**Pre-commit enforcement (Phase 2):**
- Plans with `type: engineering` or `type: code` and `status: approved|in-progress`
  must have `test_cycle.required: true` or an explicit `test_cycle.required: false`
  with a `test_cycle.exemption_reason`.
- Missing `test_cycle` block on an engineering plan is a pre-commit error (not warning).

**UI integration (Phase 2):**
- Properties pane shows a "Test Cycle" section for engineering plans.
- Plan view displays a test-cycle checklist inline: write test → implement →
  verify → repeat. Each task in the plan can be linked to a test file.
- Status page shows plans with failing or absent test cycles as warnings.

**AI agent instruction:**
- When helping implement an engineering plan, the AI must write tests before
  or alongside implementation code, never after.
- If asked to skip tests, the AI must note the policy violation and propose
  an exemption path rather than silently complying.

## Deferral note

This requires the dispatch module (Phase 2) for pre-commit schema validation
and the properties pane (plans/properties-pane.md) for UI integration.
Approve and build after both prerequisites are in place.
The `bugs-before-features` policy and core philosophy already establish the
intent; this proposal formalises the mechanism.
