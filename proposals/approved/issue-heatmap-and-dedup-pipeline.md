---
title: Issue Heatmap and Dedup Pipeline
author: NetYeti
created: 2026-07-04
tags:
  - bridge
  - webui
  - mcp
  - dedup
  - heatmap
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/approved/issue-heatmap-and-dedup-pipeline
consumed_by: plans/issue-heatmap-and-dedup-pipeline.md
---

## Problem

The bug-reporting bridge from #68 works, but it's reactive — you have to be in
the app to see duplicates, and `demand_count` has no visibility surface. Three
gaps remain:

1. **No cross-source dedup** — a bug filed on GitHub Issues won't appear in
   local `suggestDuplicates()` results, so users can +1 duplicates on GH with
   no local signal.
2. **No AI-side capture** — when a user describes a bug during an agent chat,
   there's no structured MCP tool to log it through the bridge pipeline.
3. **No heatmap** — `demand_count` exists on every issue file, but nobody can
   see the ranked list. The release readiness engine reads it
   (`release.ts:112`, threshold >=5), but there's no surfaced view.

## Proposed Solution

Five-phase build, each additive and independently valuable:

| Phase | What | Depends On |
|-------|------|-----------|
| 1 | Cross-source dedup — `suggestDuplicates()` also queries GH Issues, merges results | Existing `bridge.ts` |
| 2 | `capture_bug_report` MCP tool — suggest/confirm/create actions for agent-chat bug capture | Phase 1 |
| 3 | Heatmap UI — "Most Reported Bugs" section on Status page, sorted by `demand_count` | Phase 1 (enhances value) |
| 4 | Auto-promote to GH — when `demand_count >= 3`, show promote button + optional auto-create | Phase 3 |
| 5 | Time-weighted demand — `reported_dates` array, composite score, trending sort | Phase 3 |

## Alternatives Considered

- **Separate heatmap database** — rejected, violates `git is canonical` (#104).
- **Passive telemetry** — rejected, violates the bridge invariant (#68 §3).
- **Single-phase build** — rejected; five phases let us ship early value while
  harder parts cook.

## Related Work

| Reference | Relationship |
|-----------|-------------|
| #68 (completed) | Established bridge, `demand_count`, `issues/` store — foundation for everything |
| #104 (draft plan) | GH ↔ local relationship model — Phase 1 operationalizes the mirror |
| `contribution-pipeline` (in-progress) | Contribute upstream tools — Phase 4 builds on this |
