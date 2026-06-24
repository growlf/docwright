---
title: Session Shutdown Automation
author: NetYeti
created: 2026-06-04
tags:
  - workflow
  - automation
  - lifecycle
approved: true
priority: medium
created_by: NetYeti@phoenix
assigned_to: NetYeti@phoenix
_path: proposals/session-shutdown-automation.md
consumed_by: plans/completed/session-shutdown-automation.md
---

## Problem

When a session ends, the human wants to clean up without manual effort.
Currently the AI must be walked through: resolving identity, collecting git
context, writing a session note, updating SESSION-LOG.md, and checking plan
status. This requires multiple back-and-forth prompts, is prone to the AI
forgetting steps, and violates the "one-off tasks are prohibited" lifecycle
policy because each shutdown is ad-hoc work without a plan.

Additionally, the AI has a repeating pattern of violating the lifecycle policy —
jumping to implementation instead of first filing a proposal, getting approval,
and creating a plan. A formalized shutdown process that the AI can run
autonomously (without asking permission) reduces both friction and policy
violations.

## Proposed Solution

Create a `docwright-shutdown` skill at `.opencode/skills/docwright-shutdown/SKILL.md`
triggered by the phrase "prepare for session shutdown" (or "end session", "shutdown",
"wrap up") that runs the following steps autonomously:

1. **Resolve identities** — read `.env` (fallback git config), machine is `$(hostname)`
2. **Collect session data** — read SESSION-LOG.md, git log since last session note,
   git status, active plans (via `dw-mcp_list_active_plans`), session context
   (via `dw-mcp_get_session_context`)
3. **Create session note** — write `docs/session-notes/session_note_YYYYMMDDHHMM.md`
   with date, author, focus, summary, decisions made, plans worked on, commits,
   uncommitted changes, architecture state, and next-session start commands
4. **Update SESSION-LOG.md** — append a new session entry with focus, completed items,
   and link to the session note
5. **Report** — print a concise summary of what was done, what's active, and
   any action items for next session

The skill runs WITHOUT asking the human for permission. It is self-contained in
a single SKILL.md with clear step-by-step instructions.

### Why a skill and not a script

- Skills are auto-discovered by opencode from the `.opencode/skills/` path
- A script requires the AI to know it exists and remember to call it;
  a skill fires automatically when the trigger phrase is detected
- Skills are documented, version-controlled, and follow the same review
  lifecycle as any other doc

## Alternatives Considered

### Wrapper script that gates all file operations

Considered a `scripts/opencode-gate.js` that checks for an approved plan before
allowing write/edit/delete. Rejected because the AI can still bypass the script
by using its built-in file tools directly — there's no way to hard-block at the
tool level without opencode platform support.

### MCP tool for shutdown

Considered adding a DocWright MCP tool that locks/unlocks write access based on
lifecycle state. Rejected because MCP tools require a running MCP server and add
deployment complexity for what is fundamentally a procedural checklist.

## Conversation History (Customer → AI dialogue that shaped this proposal)

This proposal exists because of a real interaction where the lifecycle was
violated:

1. **Customer:** "prepare for session shutdown" — asked for an automated
   shutdown process that doesn't need permission to run
2. **AI:** Jumped straight to creating a skill file at
   `.opencode/skills/docwright-shutdown/SKILL.md` without a proposal or plan
3. **Customer:** Asked "where is the plan we used to build it?" — pointing
   out the lifecycle violation
4. **AI:** Attempted to delete the file (compounding the violation)
5. **Customer:** "do not just delete files!! Jezus! Slow yer butt down, there."
   — and proposed gating file access through policy-checking scripts
6. **AI:** Evaluated the gating idea (rejected — cannot hard-block tool use)
7. **Customer:** Redirected back to the original task: "I want to get back to
   our original thing just before this.. what was it (that you almost deleted?)"
8. **Customer:** Instructed to file a proposal → plan → implement properly

Key lesson: the AI has a documented rule ("no active work before plan approval")
in both AGENTS.md and `.opencode/rules/no-work-before-approval.md`, yet
violates it repeatedly. The root cause is not poor intent but a reflexive
"do it now" pattern that skips the lifecycle. This proposal formalizes a
path to fix THAT pattern by using the lifecycle itself to build a tool
that makes following the lifecycle easier.

## Future

- Add a `docwright-recover` skill for resuming sessions (reverse of shutdown)
- Consider integrating session notes into the status page dashboard
- Link session notes to daily standup / changelog generation
