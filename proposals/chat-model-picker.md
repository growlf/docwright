---
complexity: low
title: "Model / Provider Picker in Chat Panel"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - chat
  - providers
  - improvements
deferred: true
deferred_reason: "OpenCode handles model selection natively. Expose as a convenience in DocWright UI post-MVP."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/web-ui-ai-chat-panel.md
---

## Problem

The DocWright chat panel's health indicator shows the active model (from
`GET /global/config`) but does not allow changing it. Switching providers
requires opening a separate opencode configuration. For contributors who
want to switch between a fast local model (Ollama/Meshy) for quick tasks
and a more capable remote model (Claude, GPT-4) for complex analysis, this
is a friction point.

## Proposed Solution

A model picker dropdown in the chat panel header, populated from
`GET /v2/provider` and `GET /v2/model`. Selecting a model updates the
active session's model preference via the OpenCode API.

A per-vault default model can be set in `opencode.json` so contributors
don't have to re-select on every session.

## Deferred Because

OpenCode already provides full model management. The MVP panel inherits
whatever model is currently configured. The picker is a convenience
improvement after the base panel is in daily use.
See [[proposals/web-ui-ai-chat-panel.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from web-ui-ai-chat-panel proposal | NetYeti |
