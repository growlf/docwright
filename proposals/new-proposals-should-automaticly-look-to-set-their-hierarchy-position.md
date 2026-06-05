---
title: "New Proposals Should Automatically Determine Their Hierarchy Position"
author: NetYeti
created: 2026-06-05
tags:
  - workflow
  - collation
  - dependencies
  - proposals
complexity: medium
estimated_effort: M
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

When a new proposal is added, there is no automated process to determine where it fits in relation to existing proposals. Contributors must manually figure out:

- Does this proposal depend on another proposal being completed first?
- Should it merge with an existing proposal instead of standing alone?
- Is it parallel to other work — independent and equal in priority?
- Does it block or supersede other proposals?

Without this, the proposal list stays flat and unprioritized. Dependencies, merges, and ordering are left to human memory and manual frontmatter edits, which rarely happen consistently.

## Proposed Solution

### 1. Relationship detection on creation

When a new proposal is created (or detected as raw and drafted), run the same collation/similarity scan used by [[proposals/related-docs-ux-improvements.md]] against all existing proposals. For each significant match, classify the relationship:

| Relationship | Meaning | Frontmatter signal |
|-------------|---------|-------------------|
| **Depends on** | This proposal requires the matched proposal to be completed first | `depends_on: [matched-proposal]` |
| **Blocks** | This proposal must be completed before the matched proposal | `blocks: [matched-proposal]` |
| **Merge candidate** | These proposals cover the same scope and should be merged | `subsumes: [matched-proposal]` or prompt user |
| **Parallel** | Independent work, no ordering constraint | No action needed |
| **Supersedes** | This proposal replaces an older one | `supersedes: [old-proposal]` |

### 2. Interactive confirmation

The detected relationships are presented to the user for confirmation before any frontmatter is written:

> "This proposal appears to depend on [[auth-redesign.md]]. It also overlaps significantly with [[sso-flow.md]] — would you like to merge them?"

The user can accept, reject, or adjust each relationship.

### 3. Hierarchy visualization

Once relationships are populated, the status page and lifecycle graph view ([[proposals/ui-lifecycle-graph-view.md]]) can surface the hierarchy — proposals appear in dependency order, merge groups are shown as clusters, and blocked proposals are visually flagged.

### 4. Relationship maintenance on updates

When an existing proposal is updated (body changes), re-scan for new or changed relationships. This catches evolving scope that creates new dependencies or makes a merge more appropriate.

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/related-docs-ux-improvements.md]] | Same collation similarity engine feeds relationship detection |
| [[proposals/new-proposals-should-check-before-actual-creation.md]] | Complements pre-creation dup check with hierarchy analysis |
| [[proposals/making-plans-scans-proposals-and-existing-plans.md]] | Same pattern at plan-creation stage |
| [[proposals/ui-lifecycle-graph-view.md]] | Hierarchy data powers dependency ordering in graph view |
| [[proposals/gantt-view-dependencies.md]] | Dependencies surfaced here feed Gantt timeline |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-merging proposals without confirmation | Human decides scope and priority |
| Cross-vault hierarchy detection | Requires remote registry sync (Phase 3+) |
| ML-based priority scoring | Heuristic relationship detection suffices for Phase 2 |
