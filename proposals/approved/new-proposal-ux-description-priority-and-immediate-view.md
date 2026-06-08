---
title: "New Proposal UX: Ask for Description + Priority, Then Navigate Immediately"
author: NetYeti
created: 2026-06-06
tags:
  - ux
  - proposals
  - workflow
  - ai
complexity: medium
estimated_effort: M
approved: true
created_by: NetYeti@phoenix
assigned_to: netyeti
_path: proposals/new-proposal-ux-description-priority-and-immediate-view.md
consumed_by: plans/new-proposal-ux-description-priority-and-immediate-view.md
---
## Problem

The "New Proposal" creation form asks for a title upfront — which forces the author to summarize the idea before they've described it. Titles are editorial artifacts; ideas start as descriptions. The result is either a vague filename ("improve-stuff.md") or a premature title that doesn't match what the proposal ends up being.

The priority/urgency of an idea is lost entirely. There is no structured way to express "this is just a note" vs. "this needs to happen this sprint" at capture time. Everything lands at the same level in the proposals list, requiring human triage to establish relative urgency.

After creation, the user is left looking at the file tree or status page rather than the new proposal — breaking the mental flow from "I have an idea" to "here is the idea ready to refine."

When I click Approve, the approve button, and then the Plan button, it should automaticly force a "related" check and offer to add relevance.

The Fine Related button is not showing any related items, and I know there are some.

Untill the proposal is aproved, there should be a AI review button that asks the subagent to do a critique and fix cycle on it when ever the user asks (but disable it if one has already happened but nothing has changed).

## Proposed Solution

### 1\. Replace the title field with description + priority

The creation dialog collects two fields only:

**Description** — 1-3 sentences. What is wanted or what needs to change. This is the raw input the AI uses to generate the full proposal structure.

**Priority** — a 0–5 urgency scale with semantic meanings:

| Level | Label | Meaning |
| --- | --- | --- |
| 0 | Deferred | Just noting the idea — no action expected yet |
| 1 | Someday | Nice to have, no timeline |
| 2 | Backlog | Do this after more important items |
| 3 | Relevant | Should factor into current phases/plans — schedule it |
| 4 | High | High priority; only superseded by a 5 |
| 5 | Drop everything | Critical — usually a production bug or security issue |

The priority value maps to frontmatter as a new `priority:` field (integer, 0–5). The status page can sort and filter by this field.

### 2\. AI generates the title and full structure

After the user submits description + priority, the AI:

*   Generates a concise, descriptive title (user can edit later)
*   Derives a kebab-case filename from the title
*   Expands the description into a full `## Problem` / `## Proposed Solution` scaffold (same quality as a hand-drafted proposal)
*   Applies appropriate tags from the vault's existing tag set
*   Checks for overlap with existing proposals (see \[\[proposals/new-proposals-should-check-before-actual-creation.md\]\])

The file is written only after AI drafting completes — not on form submission.

### 3\. Navigate immediately to the new proposal

After the file is created, the UI navigates directly to the new proposal page in preview mode. The user sees the AI-drafted content and can:

*   Accept it as-is
*   Edit in WYSIWYG or source mode
*   Set or adjust tags and frontmatter in the properties pane

No hunting in the file tree. No returning to the status page. The mental thread from "I have an idea" to "here it is, ready to refine" is continuous.

## Relationship to Existing Work

| Proposal | Relationship |
| --- | --- |
| \[\[proposals/new-proposals-should-check-before-actual-creation.md\]\] | Complements — that proposal defines the duplication check; this one defines the form UX and priority model |
| \[\[proposals/need-a-way-to-quickly-discern-raw-proposals.md\]\] | Priority 0 captures the "just noting an idea" case that creates raw proposals; this reduces that class at the source |
| \[\[proposals/approved/ux-new-proposal.md\]\] | Guided creation flow — this replaces the title field in that flow |
| \[\[proposals/tags-more-useful-to-humans.md\]\] | AI auto-tagging during creation feeds the tag normalization work |
| \[\[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md\]\] | Priority level 3 ("relevant to current phases") links to roadmap visibility |

## Out of Scope

| Idea | Why deferred |
| --- | --- |
| Auto-escalating priority when related plans go active | Useful but complex — Phase 3+ |
| Cross-vault priority comparison | Requires remote registry (Phase 3+) |
| Priority decay / aging reminders | Interesting; separate proposal |
| Two-way sync: priority in frontmatter ↔ Forgejo issue labels | Phase 3 integration work |
| Sorting the proposals list by priority in the UI | Small follow-on; can be done in any sprint |