---
title: "New Proposal UX: Ask for Description + Priority, Then Navigate Immediately"
status: completed
completed_date: 2026-06-18
author: "NetYeti"
created: "2026-06-08"
created_by: "NetYeti@phoenix"
tags: [ux, proposals, workflow, ai]
proposal_source: "proposals/approved/new-proposal-ux-description-priority-and-immediate-view.md"
priority: medium
mode: guided
assigned_to: netyeti
related_to:
  - proposals/approved/new-proposals-should-check-before-actual-creation.md
  - plans/new-proposals-should-check-before-actual-creation.md
depends_on: []
blocks: []
tests_defined: true
total_steps: 6
completed_steps: 6
phase: 3
_path: plans/completed/new-proposal-ux-description-priority-and-immediate-view
---

# New Proposal UX: Ask for Description + Priority, Then Navigate Immediately

## Overview

Replace the title-first creation flow with a description + priority dialog. AI generates the title, full proposal structure, and tags from the description. File is written only after AI drafting completes (not on form submit). After creation, navigate directly to the new proposal page in preview mode. Also address: Approve button should auto-check related proposals, Find Related not showing results, and add AI review button for pre-approval critique cycle.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Replace creation dialog with description + priority | Remove title field. Add description textarea (1-3 sentences) and priority selector (0-5 scale with semantic labels). No file created yet. | ✅ Done |
| 2 | AI generates title and full structure from description | On submit, AI generates: kebab-case title, filename, expanded ## Problem / ## Proposed Solution sections, appropriate tags from vault set. File written only after AI completes. | ✅ Done |
| 3 | Navigate immediately to new proposal | After file creation, UI navigates directly to the new proposal page in preview mode. No file tree or status page intermediate. | ✅ Done |
| 4 | Approve button triggers related check | When clicking Approve, auto-run the collation check and offer to add related_to links before finalizing the approval. | ✅ Done |
| 5 | Fix Find Related not showing results | Debug and fix the related proposal search — currently returns empty results when matches exist. | ✅ Done |
| 6 | AI review button for pre-approval critique | Add a button that runs AI critique on the proposal body. Disable if no changes since last review. Available until proposal is approved. | ✅ Done |

## Testing Plan

- [ ] Step 1: Replace creation dialog with description + priority
- [ ] Step 2: AI generates title and full structure from description
- [ ] Step 3: Navigate immediately to new proposal
- [ ] Step 4: Approve button triggers related check
- [ ] Step 5: Fix Find Related not showing results
- [ ] Step 6: AI review button for pre-approval critique
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
