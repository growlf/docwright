---
title: "New Proposals Should Check Relevance Before Creating the File"
status: in-progress
author: "NetYeti"
created: "2026-06-08"
created_by: "NetYeti@phoenix"
tags: [workflow, proposals, duplication, collation, ai]
proposal_source: "proposals/approved/new-proposals-should-check-before-actual-creation.md"
priority: medium
mode: guided
assigned_to: netyeti
scenario_synthesis: SvelteKit dialog flow + new API endpoint; keyword scoring in TypeScript; no shell scripts, no VS Code API, no external services
related_to:
  - proposals/approved/new-proposal-ux-description-priority-and-immediate-view.md
  - proposals/approved/ux-new-proposal.md
depends_on: []
blocks: []
tests_defined: true
total_steps: 5
completed_steps: 5
phase: 3
---

# New Proposals Should Check Relevance Before Creating the File

## Overview

Before writing a new proposal file, check across existing proposals, plans, and completed plans for keyword similarity and semantic overlap. If overlap found, show the user before creating the file — options: open existing, view comparison, or continue creating anyway. Only write the file after the check passes or the user explicitly continues.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Description-first creation flow | Initial dialog asks only for brief description (1-3 sentences). AI generates title from description. No file created until check passes. | ✅ Done (New Proposal UX plan) |
| 2 | Relevance and duplication check engine | Before writing, scan existing proposals, plans, and completed plans for keyword similarity and semantic overlap with the description. Use existing collation similarity scoring. | ✅ Done — POST /api/overlap/preview, keyword coverage scoring |
| 3 | Overlap result presentation | Show results: no conflicts → proceed; possible overlap → summary with similarity % and links to existing documents, with options (open existing, view comparison, continue creating); already addressed → message with link to completed plan. | ✅ Done — dialog shows matches with reason + Open link + Create Anyway |
| 4 | Assisted title generation | AI generates draft title from description using kebab-case convention. User can accept, edit, or replace before file creation. | ✅ Done (New Proposal UX plan) |
| 5 | File creation after check passes | Proposal file written to disk only after check passes or user explicitly continues. Pre-populated with frontmatter, description expanded into ## Problem and ## Proposed Solution stubs. | ✅ Done (New Proposal UX plan) |

## Testing Plan

- [ ] Step 1: Description-first creation flow
- [ ] Step 2: Relevance and duplication check engine
- [ ] Step 3: Overlap result presentation
- [ ] Step 4: Assisted title generation
- [ ] Step 5: File creation after check passes
1. Description with no matches → creates file immediately
2. Description matching an existing proposal → shows overlap warning with correct similarity %
3. Description matching a completed plan → shows "already addressed" message
4. User chooses "continue creating anyway" → file created despite overlap
5. AI title generation produces kebab-case filename correctly
6. Generated frontmatter has all required fields

## Rollback Procedures

- Remove relevance check from creation flow, revert to direct file creation
- Remove collation scoring integration

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| False negatives — check misses actual duplicates | Medium | Low | Check is advisory, not blocking; user always has "continue anyway" option |
| False positives — blocks legitimate unique proposals | Medium | Low | "Continue anyway" option bypasses the block; user is empowered to decide |
| Collation search is slow on large vaults | Low | Medium | Search is scoped to name+frontmatter only, not full body text; can be made async |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Plan filled in from proposal — pre-creation relevance check, overlap detection, assisted title generation — 5 steps | NetYeti |
