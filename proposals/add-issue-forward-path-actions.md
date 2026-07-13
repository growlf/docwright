---
title: "Add forward path actions to issue detail — move to proposal/plan"
author: NetYeti
created: 2026-07-07
tags:
  - webui
  - workflow
  - ux
  - issue-management
approved: false
priority: high
created_by: "claude@claude-code"
assigned_to: ""
sources:
  - https://github.com/growlf/docwright/issues/176
github_issues:
  - 176
---

# Add forward path actions to issue detail — move to proposal/plan

## Problem

When viewing an issue detail page, users have no way to move it forward in the workflow. There are no buttons, actions, or clear next steps to:
- Create a proposal from the issue
- Create a plan from the issue
- Link the issue to an existing proposal

**Impact:**
1. Users get stuck — they find a scoped issue but can't act on it
2. Workflow is invisible — no path from issue → proposal → plan → work
3. Process is manual — users must create proposals in separate files and manually link them
4. Discoverability is poor — users don't know this workflow exists

**Blocking:** Cannot dogfood the issue→proposal→plan workflow without UI affordances.

## Proposed Solution

Add action buttons to the issue detail view that enable forward movement:

### 1. "Create Proposal" Button
**Placement:** Issue detail header, next to status
**Behavior:**
- Click opens modal: "Create Proposal from this issue"
- Pre-fills proposal title from issue title
- Pre-fills `sources: [issues/this-issue.md]` in frontmatter
- Opens editor to complete proposal details
- On save, marks issue as `status: proposal-linked` and `consumed_by: proposals/...`

**When active:**
- Issue status is `triaged`, `scope-checked`, or `awaiting-proposal`
- Issue is not already `proposal-linked`

### 2. "Link to Proposal" Button
**Placement:** Issue detail, actions dropdown
**Behavior:**
- Click opens modal: "Link this issue to a proposal"
- Shows searchable list of all proposals (`status: proposed`, `awaiting-approval`)
- User selects one
- On confirm, marks issue as `status: proposal-linked` and `consumed_by: proposals/X`

**When active:**
- Issue status is `scope-checked` or later
- Issue is not already `proposal-linked`

### 3. "Create Plan from Issue" Button (Future)
**Placement:** Issue detail, actions dropdown
**Behavior:**
- For advanced users: skip proposal step and go directly to plan
- Pre-fills plan from issue scope + estimated effort
- Marks issue as `status: resolved` (handled by plan directly)

**When active:**
- Issue status is `scope-checked` with high clarity
- Estimated effort is defined
- (Deferred to Phase 2)

## Workflow Clarity

This makes the forward path explicit:

```
[Issue] scope-checked
  ↓ "Create Proposal"
[Proposal] awaiting-approval
  ↓ (approve via UI)
[Plan] proposed
  ↓ (approve via UI)
[Work] (implementation begins)
```

Users see the buttons at each stage and understand what's next.

## Implementation Notes

- Modal forms should be lightweight (not full editor)
- "Create Proposal" modal should hint at what a proposal contains
- "Link to Proposal" modal should show proposal summaries (title + status)
- After linking, show success toast: "Issue linked to [proposal name]"
- Update issue status automatically (don't make user choose)

## Testing

- [ ] "Create Proposal" button visible for triaged/scope-checked issues
- [ ] Clicking button opens modal with pre-filled title
- [ ] Saving proposal marks issue as `proposal-linked`
- [ ] "Link to Proposal" button visible for eligible issues
- [ ] Searching for proposal works
- [ ] Linking updates issue status correctly
- [ ] Success toast shows proposal name
- [ ] Buttons hidden for issues already linked or in wrong status

## Success Criteria

- Issue detail has visible "Create Proposal" or "Link to Proposal" actions
- Users can move issues forward without leaving the UI
- Workflow is discoverable (buttons guide users)
- Issue→proposal link is automatic (no manual status juggling)
- Users understand the next step at each stage

## Future

- Batch operations: "Create proposal from N selected issues"
- Direct plan creation (skip proposal step for simple issues)
- Keyboard shortcuts: Cmd+P to create proposal, Cmd+L to link
- Issue templates that include "Forward to proposal" as a step
