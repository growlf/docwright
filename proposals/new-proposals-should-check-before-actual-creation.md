---
title: "New Proposals Should Check Relevance Before Creating the File"
author: NetYeti
created: 2026-06-05
tags:
  - workflow
  - proposals
  - duplication
  - collation
  - ai
complexity: medium
estimated_effort: M
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

Even with a single user, duplicate proposals happen — clutter makes it hard for a human to remember every existing proposal and see when overlap exists. Currently, a user can write and save a proposal that duplicates or conflicts with an existing one, and no check is performed until after the file is on disk.

The cost is wasted drafting effort, confusing duplicate entries in the proposal list, and missed opportunities to consolidate related work before it diverges.

## Proposed Solution

### 1. Description-first creation flow

When creating a new proposal, the initial dialog asks only for a **brief description** (1-3 sentences) of the idea. The AI generates the title from the description. No file is created yet.

### 2. Relevance and duplication check

Before writing the file, the system runs a check across:
- **Existing proposals** — keyword similarity and semantic overlap with the description
- **Existing plans** — does the idea overlap with work already planned or in progress?
- **Completed plans** — has this already been done?

Results are presented as:
- **No conflicts found** → proceed to create the file
- **Possible overlap found** → show a summary: "This idea overlaps with [[existing-proposal.md]] (85% similarity) and is related to [[active-plan.md]]. Options: [Open existing] [View comparison] [Continue creating anyway]"
- **Already addressed** → "This idea appears to be covered by [[completed-plan.md]]. No new proposal needed."

### 3. Assisted title generation

The AI generates a draft title from the description using the same convention as existing proposals (kebab-case filename, descriptive title). The user can accept, edit, or replace it before the file is created.

### 4. File creation

Only after the check passes (or the user explicitly chooses to continue despite overlap) is the proposal file written to disk, pre-populated with frontmatter and the description expanded into `## Problem` and `## Proposed Solution` stubs.

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/need-a-way-to-quickly-discern-raw-proposals.md]] | Complements raw-proposal detection — prevent raw duplicates before they exist |
| [[proposals/ai-proposal-improve-on-save.md]] | AI drafting runs after creation; this runs before creation |
| [[proposals/approved/ux-new-proposal.md]] | Guided creation flow — this extends it with pre-creation validation |
| [[proposals/related-docs-ux-improvements.md]] | Collation similarity scoring feeds the duplication check |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-merge overlapping proposals | Human should decide what to merge |
| Cross-vault duplication checking | Requires remote registry sync (Phase 3+) |
| Plan-level duplication check on creation | Handled by sibling proposal [[proposals/making-plans-scans-proposals-and-existing-plans.md]] |
