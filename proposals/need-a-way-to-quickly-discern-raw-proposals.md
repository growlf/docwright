---
title: "Need a Way to Quickly Discern Raw Proposals"
author: NetYeti
created: 2026-06-05
tags:
  - workflow
  - automation
  - triage
  - governance
complexity: low
estimated_effort: S
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

A proposal created by a human starts in "raw" form — minimal content, possibly just a title and a sentence or two. Currently there is no automated way to distinguish these raw drafts from fully fleshed-out proposals. The system cannot answer "which proposals need AI drafting help?" without human review of every file.

This proposal itself was a raw proposal. It was identified and drafted by the AI — exactly the workflow it describes.

## Proposed Solution

### 1. Heuristic raw-proposal detection (code, not AI)

A fast, dependency-free heuristic that classifies a proposal as **raw** if it meets any of these criteria:

- Missing `## Problem` or `## Proposed Solution` section entirely
- `## Proposed Solution` heading exists but has no content beneath it
- Total body content (excluding frontmatter) is under 50 words
- The file has no Document History table and has never been committed with a substantive edit (first commit only)

The detection is a simple script (`scripts/classify-proposal.ts`) that can run in CI, as a pre-commit hook, or on demand. It returns a list of raw proposal paths with the specific raw-indicator for each.

### 2. Status page integration

The vault status page gains a **Raw Proposals** section showing proposals flagged by the heuristic, with a count badge. Each entry shows:
- The proposal title and path
- What makes it raw (e.g. "Missing ## Proposed Solution", "Under 50 words body")
- A **Draft with AI** action button that triggers `fillProposal()` via the dispatch module

### 3. AI agent integration

The raw-proposal list is surfaced to AI agents via a new dispatch API endpoint (`GET /api/raw-proposals`). The agent can then:

- Draft each raw proposal using `fillProposal()` — adding Problem and Proposed Solution sections while preserving the author's original intent
- Apply appropriate tags from the vault's existing tag set
- Present the drafted result for human review (diff overlay, accept/reject)

The AI never publishes a drafted proposal without human confirmation.

> **Already shipping:** The `.opencode/skills/docwright-raw-proposal/` skill implements
> this detection and drafting workflow for any AI agent, right now. No backend changes
> needed. The sections below describe what gets built into the platform proper.

### 4. Automated triage workflow

Optionally, a periodic check (triggered by webhook or cron) that:
1. Scans for raw proposals
2. If any are found and an AI backend is available, auto-triggers drafting
3. Posts a notification: "N raw proposals have been drafted — review changes"

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/ai-proposal-improve-on-save.md]] | `fillProposal()` is the drafting engine this proposal triggers |
| [[proposals/doc-automations.md]] | Auto-drafting on save complements the raw-proposal triage flow |
| [[proposals/tags-more-useful-to-humans.md]] | Raw proposals get auto-tagged during drafting |
| Status page | Raw Proposals section extends the existing status page layout |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-accepting drafted proposals without review | Governance principle: AI suggests, human decides |
| Raw detection for plans and docs | Proposal triage is the immediate need; extend later |
| ML-based quality scoring of proposal content | Heuristic suffices for Phase 2; ML is Phase 4+ |
