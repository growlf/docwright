---
complexity: low
title: "Chat @-mention to Inject Document Context"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - chat
  - context
  - improvements
approved: false
deferred: true
deferred_reason: "Post-MVP chat panel. Straightforward to add once base panel is stable."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/web-ui-ai-chat-panel.md
---

## Problem

The chat panel auto-injects context for the currently open document. But
contributors often want to ask the AI about a different document — or multiple
documents — without navigating away from what they are working on.

## Proposed Solution

`@document-name` mention syntax in the chat input. Typing `@` opens an
autocomplete dropdown populated from the vault file tree (same data as the
sidebar). Selecting a document appends its path and frontmatter summary to
the prompt context before submitting.

Example: "Compare @proposals/auth-redesign.md with @proposals/sso-integration.md
and tell me if they conflict."

The autocomplete filters by title and path. Selected mentions appear as
removable chips in the input area.

## Deferred Because

Requires the base chat panel to be stable first. The autocomplete component
can reuse the existing file tree data already loaded by the sidebar.
See [[proposals/web-ui-ai-chat-panel.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from web-ui-ai-chat-panel proposal | NetYeti |
