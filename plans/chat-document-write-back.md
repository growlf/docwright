---
title: Chat Panel — AI Should Apply Changes to the Active Document
status: approved
author: NetYeti
created: 2026-06-28
type: plan
tags:
  - chat
  - ux
  - write
  - phase-4
  - bug
proposal_source: proposals/approved/chat-document-write-back.md
priority: high
complexity: low
automated: full
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
_path: plans/chat-document-write-back.md
total_steps: 3
completed_steps: 0
scenario_synthesis: "Happy path: user says 'fix the duplication in Testing Plan' — AI shows proposed changes, writes the file via OpenCode file tools, SSE watcher fires and the document page auto-reloads with the edit. Failure path: user asks a question rather than requesting a change — AI answers without writing; or AI proposes a change to a governance-gated field (approved:, status: completed) — system prompt blocks it."
depends_on:
  - chat-active-document-context.md
---

# Chat Panel — AI Should Apply Changes to the Active Document

## Overview

Give the DocWright chat AI a system prompt that instructs it to act as a document
assistant: show proposed changes, then write them to disk using OpenCode's file tools.
The SSE file watcher already fires on writes and auto-reloads the document page — no
additional plumbing needed. Depends on `chat-active-document-context` (the AI needs
the file path from context injection to know what to write).

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Inject DocWright system prompt at session creation | When `ChatPanel` creates an OpenCode session (or reuses an existing one), send an initial system message establishing the AI's role. The system message should: (a) identify the AI as a DocWright document assistant; (b) instruct it to show proposed changes before writing; (c) tell it the vault root path so file tool paths resolve correctly; (d) list the governance-gated frontmatter fields it must never modify (`approved:`, `status: completed`, `gate_status:`). Pass this as the first `parts` entry with a special `type` that OpenCode treats as system context — or as a prepended user message if no system message API exists. | ⏳ Pending |
| 2 | Verify OpenCode file tools are active in the session | Confirm the `build` agent (default for DocWright sessions) has the write file tool available. Create a test session, ask the AI "what tools do you have?" and verify write/edit tools appear. If the default agent lacks write tools, switch to an agent configuration that includes them. | ⏳ Pending |
| 3 | Test: AI writes back to the active document | Open `plans/multiuser-auth-concurrent-sessions.md`. Say "The Testing Plan section has duplicate checkbox items — please deduplicate them." The AI should: (1) identify the duplicates, (2) show the proposed fixed section, (3) write the file. The document page should auto-reload within ~1s showing the deduplicated content. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: System message injected; AI introduces itself as a document assistant in first response
- [ ] Step 2: AI confirms write/edit file tools available; can write a test file
- [ ] Step 3: AI deduplicates Testing Plan section; document auto-reloads; git diff shows the change

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] AI never modifies `approved:`, `status: completed`, or `gate_status:` fields

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-28 | Wrote implementation steps. Depends on chat-active-document-context. | NetYeti |
