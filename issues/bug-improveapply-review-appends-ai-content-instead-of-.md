---
title: Improve/apply-review appends AI content instead of replacing, producing duplicate section headers
status: proposal-linked
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
related:
  - plans/executor-panel-live-feedback.md
tags:
  - reported-bug
github_issue: 363
---

# Improve/apply-review appends AI content instead of replacing, producing duplicate section headers

> **Proposal-linked 2026-07-11** (backlog cleanup) → captured by `plans/executor-panel-live-feedback.md (Improve merge bug, #297)`. Not lost; will be delivered as part of that proposal/plan.


## Description

Running "Review" (which, per the plan's own Document History entry, records itself as "AI-improved via Review" and does write to the file -- it's not read-only despite src/webui/src/routes/api/plan-review/+server.ts itself only streaming SSE commentary, so there's a separate apply/write step somewhere in this flow) on plans/executor-panel-live-feedback.md produced a plan with:

1. Two "Testing Plan" headings back to back (`## Testing Plan` with a plain checklist, then `### Testing Plan` immediately after with a more detailed happy-path/edge-case version) -- the new AI-generated section was appended after the existing one instead of replacing it.
2. A duplicate empty `## Rollback Procedures` heading immediately followed by a second `## Rollback Procedures` heading that actually has the table under it.

Separately (filed as context, not part of this specific bug): the same AI pass invented implementation specifics that don't exist anywhere in the codebase (`src/session/poller.ts`, a `/api/session/{id}/metrics` endpoint, a `tokens_remaining` field) -- worth a look at whether the apply-review/improve prompt should be instructed to verify referenced files/APIs actually exist, or at least hedge language when it can't verify, rather than stating fabricated specifics as fact.

Reproduced live 2026-07-10. The plan was manually rewritten this session to fix both the duplication and the fabricated specifics (grounded in the real files, `src/executor/session.ts` and `src/executor/orchestrator.ts`, which turned out to already implement 2 of the plan's 3 steps).

## System Info

None provided
