---
title: "Plan: Bugs, Features, and Thoughts — Typed Proposal Intake System"
status: approved
author: NetYeti
created: 2026-06-07
created_by: NetYeti@phoenix
tags: [planning]
proposal_source: proposals/bugs-features-and-thoughts.md
priority: medium
automated: off
waiting_reason:
assigned_to: NetYeti
related_to: []
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:
cancellation_reason:
template_version: "1.0"
tests_defined: false
gate_reviewer:
gate_status:
gate_date:
gate_note:
gate_reviews: []
gate_quorum: 1
total_steps: 1
completed_steps: 0
---

# Plan: Bugs, Features, and Thoughts — Typed Proposal Intake System

## Mode

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

Implements typed proposal intake — feature, bug, thought — with description-first
creation flow and AI-generated titles. Adds category to frontmatter schema, updates
templates, and modifies the "New..." creation flow to prompt for type and description
before generating a title via the AI engine.

See [[proposals/bugs-features-and-thoughts.md]] for full specification.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan



## Rollback Procedures

All changes are additive to the proposal creation flow. Removing the category prompt
from the creation dialog restores prior behaviour.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI title generation is slow | Medium | Minor friction | Show inline loading; allow manual override |
| Category list grows uncontrolled | Low | Medium | Categories defined by governance maintainers only (per proposal Out of Scope) |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-07 | Created from approved proposal | NetYeti |
| 2026-06-07 | Restored after accidental overwrite during API testing | NetYeti |
