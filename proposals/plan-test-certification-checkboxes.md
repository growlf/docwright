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
  quality. This is the "sign here that you read the ToS" problem — technically
  compliant, substantively empty.
- **Action:** Accept as a known human-factors limitation. The checkbox raises
  the bar even if it cannot eliminate bad-faith use. Pair with the multi-
  perspective review policy — a second person reviewing tests provides
  independent verification the boxes can't fake.
- **Resolution:**

### AI generates tests, AI runs tests, human clicks box ⚠️ warn
- **Finding:** If the critique tool generates the test suite and AI reports
  results, the human is certifying AI output without independent verification.
  AI could write tests optimized to pass trivially. The human has no way to
  detect this without deep technical review.
- **Action:** The `tests_defined` certification specifically covers adequacy
  ("these tests would actually catch regressions if the implementation were
  wrong"). Documenting this expectation in the checkbox tooltip and in the
  plan template reminder makes the standard explicit. AI-generated tests should
  be treated as a starting point, not a final answer.
- **Resolution:**

### `tests_defined` goes stale as implementation evolves ⚠️ warn
- **Finding:** Tests are defined and certified early. When implementation
  diverges from the plan — scope changes, technical decisions shift — the
  original tests may test the wrong thing, but `tests_defined: true` is
  already checked. No re-certification trigger exists.
- **Action:** Add a convention: if a plan's deliverable table changes
  substantially after `tests_defined` is checked, the field should be reset
  to `false` and re-certified. The critique tool, when run on a plan with
  `tests_defined: true`, should check whether the test table still matches
  the deliverable table.
- **Resolution:**

### All-or-nothing masks partial failures ⚠️ warn
- **Finding:** One `tests_passed` checkbox for a seven-deliverable plan means
  someone can check it when six of seven pass and one is "close enough." No
  granularity, no accountability for which tests failed.
- **Action:** The `## Tests` table includes a Status column per test. The
  certification ("tests_passed: true") is a human judgment call based on that
  table. Documented expectation: all rows should show ✅ Pass before checking.
  This is still a human judgment, but the table makes the partial pass visible
  to any reviewer.
- **Resolution:**

### Undefined for non-code deliverables ⚠️ warn
- **Finding:** Documentation, policy documents, brand assets — "tests" has no
  clear meaning. What does `tests_defined: true` mean for "write CONTRIBUTING.md"?
  Plans that block on this field for subjective deliverables add friction
  without adding value.
- **Action:** For plans with no automatable tests, the test suite is acceptance
  criteria ("CONTRIBUTING.md reviewed by a second person and found complete").
  The field stays but its meaning adapts. The `## Tests` table can contain
  review criteria, not just executable tests. This must be documented in the
  plan template.
- **Resolution:**

### The existing Testing Plan section was already ignored 📝 note
- **Finding:** We already had `## Testing Plan` in the plan template. It became
  decorative. Adding checkboxes risks the same fate if the culture around them
  isn't different.
- **Action:** The checkboxes are hook-enforced (unlike the template section),
  which is the structural difference. But cultural expectation must be set: these
  are not boxes to click to unblock a commit; they are certifications with real
  meaning.
- **Resolution:**

### Does not fully solve AI governance ⚠️ warn
- **Finding:** The hook blocks `tests_passed: true` in terminal commits without
  `HUMAN_APPROVED=1`. But the AI governance problem is still a behavioral rule
  about the AI not using HUMAN_APPROVED=1. The same gap that existed for
  `status: completed` exists here for the checkbox fields.
- **Action:** This proposal improves quality gates, not the authorization model.
  The authorization model (AI proposes, human executes governance commits via
  Web UI only) is a separate concern being addressed in
  [[policies/core/ai-governance-boundaries.md]]. Both are needed; neither
  replaces the other.
- **Resolution:**

---

## Open Questions Before Approval

1. Should `tests_defined` and `tests_passed` be required on ALL plans, or only
   plans with code deliverables? (Current proposal: all plans, with acceptance
   criteria allowed for non-code deliverables.)

2. Should unchecking `tests_defined` re-lock `tests_passed` automatically?
   (If the test suite changes, previously-passed tests may no longer be valid.)

3. Should the critique tool re-check `tests_defined` for staleness when
   deliverables have changed since the field was set?

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
