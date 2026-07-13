---
type: issue
status: resolved
created: 2026-07-07
author: NetYeti
author-role: user
category: bug
priority: high
complexity: low
estimated_effort: XS
tags: [webui, api, configuration]
reported_dates: [2026-07-07]
demand_count: 1
triage_date: 2026-07-07
triage_by: NetYeti
triage_notes: Configuration issue - environment variable missing from dev server startup.
scope_check_date: 2026-07-07
scope_check_by: NetYeti
scope_assessment: Simple fix - set environment variable and restart.
scope_decision: in-scope
assigned_to: []
created_by: NetYeti@cluster-llm
channel: dev
resolution: OPENCODE_URL set to http://localhost:4096 in vite dev environment
github_issue: 369
---

# Bug: Plan execute endpoint returns 503 — OPENCODE_URL not configured

## Description

Clicking "Start" button on a plan in the UI returns error:
```
/api/plan-execute:1  Failed to load resource: the server responded with a status of 503 (Service Unavailable)
```

With response body:
```json
{"error": "OPENCODE_URL not configured"}
```

## Root Cause

The `/api/plan-execute` endpoint requires `OPENCODE_URL` environment variable to connect to the OpenCode AI backend for plan orchestration. The vite dev server was started without this variable set.

Code check (src/webui/src/routes/api/plan-execute/+server.ts, lines 54-58):
```typescript
if (!OPENCODE_URL) {
  return new Response(JSON.stringify({ error: 'OPENCODE_URL not configured' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Solution

1. Identified that OpenCode backend is running at `localhost:4096`
2. Restarted vite dev server with environment variable:
   ```bash
   OPENCODE_URL=http://localhost:4096 npm run dev
   ```

## Verification

```bash
curl -X POST http://localhost:5173/api/plan-execute \
  -H "Content-Type: application/json" \
  -d '{"path": "plans/implement-consumed-issues-visibility.md"}'
```

Returns:
```
event: done
data: {"message":"No Implementation Steps found in plan."}
```

✓ Endpoint now responds with 200 OK
✓ Message indicates missing steps (expected for plans without formal step table)

## Note

The dev server process must be restarted whenever it stops. For persistent deployment, `OPENCODE_URL` should be set in:
- Docker environment variables (docker-compose.yml or .env)
- Systemd service file
- CI/CD environment configuration
