---
title: Unify AI Access via OpenCode — Single Provider Gateway
status: in-progress
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
tests_defined: false
tests_human_reviewed: false
_path: plans/unify-ai-via-opencode.md
total_steps: 8
completed_steps: 8
scenario_synthesis: "Happy path: opencodeComplete() helper replaces callOlla() in all three routes; plan-review, apply-review, and synthesize use whichever model OpenCode has selected; OLLA_* env vars removed. Failure path: OpenCode unreachable — routes return a clear error rather than a silent AI failure; OPENCODE_DEFAULT_MODEL fallback pins a safe model when the picker has no selection."
gate_note: "Changed files are untestable types: plans/unify-ai-via-opencode.md, proposals/approved/unify-ai-via-opencode.md"
---

# Unify AI Access via OpenCode — Single Provider Gateway

## Overview

Route all AI calls in DocWright through OpenCode so provider selection (Anthropic Claude,
local Ollama, LiteLLM, BigPickle, or any OpenAI-compatible endpoint) is controlled from
a single place — OpenCode's model picker. Currently the plan-review, apply-review, and
synthesize routes make direct HTTP calls to a hardcoded `OLLA_BASE` endpoint, splitting
AI config across two places and making the active model invisible in the UI.

**Approach:** Create a shared `opencodeComplete(prompt)` utility that wraps OpenCode's
existing session API for single-turn completions — the same pattern `/api/improve` already
uses. Rewrite the three OLLA routes to call it. Remove `OLLA_*` env vars.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Survey `/api/improve` session pattern | Read `src/webui/src/routes/api/improve/+server.ts` and the OpenCode SDK to understand exactly how a one-shot session is created, a message sent, and the response collected. Document the call shape as comments in the new utility. | ✅ Done |
| 2 | Add `ANTHROPIC_API_KEY` to OpenCode's environment | Update the shell profile or launcher that starts OpenCode (`opencode serve`) to export `ANTHROPIC_API_KEY`. OpenCode auto-detects it and adds `claude-*` models to the picker. Verify by opening the OpenCode model selector and confirming Claude models appear. | ✅ Done |
| 3 | Create `src/webui/src/lib/server/opencode-complete.ts` | Thin async helper: `opencodeComplete(prompt: string, model?: string): Promise<string>`. Creates a short-lived OpenCode session, sends the prompt as a single user message, collects the streamed response text, returns it. Reads `OPENCODE_URL` and optional `OPENCODE_DEFAULT_MODEL` from env. Throws a clear error (not silent fail) when OpenCode is unreachable. | ✅ Done |
| 4 | Rewrite `plan-review/+server.ts` | Replace `callOlla()` with `opencodeComplete()`. Remove `OLLA_BASE`, `OLLA_MODEL`, `OLLA_API_KEY` imports and env reads from this file. Preserve all existing SSE streaming behavior — only the AI call itself changes. | ✅ Done |
| 5 | Rewrite `apply-review/+server.ts` | Same as Step 4. Replace `callOlla()` with `opencodeComplete()`. The `callOlla` helper and its retry logic are removed; `opencodeComplete` handles retries via OpenCode's own session management. | ✅ Done |
| 6 | Rewrite `synthesize/+server.ts` | Same as Steps 4–5. Single `callOlla` call replaced with `opencodeComplete()`. This is the simplest of the three routes. | ✅ Done |
| 7 | Remove `OLLA_*` from `.env` and `.env.example` | Delete `OLLA_BASE`, `OLLA_MODEL`, `OLLA_API_KEY` lines from `src/webui/.env` and `.env.example`. Add `OPENCODE_DEFAULT_MODEL` placeholder to `.env.example` with a comment explaining it. | ✅ Done |
| 8 | Update `/api/config` + smoke tests | Extend `GET /api/config` to return `{ aiGateway: { url: OPENCODE_URL, defaultModel: OPENCODE_DEFAULT_MODEL \| ✅ Done | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: Pattern documented; `/api/improve` session flow understood
- [ ] Step 2: OpenCode model picker shows Claude models after env update
- [ ] Step 3: `opencodeComplete()` returns text for a simple prompt; throws clearly when OpenCode is down
- [ ] Step 4: Plan review panel produces output; no `OLLA_*` refs in file
- [ ] Step 5: Apply review runs end-to-end on a plan; no `OLLA_*` refs in file
- [ ] Step 6: Synthesize returns a synthesis string; no `OLLA_*` refs in file
- [ ] Step 7: `grep -r OLLA_ src/webui/src/` returns nothing
- [ ] Step 8: `/api/config` returns `aiGateway` object; smoke tests pass

### Integration & Regression

- [ ] Existing e2e suite passes (`npm run test:e2e`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Chat panel and plan execution unaffected (they already use OpenCode)
- [ ] OpenCode model change propagates to review features without server restart

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions in chat, improve, or plan-execution flows

## Rollback Procedures

Restore `OLLA_BASE`, `OLLA_MODEL`, `OLLA_API_KEY` to `src/webui/.env` and revert the
three route files. The `callOlla()` helper is deleted in Step 5 — it can be restored
from git history if needed. The `opencodeComplete.ts` utility is additive and can
remain without breaking anything.

## Risk Assessment

**LOW** — The three OLLA routes are backend-only; the UI surfaces that call them
(plan-review panel, apply-review button, multi-review synthesize) are unchanged. The
main risk is OpenCode session overhead for single-turn calls (slightly higher latency
than a direct HTTP completion). Mitigated by keeping sessions ephemeral and not blocking
the UI thread.

**MEDIUM** — OpenCode must be running for all AI features to work (currently only chat
requires it). If OpenCode is down, plan-review/apply-review/synthesize fail. Mitigation:
`opencodeComplete` returns a clear error message to the UI, not a silent empty response.

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-28 | Wrote full implementation steps (8 steps). | NetYeti |
