---
title: Bulk Issue Selection → Proposal Creation Workflow
status: draft
author: Claude (on behalf of user)
created: 2026-07-09
tags:
  - webui
  - workflow
  - issues
  - proposals
  - bulk-actions
proposal_source: proposals/approved/bulk-issue-to-proposal.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/bulk-issue-to-proposal.md
---

# Bulk Issue Selection → Proposal Creation Workflow

## Overview

Delivers the approved proposal [[proposals/approved/bulk-issue-to-proposal.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

Let me check an existing plan for the exact table format used in this repo.

## Testing Plan

### Step Verification

- [ ] **Step 1** — Open issues list: verify checkboxes appear in selection mode, bulk toolbar renders, and keyboard shortcuts (Shift+Click, Ctrl+A) toggle selections correctly
- [ ] **Step 2** — Select 3+ issues and trigger "Create Proposal": confirm wizard shows selected issues, template auto-populates with issue titles/links, and clicking "Create" generates a valid proposal file
- [ ] **Step 3** — Inspect the created proposal's frontmatter: verify `sources:` contains wikilinks to each source issue, and each source issue's frontmatter contains a `consumed_by:` wikilink back to the proposal
- [ ] **Step 4** — Navigate via wikilink from a source issue to the proposal and back: confirm bidirectional links resolve correctly in the UI
- [ ] **Step 5** — Change a consumed proposal's status through the lifecycle (in-progress → completed): verify the source issue's `consumed_by:` field is NOT cleared (non-destructive association)
- [ ] **Step 6** — POST to `/api/proposals/from-issues` with a set of issue IDs: verify 201 response, correct frontmatter, and that all source issues have `consumed_by:` updated

### Integration & Regression

- [ ] `npm test` passes with no regressions in existing issue-list, proposal-editor, and lifecycle tests
- [ ] `npm run typecheck` passes with new frontmatter fields (`consumed_by`, `sources`) added to schema definitions
- [ ] Existing "Create Proposal" (single-issue) flow continues to work without showing the new wizard
- [ ] Proposal detail view renders correctly with `sources:` wikilinks; clicking a broken/missing-issue link shows a graceful 404 state
- [ ] Bulk-select toolbar is hidden when feature flag is off; toggling the flag mid-session does not leave orphaned UI state

### Gate Criteria

- [ ] All Step Verification checkboxes are passing
- [ ] All Integration & Regression checkboxes are passing
- [ ] Cycle-select → create proposal → open proposal → navigate-back-to-issue round trip verified on at least 3 issues
- [ ] Frontmatter schema migration (`consumed_by` on issues, `sources` on proposals) applied without data loss
- [ ] Friction entry filed for any unresolved UX edge case discovered during testing

## Rollback Procedures

| Scenario | Rollback |
|---|---|
| Selection mode / checkboxes / bulk toolbar cause regressions in issues list rendering | Remove selection UI layer; restore original list component; clear selection state from store |
| Proposal creation wizard fails to initialize or crashes mid-flow | Disable modal entry point; remove wizard component; fall back to manual proposal creation |
| `consumed_by` / `sources` fields break existing issue or proposal schemas | Revert data model migration; drop new fields from validation; restore prior schema version |
| New UI components (context panel, modal, enhanced editor) conflict with existing layout | Remove component registrations; restore previous editor and panel defaults; flush component cache |
| Workflow status model or bidirectional link logic produces stale or circular references | Revert status transitions to prior state machine; clear link indexes; restore read-only view |
| New API endpoints introduce auth or data integrity issues | Disable new routes; revert controller changes; restore prior API surface from last known-good commit |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bidirectional wikilinks desync between issues and proposals | Medium | High | Implement lifecycle hooks that update both sides atomically; add nightly validation job to detect and report orphans |
| 3-step wizard overwhelms new users, increasing drop-off | Medium | Medium | Add progressive disclosure with optional step skipping; include "quick create" mode that pre-fills from single selection |
| Keyboard shortcuts conflict with browser or assistive-tech defaults | Low | Medium | Use modifier combos (Ctrl+Shift) for all UI shortcuts; publish an accessible shortcut reference card |
| Bulk selection UI degrades with 500+ issues | Low | High | Virtualize the issue list with windowed rendering; cap batch at 100 with a warning and pagination prompt |
| Existing issues without `consumed_by` or `sources` cause null-pointer errors | Medium | High | Add defensive null-coalescing in all select queries; run a one-off migration script to backfill null fields |
| Workflow status semantics ambiguity (e.g., "linked" vs "consumed_by") | Medium | Low | Define and document exact status model in `/docs/schemas/issue-proposal-lifecycle.md` before coding; enforce via JSON Schema validation |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-09 | Created from approved proposal | Claude (on behalf of user) |
