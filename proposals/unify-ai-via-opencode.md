---
title: "Unify AI Access via OpenCode — Single Provider Gateway"
author: NetYeti
created: 2026-06-28
tags:
  - ai
  - opencode
  - architecture
  - simplification
  - phase-4
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: medium
---

## Problem

DocWright currently has two separate AI call paths:

1. **OpenCode** (`localhost:4096`) — chat, plan execution, proposal improve. Provider
   and model selected in the OpenCode UI (currently `big-pickle` / local stack).

2. **Direct Anthropic API** (`OLLA_BASE=https://api.anthropic.com/v1`) — plan-review,
   apply-review, synthesize. Hardcoded to whatever `OLLA_MODEL` is set to in `.env`.

This split creates three problems:
- Two sets of credentials to manage (OpenCode provider config + `OLLA_API_KEY`)
- No unified model selection — changing the AI in OpenCode has no effect on review features
- No single place to see "what model is DocWright using right now"

## Proposed Solution

**Route all OLLA-based calls through OpenCode's session API**, so OpenCode becomes
the single AI gateway. Provider selection (Anthropic, local Ollama, Meshy, etc.)
is then controlled entirely in OpenCode's model picker.

### How it works

OpenCode does **not** expose an OpenAI-compatible `/v1/chat/completions` endpoint —
it uses a session-based API (`POST /session`, then stream events). The OLLA routes
currently make single-turn completions. To unify, the OLLA routes need to be
rewritten to use OpenCode's session API for single-turn calls:

1. Create a short-lived OpenCode session with the appropriate model
2. Send the prompt as a user message
3. Stream/collect the response
4. Discard the session

This is essentially what `/api/improve` already does. The three OLLA routes
(plan-review, apply-review, synthesize) would adopt the same pattern.

### Provider configuration

Add the Anthropic API key to OpenCode's config so it can use Claude as a provider:
- Update `ANTHROPIC_API_KEY` in the environment where OpenCode launches
- OpenCode auto-detects the Anthropic provider and makes `claude-*` models available
  in its model picker alongside the existing local models

This means a single API key in one place (shell env / `.env` sourced by the launcher)
covers both the chat panel and all review features.

### `.env` simplification

After this change, `OLLA_BASE`, `OLLA_MODEL`, and `OLLA_API_KEY` are removed from
`src/webui/.env`. The only AI config is `OPENCODE_URL=http://localhost:4096` plus
an optional `OPENCODE_DEFAULT_MODEL` env var to set which model the OLLA-replacement
calls use (falling back to OpenCode's currently selected model).

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
   a one-shot OpenCode session, sends a prompt, returns the text response
3. Rewrite `plan-review/+server.ts`, `apply-review/+server.ts`, `synthesize/+server.ts`
   to use `opencodeComplete()` instead of `callOlla()`
4. Remove `OLLA_BASE`, `OLLA_MODEL`, `OLLA_API_KEY` from `.env` and `.env.example`
5. Update `/api/config` to return the active OpenCode model so the UI badge works

## Future

- `OPENCODE_DEFAULT_MODEL` env var lets operators pin the review model independently
  of what's selected in the interactive chat.
- The model indicator proposal (`ai-model-indicator-ui`) becomes simpler: one badge,
  one source of truth.
