---
title: Formalize validation and auto-sync for step counters
status: completed
completed_date: 2026-06-24
author: NetYeti
created: 2026-06-09
tags: tooling-gap, governance, lifecycle
proposal_source: proposals/approved/formalize-step-counter-sync.md
priority: medium
mode: autonomous
scenario_synthesis: "Step counter auto-sync — column-position-aware countSteps and replaceStepStatus in mcp/lib/steps.ts; no shell execution or infrastructure steps"
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
phase: 5
total_steps: 1
completed_steps: 1
_path: plans/completed/formalize-step-counter-sync.md
github_epic: null
---
# Formalize validation and auto-sync for step counters

## Overview

Makes `countSteps()` and `replaceStepStatus()` in `src/mcp/lib/steps.ts` robust to
table format variations. Previously both functions assumed Status was always the last
column, which broke when Issue/Branch columns were added after Status. The fix detects
Status column position from the header row and falls back to last-column behaviour for
legacy headerless tables, making the step counter format-agnostic.

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
| --- | --- | --- | --- | --- | --- |
| 1 | Column-position-aware step counting and status replacement | Rewrote `countSteps` and `replaceStepStatus` in `src/mcp/lib/steps.ts` to find the Status column by scanning the header row (`/^status$/i`). Added last-column fallback for legacy headerless tables (e.g. `| 1 | action | ✅ Done |`). Fixed in commits `b6a7f1e` (column-position fix) and `56ed979` (headerless fallback). 18 new tests covering 4-column, 6-column, tiered sub-section, and step-number boundary cases. | ✅ Done | — | feat/step-issue-tooling |

## Parallelism Map

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | — | Shipped as part of feat/step-issue-tooling PR #24 |

## Testing Plan

### Step Verification

- [x] `countSteps` correctly reads Status column (not Branch) on 6-column tables
- [x] `countSteps` correctly falls back to last-column on legacy headerless tables
- [x] `replaceStepStatus` updates Status column, leaves Issue/Branch intact
- [x] Both functions handle tiered sub-section tables (`###` headers within `## Implementation Steps`)
- [x] Step-number boundary test: step 10 match does not affect step 1

### Integration & Regression

- [x] Existing MCP mutation tests pass — `writePlan → performs full structural rewrite with count update` regression fixed
- [x] TypeScript compiles cleanly (`npm run typecheck`)
- [x] 262 dispatch tests passing (18 new for this fix)

### Gate Criteria

- [x] `tests_defined` set to `true` in frontmatter
- [x] Human reviewer has verified step outcomes above
- [x] No regressions introduced to adjacent workflows

## Rollback Procedures

The fix is backward-compatible. Legacy 4-column tables without a header row continue
to work via the fallback path. No rollback needed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| New 6-column tables with unexpected Status column position | Low | Low | Header scan is case-insensitive and position-agnostic |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-24 | Filled in completed implementation — column-position-aware fix shipped in PR #24 | NetYeti |
| 2026-06-09 | Created from approved proposal | NetYeti |
