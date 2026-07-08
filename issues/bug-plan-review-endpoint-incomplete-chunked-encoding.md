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
tags: [webui, api, streaming]
reported_dates: [2026-07-07]
demand_count: 1
triage_date: 2026-07-07
triage_by: NetYeti
triage_notes: Root cause identified - OPENCODE_URL not configured in dev environment.
scope_check_date: 2026-07-07
scope_check_by: NetYeti
scope_assessment: Simple environment configuration issue.
scope_decision: in-scope
assigned_to: []
created_by: NetYeti@cluster-llm
channel: dev
resolution: OPENCODE_URL set to http://localhost:4096 in vite dev environment
---

# Bug: Plan review endpoint returns ERR_INCOMPLETE_CHUNKED_ENCODING

## Description

Clicking "Review" button on a plan in the UI fails with network error:
```
/api/plan-review:1  Failed to load resource: net::ERR_INCOMPLETE_CHUNKED_ENCODING
```

## Root Cause

The `/api/plan-review` endpoint streams responses via Server-Sent Events (SSE) using `opencodeComplete()`, which requires `OPENCODE_URL` environment variable. The vite dev server was running without this variable set, causing the OpenCode API calls to fail silently and return incomplete/malformed streaming responses.

## Solution

Added `OPENCODE_URL=http://localhost:4096` to the vite dev server environment and restarted.

The endpoint code (src/webui/src/routes/api/plan-review/+server.ts) correctly handles the underlying failure by catching exceptions and sending error events, but the incomplete streaming response manifest as chunked encoding errors on the client side.

## Verification

```bash
curl -X POST http://localhost:5173/api/plan-review \
  -H "Content-Type: application/json" \
  -d '{"path": "plans/implement-consumed-issues-visibility.md"}'
```

Returns:
```
event: status
data: {"message":"Extracting plan sections..."}
event: overview
data: {...full review response...}
event: done
```

✓ Endpoint now streams properly
