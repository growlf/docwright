---
title: AI Proposal Improvement — On-Save Trigger and Manual Button
author: NetYeti
created: 2026-06-03
tags:
  - ai
  - ux
  - proposals
  - web-ui
  - quality
approved: true
created_by: NetYeti@phoenix
assigned_to: Netyeti
related_to:
  - proposals/web-ui-ai-chat-panel.md
  - proposals/multi-perspective-review-feature.md
  - proposals/approved/ux-new-proposal.md
_path: proposals/ai-proposal-improve-on-save.md
---

## Problem

When a user creates a new raw proposal and saves it, there is no AI improvement
pass — the content goes in as-is. There is also no way to request an AI
improvement from the UI beyond manually copying content into the chat panel
and crafting a prompt.

The result is that proposals often sit in raw/rough form longer than needed,
and the path from "dumped thoughts" to "reviewable proposal" requires context-
switching to an external tool or a separate chat session.

## Proposed Solution

### 1. Manual "Improve" button

Add an **Improve** button to the document toolbar (read mode, alongside
Edit/Source/Preview) and/or the properties pane. Clicking it:

- Calls `critiqueDocument()` via the dispatch module's AI engine
- Shows improvements as a **diff overlay** — the user sees proposed edits
  inline (additions in green, removals in red)
- Offers **Accept All** / **Reject All** / per-edit accept/reject controls
- Does not modify the file until the user explicitly accepts changes

The button should be shown for proposals only (not plans or docs), at least
initially.

### 2. On-save suggestion trigger

After a **new proposal** is saved for the first time (detected by absence of
previous save or by a `first_save` heuristic), automatically trigger the same
improvement pass and surface a non-blocking toast:

> "AI suggestions available — Review improvements"

Clicking the toast opens the diff overlay. The user can dismiss it and
continue editing — the suggestions remain available via the manual Improve
button until accepted or dismissed.

### 3. Backend: implement `fillProposal()` / `critiqueDocument()`

The dispatch module's `AIEngine` interface (`src/dispatch/ai.ts:18-19`) already
defines these methods. Both are currently stubs (`TODO`). This proposal
requires implementing them for the `OpenCodeEngine`:

- `fillProposal(fm, body)`: Given frontmatter and body, return an improved
  version. The AI should flesh out sparse sections, suggest missing frontmatter
  fields, and improve clarity — without changing the author's intent.
- `critiqueDocument(content)`: Return a structured critique identifying gaps,
  weak reasoning, missing sections, and improvement suggestions.

Both should be implemented via the OpenCode session API (matching the pattern
already used by `findSimilar()`).

### 4. API route

A new `/api/improve` endpoint:

```
POST /api/improve?path=proposals/my-proposal.md
→ { original: string, improved: string, critique: string }
```

The frontend receives both original and improved text, computes a client-side
diff, and presents it in the overlay.

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| `web-ui-ai-chat-panel` | Chat panel provides open-ended AI conversation. This provides a one-click inline improvement — faster for the common case, complementary to chat. |
| `multi-perspective-review-feature` | Second-opinion quick action is external critique. This is an inline improvement of the document itself. |
| `ux-new-proposal` | Guided creation form + validation. This picks up after creation, improving the raw content. |
| `dispatch/ai.ts` stubs | `fillProposal()` and `critiqueDocument()` are the natural backend hooks — currently unimplemented. |

## Out of Scope

- Grammar/style-only improvements (defer to general AI capability)
- Auto-accepting improvements without human review (governance principle: AI
  suggests, human decides)
- Batch-improving multiple proposals at once
- AI writing proposals from scratch (that is a separate flow)

## Future

- Configurable improvement prompt per profile (via `opencode-instructions.md`)
- Improve button for plans and docs after the proposal flow is proven
- Integration with the phase gate workflow ("Improve this gate readiness
  statement")
