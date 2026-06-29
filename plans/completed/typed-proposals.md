---
title: Typed Proposal Intake System
status: completed
completed_date: 2026-06-29
author: NetYeti
created: 2026-06-07
created_by: NetYeti@phoenix
tags:
  - planning
proposal_source: proposals/bugs-features-and-thoughts.md
priority: medium
mode: mentor
assigned_to: NetYeti
template_version: 1
tests_defined: true
tests_human_reviewed: true
total_steps: 7
completed_steps: 7
phase: 3
---

# Plan: Bugs, Features, and Thoughts — Typed Proposal Intake System

## Overview

Adds typed categories (feature / bug / thought) to the proposal intake system. The "New Proposal" creation flow now prompts for category then description, generates a title via AI (with graceful fallback), and scaffolds a category-appropriate template. Category badges appear on the status page and in PropertiesPane.

**Step 1 findings:** Everything was greenfield — no category picker, no generate-title endpoint, no typed templates. `proposalCategories` in profile.json held unused domain tags (`UI/UX/ENGINE/DATA`).

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | Verify existing creation flow state | Confirmed: dialog had desc + priority only; no category field; no generate-title; only research.md template existed | ✅ Done | — | feat/typed-proposals |
| 2 | Add `category` enum to proposal frontmatter schema | `proposalCategories` updated to `["feature","bug","thought"]` in profile.json; `category` field prepended to PropertiesPane chips | ✅ Done | — | feat/typed-proposals |
| 3 | Create typed proposal templates | `proposal-feature.md`, `proposal-bug.md`, `proposal-thought.md` in `src/profiles/org-operations/templates/` | ✅ Done | — | feat/typed-proposals |
| 4 | Build `POST /api/generate-title` endpoint | OpenCode-backed title generation with first-sentence fallback; 30s/60s timeouts | ✅ Done | — | feat/typed-proposals |
| 5 | Update "New Proposal" creation flow | Category chip row → description → parallel overlap+title check → confirm-title step (editable) → scaffold | ✅ Done | — | feat/typed-proposals |
| 6 | Show category in proposal lists and status page | cat-badge on Open Proposals table; feature/bug/thought chips first in PropertiesPane | ✅ Done | — | feat/typed-proposals |
| 7 | Tests | typecheck clean; fallback path verified (OPENCODE_URL absent → first sentence used); regression: existing proposals without category field unaffected | ✅ Done | — | feat/typed-proposals |

## Testing Plan

- [x] Step 1: Recon complete — all steps confirmed greenfield
- [x] Step 2: `profile.json` `proposalCategories` updated; PropertiesPane chips include feature/bug/thought at top
- [x] Step 3: Three templates created with category-appropriate section headings
- [x] Step 4: `/api/generate-title` returns `{ title, generated }` — falls back when `OPENCODE_URL` unset
- [x] Step 5: Dialog flow: category chips → description → parallel overlap+title fetch → confirm-title step with editable input → create
- [x] Step 6: Status page Open Proposals table shows cat-badge column; light/dark themed; `—` for uncategorised proposals
- [x] Step 7: `npm run typecheck` clean; no new svelte-check errors

### Gate Criteria

- [x] `npm run typecheck` passes — zero type errors
- [x] New Proposal dialog: selecting category chip changes placeholder text and Priority label visibility (hidden for bug, auto-set to high)
- [x] Overlap check and title generation run in parallel — no serial latency
- [x] Confirm-title step is editable before submission
- [x] Existing proposals without `category` field render `—` in the status page table (no crash)
- [x] No new npm dependencies introduced

## Rollback Procedures

All changes are additive. Rollback:
- Revert dialog to previous single-step flow (remove `newProposalCategory`, `newProposalTitle`, `confirm-title` step)
- Delete `/api/generate-title/+server.ts`
- Revert `proposalCategories` in `profile.json` to `["UI","UX","ENGINE","DATA"]`
- Delete three typed templates

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-07 | Plan created from approved proposal | NetYeti |
| 2026-06-29 | All 7 steps implemented on feat/typed-proposals | NetYeti |
