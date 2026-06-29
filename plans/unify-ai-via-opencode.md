---
title: Unify AI Access via OpenCode — Single Provider Gateway
status: approved
author: NetYeti
created: 2026-06-29
tags:
  - ai
  - opencode
  - architecture
  - simplification
  - phase-4
proposal_source: proposals/approved/unify-ai-via-opencode.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/unify-ai-via-opencode.md
---

# Unify AI Access via OpenCode — Single Provider Gateway

## Overview

_Plan generated from approved proposal: Unify AI Access via OpenCode — Single Provider Gateway_

### Problem

DocWright currently has two separate AI call paths:

1. **OpenCode** (`localhost:4096`) — chat, plan execution, proposal improvement. Provider
   and model selected in the OpenCode UI (currently `big-pickle` / local stack).

2. **Direct Anthropic API** (`OLLA_BASE=https://api.anthropic.com/v1`) — plan-review,
   apply-review, synthesize. Hardcoded to whatever `OLLA_MODEL` is set to in `.env`.

This split creates four concrete problems:

- **Two sets of credentials** — OpenCode provider config must be kept in sync with
  `OLLA_API_KEY`. Rotating the Anthropic key means updating two places, and there is
  no automated check for drift between them.
- **No unified model selection** — changing the model in OpenCode's picker has no
  effect on the three OLLA review routes. The reviewer runs on a different model than
  the chat panel, producing inconsistent critique quality and tone across features.
- **No single source of truth** — to answer "what model is DocWright using right now,"
  an operator must check the OpenCode UI *and* read `OLLA_MODEL` from `.env`. There is
  no runtime endpoint that reports the active model for all AI features.
- **Duplicate maintenance surface** — every new AI feature that needs model access
  must either integrate with OpenCode or wire up its own `OLLA_*` env vars. The current
  split doubles the integration surface area for each new feature.

### Out of Scope

- **Modifying OpenCode's session API** — the rewrite is entirely within DocWright's
  OLLA routes. OpenCode's existing session interface is used as-is.
- **Adding an OpenAI-compatible endpoint to OpenCode** — not required; the session API
  already supports programmatic single-turn usage as demonstrated by `/api/improve`.
- **Rewriting the chat panel** — the interactive chat in the sidebar continues to talk
  directly to OpenCode via its existing SSE-based session. Only the three backend-only
  OLLA routes are migrated.
- **Support for multiple concurrent AI providers** — the gateway is a single provider
  at a time, controlled by OpenCode's model picker. Multi-provider orchestration
  (e.g., routing different features to different models) is a future concern.
- **Migration of `OLLA_API_KEY` values** — operators must copy their Anthropic key from
  `.env` to OpenCode's environment manually as part of this change. No automated secret
  transfer is included.
- **Metrics or observability on AI calls** — the rewrite does not introduce logging,
  tracing, or usage tracking on the gateway path. That belongs in a separate proposal.

### Alternatives Considered

**Keep the two-path architecture but add a model selector for OLLA routes** — valid,
but increases complexity rather than reducing it. Two credential stores, two UI
surfaces, two places to debug.

**Point `OLLA_BASE` at OpenCode's API** — impossible; OpenCode doesn't expose an
OpenAI-compatible completion endpoint. It would require OpenCode to add that surface.

**Use Meshy as the unified proxy** — Meshy already provides OpenAI-compatible access
to multiple providers including Anthropic. Could set `OLLA_BASE=http://meshy-host/v1`
and keep the current OLLA architecture with zero code changes, just a config update.
Simpler short-term, but still leaves the chat panel using a separate code path from
the review features. Deferred as a faster option if the session-API rewrite is too large.

### Implementation Steps (sketch)

1. Add `ANTHROPIC_API_KEY` to OpenCode's environment (shell profile or launcher script)
2. Create `src/webui/src/lib/server/opencode-complete.ts` — thin helper that creates
   a one-shot OpenCode session, sends a prompt, returns the text response. Modeled on
   the existing `improve.ts` and extracted as a shared utility.
3. Rewrite `plan-review/+server.ts`, `apply-review/+server.ts`, `synthesize/+server.ts`
   to use `opencodeComplete()` instead of `callOlla()`. Each route drops its `OLLA_*`
   imports and env reads.
4. Remove `OLLA_BASE`, `OLLA_MODEL`, `OLLA_API_KEY` from `.env` and `.env.example`.
5. Update `/api/config` to return the active OpenCode model so the UI badge works.
6. Add a smoke test (`npm run test:ai-gateway` or similar) that exercises each of the
   three rewritten routes with a known prompt and verifies a non-error response.

### Future

- `OPENCODE_DEFAULT_MODEL` env var lets operators pin the review model independently
  of what's selected in the interactive chat.
- The model indicator proposal (`ai-model-indicator-ui`) becomes simpler: one badge,
  one source of truth.
- If OpenCode later adds an OpenAI-compatible proxy endpoint, the session-based utility
  can be swapped for a simpler HTTP client without changing the calling routes.

### Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | AI-improved via Improve | NetYeti |


## Implementation Steps

| 1 | Create a short-lived OpenCode session with the appropriate model | | ⏳ Pending |
| 2 | Send the prompt as a user message | | ⏳ Pending |
| 3 | Stream/collect the response | | ⏳ Pending |
| 4 | Discard the session | | ⏳ Pending |

## Testing Plan

_Testing plan TBD_

## Rollback Procedures

_Rollback procedures TBD_

## Risk Assessment

_Risk assessment TBD_

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-29 | Created from approved proposal | NetYeti |
