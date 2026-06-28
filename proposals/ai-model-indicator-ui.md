---
title: "AI Model Indicator — Show Which Model Powers Each Feature"
author: NetYeti
created: 2026-06-28
tags:
  - ui
  - ai
  - transparency
  - ux
  - phase-4
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: medium
---

## Problem

DocWright currently uses two separate AI backends — OpenCode (chat, plan execution,
improve) and direct Anthropic API calls (plan-review, apply-review, synthesize) —
with no UI indication of which model is handling a given feature. Users have no way
to know what AI is responding, which makes debugging AI quality issues difficult and
trust in the governance trail harder to establish.

This gap also means that when the AI backend is changed or misconfigured, there is
no immediate feedback — a feature just silently degrades or fails.

## Proposed Solution

Add a small, persistent model badge to each AI-powered UI surface showing the active
model name. Surfaces to cover:

1. **Chat panel** — badge in the header or toolbar showing `OpenCode / <model-name>`.
   Already partially possible since the model picker exists; make the selected model
   always visible even when the picker is closed.

2. **Plan review panel** — badge near the "Run Review" button showing the inference
   model (`claude-haiku-4-5` or whatever `OLLA_MODEL` is set to). Could be a small
   `ⓘ` chip that expands on hover to show `OLLA_BASE + OLLA_MODEL`.

3. **Status page / governance VC** — a single line in the profile sub-view showing
   the configured AI backends (OpenCode URL + inference model).

The badge should degrade gracefully: show `—` if the backend is unreachable, not
an error state.

## Implementation Notes

- `/api/config` already returns `vaultRoot`; extend it to return `aiBackend:
  { opencodeUrl, ollaBase, ollaModel }` (never expose the key itself).
- The plan review panel already has `prs` (status string) — the model name can
  live alongside it.
- This becomes a quick win if the OLLA routes are unified under OpenCode (see
  proposal: `unify-ai-via-opencode`), since there would be only one backend to
  display.

## Alternatives Considered

**Only show on hover / settings page** — rejected. A setting page is not visible
during use; the badge needs to be ambient so model changes are immediately apparent.

**Show full provider URL** — too verbose for a badge; a short model name + provider
type is sufficient.

## Future

- Clickable badge opens a model picker for OLLA routes, not just OpenCode.
- Session-level AI usage log: which model was used for each action and at what cost.
