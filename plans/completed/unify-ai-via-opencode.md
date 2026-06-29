---
title: Unify AI Access via OpenCode — Single Provider Gateway
status: completed
completed_date: 2026-06-29
author: NetYeti
created: 2026-06-28
type: plan
tags:
  - ai
  - opencode
  - architecture
  - simplification
  - phase-4
proposal_source: proposals/approved/unify-ai-via-opencode.md
priority: medium
complexity: medium
automated: full
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
_path: plans/completed/unify-ai-via-opencode.md
total_steps: 8
completed_steps: 8
scenario_synthesis: "Happy path: opencodeComplete() helper replaces callOlla() in all three routes; plan-review, apply-review, and synthesize use whichever model OpenCode has selected; OLLA_* env vars removed. Failure path: OpenCode unreachable — routes return a clear error rather than a silent AI failure; OPENCODE_DEFAULT_MODEL fallback pins a safe model when the picker has no selection."
---

# Unify AI Access via OpenCode — Single Provider Gateway

## Overview

All AI calls (plan-review, apply-review, synthesize) now route through OpenCode's
session API via the `opencodeComplete()` helper. OLLA_* env vars removed. The
`/api/config` endpoint exposes `aiGateway` info for the UI model badge.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Survey `/api/improve` session pattern | Session API: POST /session → id, POST /session/:id/message → parts[type=text] | ✅ Done |
| 2 | Add `ANTHROPIC_API_KEY` to OpenCode's environment | Launcher sources src/webui/.env before opencode serve | ✅ Done |
| 3 | Create `src/webui/src/lib/server/opencode-complete.ts` | Thin async helper wrapping OpenCode session API | ✅ Done |
| 4 | Rewrite `plan-review/+server.ts` | Uses opencodeComplete() + doc-reviewer role | ✅ Done |
| 5 | Rewrite `apply-review/+server.ts` | Uses opencodeComplete() + doc-improver role | ✅ Done |
| 6 | Rewrite `synthesize/+server.ts` | Uses opencodeComplete() | ✅ Done |
| 7 | Remove `OLLA_*` from `.env` and `.env.example` | No OLLA_ refs remain in src/webui/src/ ✅ | ✅ Done |
| 8 | Update `/api/config` + smoke tests | Returns aiGateway object; synthesize verified working ✅ | ✅ Done |

## Testing Plan

### Step Verification

- [x] Step 1: Pattern documented; `/api/improve` session flow understood
- [x] Step 2: OpenCode model picker shows Claude models after env update
- [x] Step 3: `opencodeComplete()` returns text for a simple prompt
- [x] Step 4: Plan review panel produces output; no `OLLA_*` refs in file
- [x] Step 5: Apply review runs end-to-end on a plan; no `OLLA_*` refs in file
- [x] Step 6: Synthesize returns a synthesis string ✅ verified live
- [x] Step 7: `grep -r OLLA_ src/webui/src/` returns nothing ✅
- [x] Step 8: `/api/config` returns `aiGateway` object ✅ verified live

### Integration & Regression

- [x] Existing e2e suite — no regressions in AI routes
- [x] TypeScript compiles cleanly
- [x] Chat panel and plan execution unaffected

### Gate Criteria

- [x] `tests_defined` set to `true` in frontmatter
- [x] Human reviewer has verified step outcomes above
- [x] No regressions in chat, improve, or plan-execution flows

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-28/29 | All 8 steps complete. Synthesize, /api/config, and no-OLLA_ verified. | NetYeti |
