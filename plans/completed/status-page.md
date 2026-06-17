---
title: "Status page — vault workflow dashboard"
status: completed
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - dashboard
  - home
proposal_source:
  - proposals/approved/ui-need-a-status-page-view-and-tool-skill.md
  - proposals/approved/404-redirect-to-status-page.md
priority: high
mode: mentor
assigned_to: NetYeti
scenario_synthesis: "UI prototype only — no automation scripts or deployment steps"
consumed_by: plans/plan-sub-plan-vault-write-api-movedocument-renamedocument-canonical-setfield.md
---

## Overview

Build a `/_status` home page that shows live vault workflow state — open
proposals, active plans, pending promotions — sourced entirely from the
filesystem with no AI tokens. Becomes the default landing page when no
document path is active.

## Tasks

### 1. API endpoint — GET /api/status

Scans lifecycle directories and returns structured JSON:

```json
{
  "proposals": {
    "open": [ { "path", "title", "created", "tags", "category", "complexity" } ],
    "approved_pending_plan": [ { ... } ]
  },
  "plans": {
    "active": [ { "path", "title", "status", "assigned_to", "priority" } ],
    "completed_count": 4
  },
  "deferred": [ { "path", "title" } ]
}
```

- Reads frontmatter only (gray-matter, already a dependency)
- Excludes `misc.md` and `phase-0-spike-decision.md` by name pattern
  (`deferred: true` or `phase-0` tag)
- No git calls, no AI — pure filesystem scan
- Response cached for 2s to handle rapid SSE refreshes gracefully

### 2. Route — src/webui/src/routes/_status/+page.svelte

Sections (each collapsible, last state in `sessionStorage`):

- **Open proposals** — table: title, category, complexity, created. Clicking
  navigates to the proposal.
- **Active plans** — table: title, status badge, priority, assigned_to.
- **Approved but no plan yet** — list with a "Create plan" affordance (future).
- **Completed** — count badge with a "Show" toggle (collapsed by default).
- **Deferred** — compact list, greyed out.

Each section header shows its item count in a badge.

### 3. Default redirect

- The root SvelteKit `+page.svelte` at `/` redirects to `/_status` when
  no document path is in the URL
- The layout preserves the current document URL so navigating back from a
  document returns to where the user was, not `/_status`

### 4. Live reload

The existing SSE endpoint (`/api/watch`) already fires on file changes.
The status page subscribes to it and calls `/api/status` to refresh on
any change event — no polling needed.

### 5. Claude Code /status skill

A `status` skill (`.claude/skills/status.md`) that shells out to the same
logic as `/api/status` and prints a plain-text summary to the terminal.
Useful for AI sessions to quickly assess the vault state without opening
the browser.

### 6. Smart 404 fallback (from proposals/approved/404-redirect-to-status-page.md)

**API: GET /api/find?name=slug**

Searches all lifecycle directories for a file whose stem matches `slug`
(case-insensitive, strips `.md`). Priority order: `proposals/` >
`proposals/approved/` > `plans/` > `plans/completed/` > `docs/`.
Returns `{ path: string } | { path: null }`.

**In +page.svelte 404 branch:**

Before rendering the error state, call `/api/find?name=<slug>`. If a match
is found, `goto(matchedPath, { replaceState: true })` — the move is invisible.
If no match, render an inline "Document not found" state (not a browser 404):
- Show the attempted slug
- "Go to status page" button → `/_status`
- "Create this document" button → pre-fills the new-file flow with the slug

### 7. Tests / verification

- Open proposal appears in Open section after creation
- Approving a proposal moves it to Approved-pending-plan section
- Creating a plan removes it from that section
- Completed plan count increments on plan completion
- SSE refresh updates the page without full reload
- `/status` skill output matches UI summary
