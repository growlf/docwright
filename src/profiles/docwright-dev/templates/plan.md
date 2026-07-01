---
title: "{{TITLE}}"
status: draft
author: {{AUTHOR}}
author-role: contributor
created: {{DATE}}
created_by: "{{AUTHOR}}@{{HOST}}"
proposal_source: ""
priority: medium
phase:
mode: guided
assigned_to: {{AUTHOR}}
tests_defined: false
tests_human_reviewed: false
template_version: "1.0"
total_steps: 0
completed_steps: 0
---

> **Execution plan for an approved proposal.** `proposal_source:` must point to an approved
> proposal before implementation begins. Stays `draft` until a human approves the plan
> content; AI never sets `approved`/`completed`/gate fields.

## Overview

What this plan delivers and how it maps to its proposal.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 |  |  | ⏳ Pending |

## Testing Plan

### Step Verification
- [ ] Step 1 — …

### Integration & Regression
- [ ] Existing `npm run test` suite passes.
- [ ] TypeScript compiles cleanly; dispatch retains zero VS Code API deps.

### Gate Criteria
- [ ] All steps delivered or formally deferred (captured as proposals/code-issues).
- [ ] Tests defined and human-reviewed.

## Rollback Procedures

How to revert each step (branch/PR revert; additive-only where possible).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
|  |  |  |  |

## Document History

| Date | Change | Author |
|------|--------|--------|
| {{DATE}} | Created from approved proposal | {{AUTHOR}} |
