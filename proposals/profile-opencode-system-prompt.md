---
complexity: medium
title: "Per-Profile Governance System Prompt for OpenCode Sessions"
author: NetYeti
created: 2026-06-03
tags:
  - profile-engine
  - ai
  - opencode
  - governance
  - improvements
approved: false
deferred: true
deferred_reason: "Requires full profile engine (Phase 3). MVP uses a hardcoded context injection. Per-profile customisation comes with the profile engine."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/web-ui-ai-chat-panel.md
  - plans/phase-3-profile-acl-ai.md
milestone: backlog
---

## Problem

The MVP chat panel injects a hardcoded governance context at session start.
This context is the same for every vault regardless of which profile is
active. An `infra-topology` vault (managing network devices) should get
different AI instructions than an `org-operations` vault (managing proposals
and policies) — the governance rules, document types, available MCP tools,
and appropriate AI behaviours differ significantly.

## Proposed Solution

Each bundled profile's `opencode-instructions.md` (already specified in the
profile architecture) becomes the system prompt injected into DocWright chat
sessions for that profile. The session context injection reads the active
profile and prepends the appropriate instructions.

This means:
- `org-operations` sessions: AI knows the inbox→issue→proposal→plan flow,
  applicable policies, and is instructed to check lifecycle compliance
- `infra-topology` sessions: AI knows planned→active→decommissioned states
  and is instructed to check device dependencies before transitions
- `knowledge-base` sessions: AI knows the Ingest/Lint/Save-to-Wiki pattern
  and is instructed to apply the Karpathy quality rubric

The `opencode-instructions.md` files already exist in the profile architecture
spec — this proposal wires them into the session context injection.

## Deferred Because

Requires the full profile engine (Phase 3) to load and validate profiles.
The MVP hardcodes org-operations context, which covers DocWright's own
development vault.
See [[plans/phase-3-profile-acl-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from web-ui-ai-chat-panel proposal | NetYeti |
