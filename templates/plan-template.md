---
title: "{{VALUE:title}}"
status: draft
author: "{{VALUE:author}}"
created: "{{DATE:YYYY-MM-DD}}"
created_by: "{{VALUE:created_by}}"
tags: [{{VALUE:tags}}]
proposal_source: "{{VALUE:proposal_source}}"
priority: {{VALUE:priority}}
automated: off  # off | guided | full — see Plan Modes below
waiting_reason:  # Populated when status = waiting-for-user
assigned_to: ["{{VALUE:assigned_to}}"]
related_to: []
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:  # Populated when plan is canceled
cancellation_reason:  # Populated when plan is canceled
template_version: "1.0"
tests_defined: false  # Set to true after confirming test coverage is adequate — required before plan can be completed
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
---

# {{VALUE:title}}

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

{{VALUE:overview}}

## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan

{{VALUE:testing}}

## Rollback Procedures

{{VALUE:rollback}}

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Document History

| Date | Change | Author |
|------|--------|--------|
| {{DATE:YYYY-MM-DD}} | Created | {{VALUE:author}} |
