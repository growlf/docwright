---
title: Issue Heatmap and Dedup Pipeline
status: completed
completed_date: 2026-07-05
author: NetYeti
created: 2026-07-05
tags:
  - bridge
  - webui
  - mcp
  - dedup
  - heatmap
proposal_source: proposals/approved/issue-heatmap-and-dedup-pipeline.md
priority: high
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
total_steps: 5
completed_steps: 5
---

# Issue Heatmap and Dedup Pipeline

## Overview

Delivers the approved proposal [[proposals/approved/issue-heatmap-and-dedup-pipeline.md]] — see it for the full *what & why*.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Cross-source dedup — bridge.ts | Extend `suggestDuplicates()` to also query GH Issues via `gh issue list --label bug --state open --json number,title`. Compute Jaccard similarity on GH titles, merge results. Add `gh_reactions` optional frontmatter field. Update dispatch tests. | ✅ Done |
| 2 | MCP tool — `capture_bug_report` | New MCP tool in `issue_workflow.ts` with three sub-actions: `suggest`, `confirm`, `create`. Update `docwright-issue-workflow` skill. | ✅ Done |
| 3 | Heatmap UI — Status page | Add "Most Reported Bugs" section to `status/+page.svelte`. Parse all `issues/*.md` frontmatter, sort by `demand_count` desc, top 10. Color: 1-2 green, 3-4 amber, 5+ red. | ✅ Done |
| 4 | Auto-promote to GH | Add "Promote to GH" button in heatmap for issues with `demand_count >= 3` and no `github_issue:` link. Optional: auto-check in `sync_issue_file`. | ✅ Done |
| 5 | Time-weighted demand | Add `reported_dates: [YYYY-MM-DD, ...]` to issue frontmatter. `confirmDuplicate()` appends current date. Heatmap toggle: "All time" vs "Last 30 days". | ✅ Done |


## Gate Criteria

### Gate Criteria

- [x] All 5 implementation steps completed and verified
- [x] 321 dispatch tests pass with no regression
- [x] TypeScript compiles clean (`npx tsc --noEmit`)
- [x] Cross-source dedup integrates GH issues with graceful fallback
- [x] Heatmap displays on Status page with correct sort and color coding
- [x] Promote-to-GH button creates issues via `gh` CLI and writes `github_issue:` frontmatter
- [x] Time-weighted demand with reported_dates, 30d toggle, decayed scoring

## Testing Plan

- **Phase 1**: Extend `npm run test:dispatch` suite — mock GH CLI output, verify Jaccard merge, no regression
- **Phase 2**: Exercise tool via MCP test; verify suggest/confirm/create paths
- **Phase 3**: Visual inspection of Status page; sort order, color logic, empty state
- **Phase 4**: Button only shows for eligible bugs; GH issue creation end-to-end
- **Phase 5**: Demand decay fixture test; composite score sorts correctly

## Rollback Procedures

- **Phase 1**: Revert changes to `bridge.ts` and test additions
- **Phase 2**: Remove tool registration from `issue_workflow_index.ts`
- **Phase 3**: Revert changes to `status/+page.svelte`
- **Phase 4**: Remove button from heatmap UI
- **Phase 5**: Revert `reported_dates` and scoring in `bridge.ts`

## Risk Assessment

- **Low**: All phases are additive — no existing functionality removed
- **Medium**: Phase 1 depends on `gh` CLI availability; fall back gracefully to local-only
- **Low**: Phase 2 is a thin wrapper around existing APIs
- **Low**: Phase 3 is purely UI
- **Low**: Phase 4 uses existing `contribute_upstream` or `gh` patterns
- **Low**: Phase 5 adds optional field, no breaking changes

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-05 | Created from approved proposal | NetYeti |
| 2026-07-05 | Plan marked complete - all 5 steps verified and tested | NetYeti |


---
⚠ **Governance:** mutate this plan via MCP only — update_step · update_plan_status · append_history · set_plan_field · write_plan. Direct writes to `plans/*.md` are blocked by the PreToolUse hook. Bash/Python writes bypass the hook and are equally prohibited (AGENTS.md §Invariant 6). If MCP is unavailable: halt and report, do not fall back to direct writes.