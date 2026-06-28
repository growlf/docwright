---
title: Bugs, features, and thoughts
author: NetYeti
created: 2026-06-07
tags: []
category: []
complexity: ""
estimated_effort: ""
depends_on: []
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/approved/bugs-features-and-thoughts.md
consumed_by: plans/typed-proposals.md
---
* * *

## Problem

DocWright currently lacks a structured intake mechanism for new work items. All proposals are created as undifferentiated documents, forcing contributors to describe intent from scratch without guidance. This leads to inconsistent formats, lost context, and repeated requests — the "New..." prompt requires a title upfront despite the team repeatedly asking for a description-first workflow. Ideas, bugs, and enhancements are mixed together with no way to filter, triage, or prioritize them by type.

## Proposed Solution

Introduce a typed proposal system with three initial categories — **feature**, **bug**, and **thought** — that map to distinct templates and workflows:

*   **feature** — new enhancements or additions
*   **bug** — something broken, wrong, or in need of change for efficiency or effectiveness
*   **thought** — a target for general research and/or collaboration

The "New..." creation flow will:

1.  Prompt for a **category** (the above list, expandable over time), or infer it from the description
2.  Prompt for a **description** of what is wanted
3.  Auto-generate the **title** from the description using an AI model, removing the manual title field from the intake step

Categories define which template is scaffolded, what frontmatter is required, and which triage pipeline the item enters. The category list is expected to grow as the workflow matures.

## Out of Scope

*   Custom category creation by end users (categories will be added by governance maintainers)
*   Automated triage or assignment logic — the typed intake is a precursor to, not a replacement for, a triage workflow
*   Changes to existing proposal approval and planning lifecycle stages
*   Backfilling categories onto existing proposals

## Impact

This restructures the intake gate of the DocWright lifecycle. All upstream workflows (approval, planning, execution) remain unchanged — the typed categories feed into the existing proposal→plan→completed pipeline with richer metadata from the start.