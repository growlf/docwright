---
title: "Git controls panel in the Web UI"
status: completed
completed_date: 2026-06-03
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - git
  - workflow
proposal_source:
  - proposals/approved/ui-git-controlls.md
priority: medium
automated: off
assigned_to: NetYeti
scenario_synthesis: "UI prototype only — no automation scripts or deployment steps in plan tasks; git operations are the subject of the feature, not the build process"
---

## Overview

Add a collapsible git status panel to the sidebar footer showing live repo
state (modified/staged/untracked, branch, ahead/behind) with Stage, Commit,
Push, and Tag actions. All git operations run through the server to avoid
exposing credentials or shell access to the browser.

## Tasks

### 1. API endpoints

| Endpoint | Method | Body | Returns |
|----------|--------|------|---------|
| `/api/git/status` | GET | — | `{ branch, modified[], staged[], untracked[], ahead, behind }` |
| `/api/git/commit` | POST | `{ message }` | `{ sha, message }` or error |
| `/api/git/push` | POST | — | `{ ok }` or error |
| `/api/git/tag` | POST | `{ name, message? }` | `{ tag }` or error |

- All endpoints use `simple-git` (add as dependency) or `child_process` exec
- `/api/git/commit` runs the pre-commit and commit-msg hooks via
  `git commit` (not bypassed); the message is validated server-side before
  shell execution to prevent injection
- `/api/git/push` streams progress lines back as newline-delimited JSON for
  the inline log panel
- All mutations return structured errors with a `hint` field (e.g. "nothing
  to commit", "rejected — non-fast-forward")

### 2. Git status panel component

`src/webui/src/lib/GitPanel.svelte` — rendered in the sidebar below the
file tree, collapsed by default.

**Header (always visible when collapsed):**
- Branch name + ahead/behind badge
- Dot indicator: green = clean, amber = unstaged changes, red = conflicts

**Expanded panel:**
- File counts: Modified N · Staged N · Untracked N
- Collapsible file lists per category (clicking a file navigates to it)
- Action row: **Stage all** · **Commit** · **Push** · **Tag**
- Inline log area: shows last operation output, auto-clears after 10s

**Commit flow:**
- Click Commit → input appears with placeholder `<type>: <description>`
- Client validates format before sending (same regex as commit-msg hook)
- On success: log shows SHA + message, file counts reset
- On hook failure: log shows hook output verbatim so user can fix and retry

**Tag flow:**
- Click Tag → dropdown (patch / minor / release) + editable name field
  pre-filled with the computed next semver tag
- Annotated tag; pushed immediately after creation

### 3. Semver tag auto-computation

`GET /api/git/status` includes `latestTag` in its response (from `git describe
--tags --abbrev=0`). The panel computes the three bump options client-side and
pre-fills the name field with the patch bump as default.

### 4. Refresh cadence

- Panel refreshes status on open and after each successful action
- Subscribes to the SSE watch stream — refreshes on any file-change event
  (catches external edits and saves from the document editor)

### 5. Tests / verification

- Status shows correct counts after editing a file
- Commit flow: valid message succeeds, invalid format shows client-side error,
  hook failure surfaces hook output
- Push greyed out when ahead=0; active when ahead>0
- Tag: semver computation correct for patch/minor/release bumps
- Injection guard: message with shell metacharacters rejected with 400
