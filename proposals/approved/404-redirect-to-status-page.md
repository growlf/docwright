---
title: "404 — smart fallback for moved and missing documents"
author: NetYeti
created: 2026-06-03
tags:
  - ux
  - navigation
  - routing
category:
  - UX
complexity: S
estimated_effort: S
depends_on:
  - status-page
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
consumed_by: plans/completed/status-page.md
---
## Problem

404 responses are jarring and lose context. Two distinct cases cause them:

1. **Document moved** — approving a proposal moves it from `proposals/foo.md`
   to `proposals/approved/foo.md`. Any bookmark, browser history, or wikilink
   pointing to `/proposals/foo` now 404s silently, even though the file exists.

2. **Truly missing page** — a URL that was never valid, or a document that
   was deleted, shows a raw browser 404 with no way forward.

## Proposed Solution

### Case 1 — Moved document: search before failing

When the page component gets a 404 from `/api/read`, before showing an error,
call a new `GET /api/find?name=<slug>` endpoint that searches all lifecycle
directories (`proposals/`, `proposals/approved/`, `plans/`, `plans/completed/`,
`docs/`) for a file whose stem matches the slug.

- If a match is found, automatically navigate to the correct path via `goto()`
  with `replaceState: true` (no extra browser history entry).
- If multiple matches exist (unlikely), navigate to the highest-priority one
  (active > approved > completed).
- This makes lifecycle transitions invisible to the user — URLs just work.

### Case 2 — Truly missing: graceful fallback page

If `/api/find` returns no match, render an inline "Document not found" state
within the content area (not a browser-level 404):

- Show the slug that was attempted
- A "Go to status page" button linking to `/_status`
- A "Create this document" button that pre-fills the new-file flow with the
  attempted slug as the filename

This keeps the user in the app with a clear path forward rather than a dead end.

### Implementation notes

`GET /api/find?name=<slug>` scans the filesystem (same REPO_ROOT pattern as
other endpoints). The stem match is case-insensitive and strips `.md`.
Response: `{ path: string } | { path: null }`.

This is a small, self-contained change: one new API endpoint, a few lines
added to the 404 branch in `+page.svelte`, and a simple fallback UI.
Folds naturally into the status-page plan as an additional task.
