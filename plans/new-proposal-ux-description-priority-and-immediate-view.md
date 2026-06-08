---
title: "New Proposal UX: Ask for Description + Priority, Then Navigate Immediately"
status: draft
author: "NetYeti"
created: "2026-06-08"
created_by: "NetYeti@phoenix"
tags: [ux, proposals, workflow, ai]
proposal_source: "proposals/approved/new-proposal-ux-description-priority-and-immediate-view"
priority: medium
automated: guided
assigned_to: netyeti
related_to:
  - proposals/new-proposals-should-check-before-actual-creation.md
  - proposals/approved/ux-new-proposal.md
depends_on:
  - proposals/new-proposals-should-check-before-actual-creation.md
blocks: []
tests_defined: false
total_steps: 6
completed_steps: 0
phase: 3
---

# New Proposal UX: Ask for Description + Priority, Then Navigate Immediately

## Overview

Replace the title-first creation flow with a description + priority dialog. AI generates the title, full proposal structure, and tags from the description. File is written only after AI drafting completes (not on form submit). After creation, navigate directly to the new proposal page in preview mode. Also address: Approve button should auto-check related proposals, Find Related not showing results, and add AI review button for pre-approval critique cycle.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Replace creation dialog with description + priority | Remove title field. Add description textarea (1-3 sentences) and priority selector (0-5 scale with semantic labels). No file created yet. | ⏳ Pending |
| 2 | AI generates title and full structure from description | On submit, AI generates: kebab-case title, filename, expanded ## Problem / ## Proposed Solution sections, appropriate tags from vault set. File written only after AI completes. | ⏳ Pending |
| 3 | Navigate immediately to new proposal | After file creation, UI navigates directly to the new proposal page in preview mode. No file tree or status page intermediate. | ⏳ Pending |
| 4 | Approve button triggers related check | When clicking Approve, auto-run the collation check and offer to add related_to links before finalizing the approval. | ⏳ Pending |
| 5 | Fix Find Related not showing results | Debug and fix the related proposal search — currently returns empty results when matches exist. | ⏳ Pending |
| 6 | AI review button for pre-approval critique | Add a button that runs AI critique on the proposal body. Disable if no changes since last review. Available until proposal is approved. | ⏳ Pending |

## Testing Plan

1. Creation dialog shows description and priority fields only
2. Submitting description + priority triggers AI generation
3. AI-generated content is written to disk only after completion
4. UI navigates to the new proposal after creation
5. Approve button triggers related search and shows results before completing
6. Find Related returns expected matches
7. AI review button appears/disappears correctly based on approval state
8. AI review button disabled when no changes since last review

## Rollback Procedures

- Revert creation dialog to title-only form
- Disable AI generation step, fall back to current title-first flow
- Remove auto-navigate, return to file-tree nav

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI generates poor title or structure from description | Medium | Medium | User can edit all AI-generated content; preview mode before accepting |
| AI generation is slow — user waits on loading screen | Medium | Low | Show loading state with progress indication; AI response is typically <5s |
| Priority-based sorting makes old proposals invisible | Low | Low | Status page already groups by lifecycle stage; priority is additional sort dimension |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Plan filled in from proposal — description+priority creation flow, AI generation, immediate nav, related check fix, AI review button — 6 steps | NetYeti |
