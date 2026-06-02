---
title: "Git controls"
author: NetYeti
created: 2026-06-02
tags:
  - ui
  - git
  - workflow
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---
## Problem

When I am working in DocWright, I want to be able to see the current local status of the git versioning for the files and be able to manually trigger a commit, push, or tagging. The tagging should largely be done by configurable policy, but by default be a semantic style `v[release].[minor].[patch]`. The tagging is frequently used for things like CI/CD workflow automation.

## Proposed Solution

**A git status panel** in the sidebar footer (collapsible, below the file tree) showing live repo state, with action buttons.

**Status display:**
- Count of modified, staged, and untracked files
- Current branch name
- Ahead/behind count vs. origin (cached — refreshed on panel open and after each action)

**Actions:**
- **Stage all** — stages all tracked changes (`git add -u`)
- **Commit** — opens an inline text input for the commit message, enforces the `<type>: <description>` format before sending, then calls `POST /api/git/commit`
- **Push** — `POST /api/git/push`; button is greyed out if nothing is ahead of origin
- **Tag** — `POST /api/git/tag` with `{ name }`. Default name is auto-generated from policy (semver bump type selectable via dropdown: patch/minor/release). Tag is annotated and pushed immediately.

**Backend endpoints (new):**
- `GET /api/git/status` — returns `{ modified, staged, untracked, branch, ahead, behind }`
- `POST /api/git/commit` — `{ message }`, runs the pre-commit + commit-msg hooks
- `POST /api/git/push`
- `POST /api/git/tag` — `{ name, message? }`

Uses `simple-git` (already a common dep) or shells out to git. All operations stream stdout/stderr back as a toast or inline log panel so the user sees what happened.

**Policy hook (deferred):** Tag naming policy will be configurable in `profile.json` in Phase 2. For now, the UI offers the semver dropdown with manual override.
