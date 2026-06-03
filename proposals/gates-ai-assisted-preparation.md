---
complexity: low
title: "Lifecycle Gates — AI-Assisted Gate Preparation"
author: NetYeti
created: 2026-06-03
tags:
  - governance
  - gates
  - ai
  - improvements
approved: false
deferred: true
deferred_reason: "Depends on base gate mechanism (see proposals/phase-gate-sign-off.md). Revisit after launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/phase-gate-sign-off.md
---

## Problem

The base gate mechanism always requires a human decision. But arriving at that
decision can be work-intensive: the reviewer must survey everything in scope,
identify gaps, and formulate their verdict. For large phases or complex policy
reviews, the preparation itself is a barrier that causes gates to be waived
rather than properly reviewed.

## Proposed Solution

AI-assisted gate preparation: before the gate is presented to the reviewer,
an AI agent surveys the scope, drafts a readiness summary, and surfaces any
potential gaps — so the human can make an informed decision quickly rather
than doing the survey themselves.

The gate flow becomes:

1. Gate fires (phase complete, transition attempted, etc.)
2. AI agent runs a pre-review: reads all documents in scope, checks for
   incomplete items, flags inconsistencies, drafts a "ready for sign-off?"
   summary with specific concerns highlighted
3. Reviewer receives the AI summary alongside the Approve / Critique / Waive
   options
4. Human makes the final call — the AI prepares, never decides

This keeps gates always human-confirmed while dramatically reducing the
effort cost of a thorough review. The AI summary is stored in `gate_note`
alongside the reviewer's decision for audit purposes.

The `opencode-instructions.md` for each profile would define what the AI
should check during pre-review for each gate type.

## Deferred Because

Base gate mechanism must be stable. AI-assisted preparation requires the
dispatch module's LLM integration to be mature.
See [[proposals/phase-gate-sign-off.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from base gate proposal out-of-scope | NetYeti |
