---
title: "Need a status page/view and tool/skill"
author: NetYeti
created: 2026-06-02
tags:
  - ui
  - dashboard
  - home
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
consumed_by: plans/completed/status-page.md
---
## Problem

The primary/default/home entry page when DocWright starts up should be a status page of current workflows (proposals, plans, projects, etc). This should be an expandable hierarchy view with the last visited one expanded (per user experience). This should not be a heavy drain on resources and should be something that is done via code as much as is possible for fast response that is still accurate and current. If at all possible, this should be something that only uses tokens rarely, if at all.

## Proposed Solution

**A dedicated `/_status` route** served by a new SvelteKit page that reads vault state from the filesystem — no AI tokens required.

**What it shows:**
- Open proposals (files in `proposals/` where `approved: false`)
- Active plans (files in `plans/` where `status: approved` or `in-progress`)
- Completed plans (count only, with a "show" toggle — collapsed by default)
- Approved proposals pending promotion (files in `proposals/approved/` with no matching plan)
- Open issues / inbox items if those directories exist

Each section is a collapsible group. The last-expanded section is stored in `sessionStorage` so it reopens where the user left it.

**Implementation:**
- New `GET /api/status` endpoint: scans the lifecycle directories, reads frontmatter for each `.md` file, returns a structured JSON summary. Pure filesystem — no git, no AI.
- New `src/webui/src/routes/_status/+page.svelte` renders the summary.
- The layout's root `/` redirect (or the SvelteKit `+page.svelte` at `/`) navigates to `/_status` when no path is active.
- SSE live-reload already in place will refresh the status page when files change.

**Claude Code skill:** A `/status` skill that prints the same summary to the terminal for use during development sessions.
