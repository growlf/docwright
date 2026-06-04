---
complexity: medium
title: "Plan Test Certification — tests_defined and tests_passed Checkboxes"
author: NetYeti
created: 2026-06-04
tags:
  - governance
  - plans
  - testing
  - enforcement
  - phase-1
category:
  - governance
approved: false
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/plan-step-completion-enforcement.md
  - proposals/plan-complete-blocks-on-pending-steps.md
  - policies/core/ai-governance-boundaries.md
  - proposals/skill-plan-critique.md
---

## Problem

Plans can be marked complete without any evidence that the work was verified.
The existing `## Testing Plan` section in the plan template is decorative — it
is not enforced and gets skipped under deadline pressure. The result is plans
that "complete" while requirements may be unmet and bugs undetected.

Additionally, the AI governance incident (June 2026) demonstrated that
self-completion without human verification is a real risk. If completion
required human certification of actual test results, accidental or improper
completion becomes meaningfully harder.

## Proposed Solution

Add two boolean fields to every plan's frontmatter:

```yaml
tests_defined: false   # human certifies: test suite covers all requirements
tests_passed: false    # human certifies: all tests have run and passed
```

**How they work:**

Both fields render as checkboxes in the PropertiesPane (boolean fields already
do this — no new UI code needed). Only a human can check them, via the Web UI.
The pre-commit hook blocks `status: completed` unless both are `true`.
The hook treats setting either field to `true` like `approved: true` on
proposals — requires `HUMAN_APPROVED=1`, blocking terminal commits.

**The critique tool connection:**

When `/critique-plan` runs on a plan with `tests_defined: false`, it does not
just flag the gap — it generates a concrete test suite as part of its output:

```markdown
## Tests

| # | Test | Verifies | How to run | Expected result |
|---|------|----------|-----------|-----------------|
| 1 | Hook blocks pending steps | Deliverable 2 | node test/hooks/test-pending-steps.js | All 9 cases pass |
```

The human reviews, edits for adequacy, then checks `tests_defined: true` in the
Web UI. The critique tool generates; the human certifies.

**Completion flow:**

1. Plan created → both fields `false`
2. `/critique-plan` generates test suite → human reviews → checks `tests_defined`
3. Implementation proceeds; tests run
4. Human verifies results → checks `tests_passed`
5. Human clicks Complete button in Web UI
6. Hook validates: both `true` + gate approved → allows completion

---

## Critical Review — Applied Before Approval

*This proposal critiques itself using the /critique-plan standard.*

### Rubber stamp without genuine review ⚠️ warn
- **Finding:** A human under deadline pressure can click both boxes without
  writing real tests or verifying results. The checkbox certifies intent, not
  quality.
- **Action:** Structural mitigation: tests must name concrete commands and exact
  expected outputs. Vague tests ("system works correctly") are rejected by the
  critique tool. The certification tooltip reads: *"This test suite would catch
  regressions if the implementation were wrong."* Cannot fully eliminate bad-faith
  use — this is the honest limit of any human certification system.
- **Resolution:** Accepted with structural mitigation. Specificity requirement
  documented in plan template and enforced by critique tool output format.

### AI generates tests, AI runs tests, human clicks box ⚠️ warn
- **Finding:** If the critique tool generates the test suite and AI reports
  results, the human is certifying AI output without independent verification.
- **Action:** The `tests_defined` standard is *adequacy*, not *existence*. Tooltip
  makes this explicit. AI-generated tests are a starting point; the human certifies
  they would catch regressions. Critique tool must state which requirement each
  generated test verifies.
- **Resolution:** Accepted. Certification standard documented in PropertiesPane
  tooltip and plan template. Critique tool output format specifies requirement
  mapping per test.

### `tests_defined` goes stale as implementation evolves ⚠️ warn
- **Finding:** Tests certified early may test the wrong thing after scope changes.
  No re-certification trigger.
