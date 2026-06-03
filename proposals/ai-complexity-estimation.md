---
complexity: medium
title: "AI-Powered Complexity Estimation"
author: NetYeti
created: 2026-06-03
tags:
  - ai
  - governance
  - dispatch
  - improvements
approved: false
deferred: true
deferred_reason: "Heuristic estimator ships now. AI-powered version requires the chat panel (Phase 2). Revisit after web-ui-ai-chat-panel lands."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/web-ui-ai-chat-panel.md
---

## Problem

The heuristic complexity estimator (`/api/estimate-complexity`) uses keyword
matching and structural signals (step count, dependencies, word count) to
assign low/medium/high. It is fast and requires no AI backend, but it misses
nuance — a short proposal can be architecturally complex; a long one can be
a simple documentation update.

## Proposed Solution

Replace or augment the heuristic with an LLM call via the OpenCode SDK once
the chat panel is available:

- Send the proposal body + frontmatter to the active model
- Ask it to reason about scope, dependencies, risk, and reversibility
- Return structured output: `{complexity, confidence, reasoning}`
- Surface the reasoning as the hint text in the properties pane

The heuristic remains as a fallback when no AI backend is available
(offline, opencode not running, etc.).

The "⟳ Complexity" button in the properties pane already exists — this
proposal just upgrades what it calls.

## Deferred Because

Requires the Phase 2 chat panel (`/api/opencode/` proxy) to be available.
The heuristic covers the immediate need.
See [[proposals/web-ui-ai-chat-panel.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from complexity estimator implementation | NetYeti |
