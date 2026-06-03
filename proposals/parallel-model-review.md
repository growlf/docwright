---
complexity: medium
title: "Parallel Multi-Model Review Panel"
author: NetYeti
created: 2026-06-03
tags:
  - ai
  - review
  - ui
  - improvements
approved: false
deferred: true
deferred_reason: "Sequential second-opinion covers most needs. Parallel column layout is a significant UI investment. Post-launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/multi-perspective-review-feature.md
---

## Problem

The "Second Opinion" quick action opens a sequential second session. For
high-stakes decisions — major architecture choices, policy activations,
phase gate sign-offs — it would be more efficient to query multiple models
simultaneously and read their responses side by side rather than switching
between sessions.

## Proposed Solution

A "Multi-Review" mode that opens a split panel showing responses from N
configured models in parallel columns. The same prompt is sent to each
simultaneously. The contributor reads across columns and synthesizes.

Models are drawn from OpenCode's configured providers. The number of columns
is bounded (2–4) to keep the UI readable.

## Deferred Because

The sequential second-opinion flow (one other session, one click) covers
the majority of real use cases. The parallel view is a premium experience
for critical decisions. Building the column layout well is a meaningful UI
investment that belongs after the base chat panel is proven in use.
See [[proposals/multi-perspective-review-feature.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from multi-perspective-review-feature proposal | NetYeti |
