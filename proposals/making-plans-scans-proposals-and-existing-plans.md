---
title: "Making Plans — Scan Proposals and Existing Plans for Overlap"
author: NetYeti
created: 2026-06-05
tags:
  - workflow
  - plans
  - duplication
  - collation
  - dependencies
complexity: medium
estimated_effort: M
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

When a plan is created from a proposal, the current flow creates an isolated plan for that single proposal. It does not check whether:

1. An existing plan already covers similar scope — leading to duplicate or overlapping plans that should be merged
2. The new plan depends on another plan's completion — a dependency that should be captured at creation time
3. Other related proposals exist that belong in the same plan — they could be consumed together rather than creating separate plans for each

Each missed overlap causes duplicated work, planning conflicts, and a fragmented plan view on the status page.

## Proposed Solution

### 1. Pre-creation scan

When the user triggers plan creation from an approved proposal (or the auto-scaffold flow from [[proposals/doc-automations.md]]), the system scans:

- **Existing plans** (active and completed) — find overlap with the source proposal's title, tags, and body
- **Other open proposals** — find related proposals that share similar scope, tags, or keywords

### 2. Overlap handling

Results are presented as actionable options:

**Existing plan overlap:**
- "This proposal heavily overlaps with [[existing-plan.md]]. Would you like to add this proposal to that plan instead of creating a new one?"
- "This proposal depends on work in [[dependent-plan.md]]. A dependency relationship will be added to both plans."

**Related proposals found:**
- "These proposals appear related: [[prop-a.md]], [[prop-b.md]]. Would you like to include them in the same plan?"
- Selected proposals are consumed into the new plan; their `status` updates to reflect they are being actioned

**No overlap:** → proceed with normal plan creation

### 3. Merge or depend action

- **Merge**: the source proposal is added to the existing plan's scope; no new plan file is created. The proposal's frontmatter is updated with a `consumed_by: existing-plan` field.
- **Depend**: a `depends_on` entry is added to the new plan referencing the existing one.
- **Consume**: multiple proposals are bundled into one plan; each gets a `consumed_by: new-plan` field.

### 4. Integration with auto-plan creation

When [[proposals/doc-automations.md]] auto-creates a plan on proposal approval, this scan runs as part of the scaffolding step so the approver sees overlap results as part of the approval flow.

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/new-proposals-should-check-before-actual-creation.md]] | Sibling proposal — same overlap-detection pattern at a different lifecycle stage (proposal creation vs plan creation) |
| [[proposals/doc-automations.md]] | Auto-plan creation triggers this scan as part of scaffolding |
| [[proposals/related-docs-ux-improvements.md]] | Collation similarity scoring feeds the overlap detection |
| [[proposals/gantt-view-dependencies.md]] | Dependencies surfaced here feed the Gantt view |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-merge without human confirmation | Governance principle: human decides scope |
| Suggesting plan splits (when a proposal is too broad) | Separately propose — requires scope analysis |
| Cross-vault plan consolidation | Requires remote registry sync (Phase 3+) |
