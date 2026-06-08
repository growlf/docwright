---
title: Plan: Bugs, Features, and Thoughts — Typed Proposal Intake System
status: draft
author: NetYeti
created: 2026-06-07
created_by: NetYeti@phoenix
tags: [planning]
proposal_source: proposals/bugs-features-and-thoughts.md
priority: medium
automated: off
waiting_reason:
assigned_to: NetYeti
related_to:
  - proposals/approved/new-proposals-should-check-before-actual-creation.md
  - proposals/approved/new-proposal-ux-description-priority-and-immediate-view.md
depends_on:
  - plans/completed/properties-pane.md
  - plans/completed/web-ui-polish.md
blocks: []
reviewed_by:
reviewed_date:
canceled_date:
cancellation_reason:
template_version: 1.0
tests_defined: false
gate_reviewer:
gate_status:
gate_date:
gate_note:
gate_reviews: []
gate_quorum: 1
total_steps: 7
completed_steps: 0
phase: 2
---

# Plan: Bugs, Features, and Thoughts — Typed Proposal Intake System

## Mode

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

Adds typed categories (feature / bug / thought) to the proposal intake system.
Changes the "New Proposal" creation flow to prompt for **category** then **description**,
and auto-generates the title from the description via the AI engine. Each category
scaffolds a distinct template with appropriate frontmatter and guidance.

See [[proposals/bugs-features-and-thoughts.md]] for full specification.

**Pre-work note:** The AI critique flagged a potential overlap with
`plans/completed/web-ui-polish.md` (`ux-new-proposal`) and
`plans/completed/properties-pane.md` (`core-classifying-proposals`). Before starting,
verify what those completed plans actually delivered for the creation flow — if
`category` picker already exists partially, this plan builds on it rather than
re-implementing it.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Verify existing creation flow state | Open the "New Proposal" dialog and the properties pane. Document exactly what exists today: does a `category` field exist? Does the creation flow prompt for type? This determines which steps below are greenfield vs. extension. | ⏳ Pending |
| 2 | Add `category` enum to proposal frontmatter schema | Extend `profile.json` for `org-operations` (and `doc-lifecycle`) to define `proposalCategories: ["feature", "bug", "thought"]`. Add `category` field to the proposal template with an empty default. Add frontmatter validation in the linter so unknown categories are flagged. | ⏳ Pending |
| 3 | Create typed proposal templates | Add `templates/proposal-feature.md`, `templates/proposal-bug.md`, `templates/proposal-thought.md` to the profile. Each has category-appropriate section headings: bug template gets "Steps to Reproduce" + "Expected vs Actual"; feature gets "Proposed Solution" + "Out of Scope"; thought gets "Research Question" + "Initial Hypotheses". | ⏳ Pending |
| 4 | Build `POST /api/generate-title` endpoint | New SvelteKit route. Accepts `{ description: string, category: string }`. Calls `OpenCodeEngine` with a short prompt: "Generate a concise, specific proposal title (max 10 words) for this [category]: [description]". Falls back to the first sentence of the description on error or when OPENCODE_URL is unset. | ⏳ Pending |
| 5 | Update "New Proposal" creation flow | Replace the current single-step title prompt with a two-step modal: (1) pick category from a dropdown, (2) enter description (textarea). On submit, call `/api/generate-title`, show the generated title for confirmation (editable), then scaffold the correct template with the confirmed title. Show a spinner during title generation. | ⏳ Pending |
| 6 | Show category in proposal lists and status page | Add category badge to the Open Proposals table on the status page. Add category chip to the PropertiesPane for proposals. Ensure the collation engine uses category as a signal (same category = higher `tag_overlap` weight). | ⏳ Pending |
| 7 | Tests | Unit: `generateTitle` falls back gracefully when OpenCode is unavailable. Frontmatter validation rejects unknown categories. Template selection returns correct template per category. Manual: walk through all three category paths end-to-end; verify title generation and template scaffolding. | ⏳ Pending |

## Testing Plan

- **Unit**: `generateTitle` fallback (no OpenCode), frontmatter validation for unknown
  category values, template selection logic per category
- **Manual**: New Proposal → select "bug" → enter description → verify bug template
  scaffolded with correct sections. Repeat for feature and thought. Confirm title
  is AI-generated and editable before creating.
- **Regression**: existing proposals without `category` field should not be broken
  by schema changes; linter should warn, not error, on missing category in old docs.

## Rollback Procedures

All changes are additive. The new templates don't replace old ones. Rolling back means:
- Revert the creation flow to the previous single-step title prompt
- Remove the `proposalCategories` field from `profile.json`
- Delete the three typed templates
- Delete `/api/generate-title`

Old proposals without `category` are unaffected regardless.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI title generation is slow (30–60s) | Medium | Friction | Spinner + "Generating…" label; allow manual override at any point |
| Overlap with already-completed creation flow work | Medium | Medium | Step 1 explicitly verifies what exists before building |
| Category list grows uncontrolled | Low | Low | Governance maintainers own the list per proposal Out of Scope |
| New templates break existing new-proposal flow | Low | Medium | Templates are additive; old flow still works unchanged |

## Critical Review

Critique complete — 14 findings across all steps and cross-cutting areas. Three 🚫 blocks, five ⚠️ warnings, six 📝 notes. The key blockers are: phantom `related_to` proposals on disk, missing category migration strategy, and undefined template file locations.