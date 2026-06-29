---
title: Unify AI Access via OpenCode — Single Provider Gateway
author: NetYeti
created: 2026-06-28
tags:
  - ai
  - opencode
  - architecture
  - simplification
  - phase-4
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
priority: medium
---
## Problem

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

## Proposed Solution

**Route all OLLA-based calls through OpenCode's session API**, so OpenCode becomes
the single AI gateway. Provider selection (Anthropic, local Ollama, Meshy, etc.)
is then controlled entirely in OpenCode's model picker, and every AI feature draws
from the same configured provider.

### How it works

OpenCode does **not** expose an OpenAI-compatible `/v1/chat/completions` endpoint —
it uses a session-based API (`POST /session`, then stream events). The OLLA routes
currently make single-turn completions. To unify, the OLLA routes need to be
rewritten to use OpenCode's session API for single-turn calls:

1. Create a short-lived OpenCode session with the appropriate model
2. Send the prompt as a user message
3. Stream/collect the response
4. Discard the session

This is exactly the pattern `src/webui/src/lib/server/improve.ts` already implements
for the `/api/improve` endpoint. The three OLLA routes (plan-review, apply-review,
synthesize) would adopt the same utility function, consolidating all AI calls into a
single code path.

OpenCode session creation accepts a `model` parameter — when omitted, the session
uses the model currently selected in the OpenCode UI. The OLLA replacement calls will
omit this parameter by default, making the review features respond to model changes
in the UI automatically.

### Provider configuration

Add the Anthropic API key to OpenCode's config so it can use Claude as a provider:

- Set `ANTHROPIC_API_KEY` in the environment where OpenCode launches (e.g., shell
  profile, systemd unit, or the same `.env` source that already provides `OPENAI_API_KEY`
  for local models)
- OpenCode auto-detects the `ANTHROPIC_API_KEY` environment variable and makes
  `claude-*` models available in its model picker alongside existing local models

This means a single API key in one place (shell env / `.env` sourced by the launcher)
covers both the interactive chat panel and all review/synthesis features. Rotating the
key requires exactly one change.

### `.env` simplification

After this change, `OLLA_BASE`, `OLLA_MODEL`, and `OLLA_API_KEY` are removed from
`src/webui/.env` (and `.env.example`). The only AI configuration variables are:

- `OPENCODE_URL=http://localhost:4096` — already used for chat, now the sole AI gateway
- `OPENCODE_DEFAULT_MODEL` (optional) — pins which model the OLLA-replacement calls use
  when no model is selected in the OpenCode UI; falls back to OpenCode's currently
  selected model if unset

## Out of Scope

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

## Alternatives Considered

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

## Implementation Steps (sketch)

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

## Future

- `OPENCODE_DEFAULT_MODEL` env var lets operators pin the review model independently
  of what's selected in the interactive chat.
- The model indicator proposal (`ai-model-indicator-ui`) becomes simpler: one badge,
  one source of truth.
- If OpenCode later adds an OpenAI-compatible proxy endpoint, the session-based utility
  can be swapped for a simpler HTTP client without changing the calling routes.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | AI-improved via Improve | NetYeti |
