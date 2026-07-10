---
title: "Deferred: External AI Watcher Presence Indicator in Web UI"
author: NetYeti
author-role: contributor
created: 2026-06-17
tags:
  - webui
  - ux
  - monitoring
  - sse
complexity: low
estimated_effort: S
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - plans/completed/plan-script-skill-docwright-adopt-initialize-docwright-on-existing-vaults.md
milestone: backlog
consumed_by: plans/live-ai-visibility-event-relay.md
---

> **Consumed 2026-07-10** by live-ai-visibility step 3.6: the toolbar presence
> chip (`/api/ai/presence`, ownership-filtered bus tap) delivers this — busy/idle
> visibility of AI activity across the user's sessions, including other tabs/agents.


## Problem

When BigPickle (or any AI) is executing a long-running automated plan, the human watching the Web UI has no signal that an external watcher (e.g. Claude Code monitoring the session) is active. The UI shows the plan running but gives no reassurance that someone is watching for problems.

## Proposed Solution

File-based presence using the existing SSE watch infrastructure:

1. **Monitor writes `.dw-watcher.json`** every 30s at vault root:
   ```json
   { "watcher": "Claude Code", "since": "2026-06-17T01:08:00Z", "updated": "2026-06-17T01:09:30Z" }
   ```

2. **SSE handler** (`/api/watch`) already broadcasts file change events — add `.dw-watcher.json` to the watch list and emit a `watcher` event when it changes.

3. **Web UI** shows a small "👁 Claude Code is watching" badge in the plan execution panel. Badge turns grey if the file hasn't been updated in >60s (watcher went silent).

4. **Cleanup**: `.dw-watcher.json` is gitignored. Monitor deletes or stops updating it when done.

## Why deferred

Low priority relative to active plan work. The file-based approach is clean and self-contained — no new API endpoints. Revisit in Phase 2 UI polish pass.
