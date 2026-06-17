---
title: Populate plan content from proposal body on approval
status: completed
completed_date: 2026-06-11
author: NetYeti
created: 2026-06-11
tags:
  - tooling
  - lifecycle
  - plan-generation
  - automation
proposal_source: proposals/approved/plan-content-from-proposal-body.md
priority: medium
mode: guided
assigned_to: netyeti
tests_defined: true
tests_human_reviewed: true
total_steps: 6
completed_steps: 6
---

# Populate plan content from proposal body on approval

## Overview

The fix is already implemented and tested. This plan formalizes it.

### What was done

**`src/mcp/tools/transitions.ts`** — `transition_to_approved` now parses proposal body into sections:
- `## Proposed Solution` numbered items → implementation step rows
- `## Proposed Approach` same treatment
- `## Implementation Steps` copied verbatim
- `## Testing Plan`, `## Risk Assessment`, `## Rollback` carried over
- All other sections preserved as context under Overview

**`src/webui/src/routes/api/approve-proposal/+server.ts`** — same fix for Web UI flow.

**Tests** — 6 new test cases covering all section mapping paths. 190 tests total pass.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Parse proposal body into sections by `##` headers | `transitions.ts:189-192` — `parseProposalSections()` splits on `^## ` | ✅ Done |
| 2 | Map recognized sections into plan template | `transitions.ts:45-131` — `buildPlanFromSections()` maps Proposed Solution → steps, copies Testing/Risk/Rollback verbatim | ✅ Done |
| 3 | Preserve context sections under Overview | All non-mapped sections included as `###` subsections in Overview | ✅ Done |
| 4 | Carry over tags from proposal frontmatter | Tags parsed via `formatYamlList()` and written into plan frontmatter | ✅ Done |
| 5 | Same fix in Web UI approve-proposal endpoint | `src/webui/.../approve-proposal/+server.ts` — identical section-parsing logic | ✅ Done |
| 6 | Add tests for section mapping | 6 new test cases in `test/mcp/transitions.test.ts` — Proposed Solution steps, Proposed Approach, direct table, full proposal | ✅ Done |

## Testing Plan

All 190 tests pass:
- MCP suite: 35 tests (5 config + 7 mutation + 11 transitions + 6 query + 6 parity)
- Dispatch suite: 155 tests (profile, gates, ACL, wikilinks, relationships, etc.)

## Rollback Procedures

The old behavior (empty plan skeleton) can be restored by reverting the two files and removing the 6 test cases added in `test/mcp/transitions.test.ts`.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Section parser misses edge-case formatting | Low | Low | Fallback to empty step row if no sections recognized |
| Proposal uses `###` sub-headings inside sections | Low | Low | Parser only splits on `## ` level-2 headers; sub-headings pass through as content |

## Phase Gate

- [x] Step 1: Parse proposal body into sections
- [x] Step 2: Map recognized sections into plan template
- [x] Step 3: Preserve context sections under Overview
- [x] Step 4: Carry over tags from proposal frontmatter
- [x] Step 5: Same fix in Web UI approve-proposal endpoint
- [x] Step 6: Add tests for section mapping
- [x] All tests pass (190 across MCP + dispatch)
- [x] No regressions from existing functionality

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-11 | Created from approved proposal | NetYeti |
