---
title: "Document Automations — Editing Mode, AI Drafting, and Auto-Plan Creation"
author: NetYeti
created: 2026-06-05
tags:
  - ux
  - workflow
  - automation
  - ai
  - proposals
complexity: medium
estimated_effort: M
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

The document lifecycle has several natural transition points where a manual step is currently required, creating friction:

1. Creating a new proposal lands on the file listing or read view — the contributor must click Edit to start writing.
2. After writing and saving a raw proposal, there is no automatic AI improvement pass to flesh out sparse content.
3. When a proposal is approved, a plan must be created manually — the approver leaves the approval flow, navigates to create a plan, and copies frontmatter fields by hand.

Each of these breaks flow and creates opportunities for proposals to stall between lifecycle stages.

## Proposed Solution

### 1. Auto-enter edit mode on proposal creation

When a new proposal is created (via the "New Proposal" button or guided flow), the editor opens immediately in WYSIWYG / edit mode — not read view. The user arrives ready to write, not to navigate to the edit button.

This is already specified in [[proposals/approved/ux-new-proposal.md]] (step 4). This proposal confirms and reiterates that requirement.

### 2. Auto-trigger AI drafting on first save

After a new proposal is saved for the first time (heuristic: no prior git commit for this file), automatically trigger the AI improvement pass via the dispatch module's `fillProposal()` or `critiqueDocument()` method. Surface results as a non-blocking toast and diff overlay.

This is already specified in [[proposals/ai-proposal-improve-on-save.md]] (On-save suggestion trigger). This proposal confirms and reiterates that requirement.

### 3. Auto-create draft plan on proposal approval

When a proposal transitions to `approved: true`:

- Automatically scaffold a plan file in `plans/` using the approved proposal's frontmatter (`title`, `author`, `tags`, `assigned_to`) and the profile's plan template
- Pre-populate the `proposal_source` field with the proposal's path
- Optionally trigger an AI critique pass on the draft plan (via `skill-plan-critique.md`) and surface the critique as a non-blocking notification attached to the new plan
- The plan is created in `status: draft` — it does not skip the approval process, it just eliminates the manual scaffolding step

The auto-creation fires on the same action that sets `approved: true`, so the approver sees the result immediately.

### 4. Configurable per-profile

Each profile's `profile.json` gains automation flags:

```json
{
  "auto_open_edit_on_create": true,
  "auto_improve_on_first_save": true,
  "auto_create_plan_on_approval": true,
  "auto_critique_draft_plan": true
}
```

Profiles that prefer a more manual workflow (e.g. lightweight personal vaults) can disable individual automations.

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/approved/ux-new-proposal.md]] | Already specifies auto-edit-mode (#1) |
| [[proposals/ai-proposal-improve-on-save.md]] | Already specifies auto-improve on save (#2) |
| [[proposals/skill-plan-critique.md]] | Critique pass for draft plans (#3) |
| [[proposals/plan-test-certification-checkboxes.md]] | Plan scaffolding structure (#3) |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-approve proposals based on criteria | Removes human from loop — governance principle |
| Auto-assign plans based on contributor workload | Requires contributor workload tracking |
| Auto-create milestone plans from roadmap | Requires roadmap/planning data structure |