- **Action:** `/critique-plan` on a plan with `tests_defined: true` counts
  deliverable rows vs test rows. If deliverables > tests, flags staleness warning.
  Unchecking `tests_defined` automatically unchecks `tests_passed` (resolved in
  design decisions above).
- **Resolution:** Resolved — staleness detection built into critique tool;
  `tests_defined → false` cascades to `tests_passed → false`.

### All-or-nothing masks partial failures ⚠️ warn
- **Finding:** One checkbox for a multi-deliverable plan allows "close enough"
  certification when some tests fail.
- **Action:** The `## Tests` table has a Status column per test row. The critique
  tool, when `tests_passed: true` is set, scans the tests table and flags any
  non-✅ rows as a contradiction. Documented expectation: ALL rows ✅ before
  checking.
- **Resolution:** Resolved — test table Status column provides granularity;
  critique tool validates consistency between field and table.

### Undefined for non-code deliverables ⚠️ warn
- **Finding:** "Tests" has no clear meaning for documentation, policies, brand
  assets.
- **Action:** Resolved in design decisions above — required on ALL plans, with
  acceptance criteria valid for non-code deliverables. Plan template documents
  both patterns with examples.
- **Resolution:** Resolved — required universally; acceptance criteria are
  legitimate test rows.

### The existing Testing Plan section was already ignored 📝 note
- **Finding:** The old `## Testing Plan` section became decorative.
- **Action:** Hook enforcement is the structural difference — the old section had
  none. The new `## Tests` section is tied to a boolean field the hook checks.
  Renaming it from "Testing Plan" to "Tests" also signals it is an artifact that
  must be populated, not a plan for future work.
- **Resolution:** Accepted. Hook enforcement + field naming creates structural
  difference from the ignored predecessor.

### Does not fully solve AI governance ⚠️ warn
- **Finding:** Checkboxes require `HUMAN_APPROVED=1` to set in terminal commits —
  same behavioral gap as before.
- **Action:** Explicitly out of scope. This proposal addresses quality gates.
  Authorization model is addressed in [[policies/core/ai-governance-boundaries.md]].
  Both are necessary; neither replaces the other.
- **Resolution:** Accepted as out of scope. Tracked separately.

---

## Resolved Design Decisions

**Required on ALL plans** — yes, without exception. Plans whose deliverables
are non-code (documentation, policy, brand assets) use *acceptance criteria*
in the Tests table rather than executable tests. "CONTRIBUTING.md reviewed by
a second reader and found complete" is a valid test row. The alternative
(code-only requirement) creates an escape hatch that will be used.

**Unchecking `tests_defined` automatically re-locks `tests_passed`** — yes.
If the test suite changes enough to uncheck `tests_defined`, previously-certified
results are no longer valid against the new test suite. The PropertiesPane
should automatically set `tests_passed: false` when `tests_defined` changes from
`true` to `false`. This is enforced in the UI and by the hook.

**Critique tool checks staleness on already-defined plans** — yes. When
`/critique-plan` runs on a plan with `tests_defined: true`, it counts
deliverable table rows and test table rows. If deliverables > tests, it flags
a staleness warning. Cheap to implement; catches the most common failure mode
(new deliverable added without a corresponding test).

## Certification standard for `tests_defined`

The human is certifying: *"This test suite would catch regressions if the
implementation were wrong."* Not just "tests exist." The PropertiesPane checkbox
tooltip must show this full statement so clicking is a deliberate act with
visible meaning. The critique tool, when generating tests, must name the
specific requirement each test verifies.

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Per-test granularity (each test has its own status field) | Complex; the table Status column gives enough visibility |
| CI-automated test_passed setting | User specified human-only; CI results inform the human's judgment |
| Mandatory peer review of test suite | Good idea; belongs in multi-perspective review proposal |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — proposed after AI governance incident; includes self-critique | NetYeti |
| 2026-06-04 | All open questions resolved; all critique findings addressed; ready for approval | NetYeti |
