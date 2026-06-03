---
complexity: low
title: "AI-Assisted Synthesis of Multiple Perspectives"
author: NetYeti
created: 2026-06-03
tags:
  - ai
  - review
  - synthesis
  - improvements
deferred: true
deferred_reason: "Risk: synthesis by AI can remove the human from the loop. Requires careful design to preserve human judgment. Post-launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/multi-perspective-review-feature.md
  - policies/core/multi-perspective-review.md
---

## Problem

After gathering perspectives from multiple models (or reviewers), the
contributor must read and synthesize them manually. For long or complex reviews
this is time-consuming, and important agreements or contradictions between
perspectives can be missed.

## Proposed Solution

An optional synthesis step: after N perspectives are collected, a designated
"synthesizer" model reads all of them and produces:

- A summary of where perspectives agree
- A summary of where they disagree, with the specific disagreement named
- Its own recommendation, labeled clearly as one more perspective (not a
  verdict)
- Flagged items that require human judgment before proceeding

The synthesizer output is presented to the human alongside the raw
perspectives, not instead of them. The human makes the final call.

## Critical Constraint

The synthesizer must not be allowed to make or imply a final decision. Its
output must be clearly framed as "here is what the reviewers found" plus
"here is my read" — not "here is the answer." The UI must make this
distinction visually clear so the contributor does not treat the synthesis
as a verdict.

This is the risk that makes this proposal deferred: it is easy to build
AI synthesis in a way that trains users to defer to it rather than engaging
with the underlying perspectives. That would defeat the entire purpose of
multi-perspective review.

## Deferred Because

The design of human-preserving synthesis is non-trivial. The base
multi-perspective feature (sequential second opinion, review section in
templates) covers the quality goal without this risk.
See [[policies/core/multi-perspective-review.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from multi-perspective-review-feature proposal | NetYeti |
