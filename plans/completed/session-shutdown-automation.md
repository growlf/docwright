---
title: Session Shutdown Automation
status: completed
author: NetYeti
created: 2026-06-04
tags:
  - workflow
  - automation
  - lifecycle
proposal_source: proposals/approved/session-shutdown-automation.md
priority: medium
mode: guided
scenario_synthesis: Skill definition and session note automation; no infrastructure changes; output is a markdown skill file and SESSION-LOG update
assigned_to: NetYeti@phoenix
tests_defined: true
gate_status: waived
gate_note: "Waived retroactively — plan completed before strict gate enforcement; NetYeti authorized 2026-06-07"
total_steps: 4
completed_steps: 4
_path: plans/session-shutdown-automation.md
completed_date: 2026-06-07
---

## Summary

Create a session shutdown skill triggered by "endsession" (originally "prepare
for session shutdown") that autonomously resolves identity, collects session
context, writes a session note, updates SESSION-LOG.md, and reports status —
all without asking for permission.

## Design Reasoning (captured from customer-AI dialogue)

### Origin of this proposal

The customer asked "prepare for session shutdown" expecting an automated
process. The AI violated lifecycle policy by jumping straight to creating
the skill file at `.opencode/skills/docwright-shutdown/SKILL.md` without
a proposal or plan. The customer corrected this: "where is the plan we used
to build it?"

This is the third time the AI has violated the no-work-before-approval rule
(the lifecycle gate rule at `.opencode/rules/no-work-before-approval.md`).
Root cause: the AI has a reflexive "do it now" pattern that skips the
proposal → plan → implementation sequence. The fix being tested here is
to use the lifecycle itself to build the solution, reinforcing the pattern
by doing it correctly.

### What the skill must do

Trigger phrases: "prepare for session shutdown", "end session", "shutdown",
"wrap up", "session end", "endsession"

The skill runs WITHOUT asking the human for permission and WITHOUT requiring
human input. It performs:

1. **Resolve identities** — read `.env` (fallback `git config user.name` /
   `user.email`), machine is `$(hostname)`. This follows the Identity
   Resolution Protocol in AGENTS.md.

2. **Collect session data** — read SESSION-LOG.md (last 100 lines), git log
   since last session note timestamp, git status, active plans via
   `dw-mcp_list_active_plans`, session context via `dw-mcp_get_session_context`.

3. **Create session note** at `docs/session-notes/session_note_YYYYMMDDHHMM.md`
   with: date, author, focus (2-5 word summary of session), summary (3-5
   sentences), decisions made (bullet points), plans worked on (table with
   status), commits this session (git log output), uncommitted changes
   (list or "none"), architecture state (brief note), next session start
   commands (bash block).

4. **Update SESSION-LOG.md** — append a new entry after the last `---` divider
   with: session date and focus, completed items as checkboxes, link to the
   session note file.

5. **Report** — print a concise summary: session note path, plans active,
   git status, action items for next session.

### What the skill must NOT do

- MUST NOT commit uncommitted changes (the AI cannot commit without explicit
  request — per AGENTS.md and docwright-git skill)
- MUST NOT delete files
- MUST NOT change any document state (no proposal/plan transitions)
- MUST NOT ask for permission at any step

### Why a skill (not a script, not an MCP tool)

| Option | Status | Reason |
|--------|--------|--------|
| Skill (SKILL.md) | **Selected** | Auto-discovered from `.opencode/skills/` path, fires on trigger phrase, version-controlled, no deployment |
| Shell/Node script | Rejected | AI must remember it exists and call it manually — same friction as current manual shutdown |
| MCP tool | Rejected | Requires running MCP server, adds deployment complexity for a procedural checklist |
| Wrapper script gate | Rejected | Cannot hard-block AI's built-in file tools — enforcement is advisory |

### File structure

```
.opencode/skills/endsession/
  └── SKILL.md          # The skill file — auto-discovered (renamed from docwright-shutdown)
```

## Implementation Steps

| Step | Status |
|------|--------|
| Create `.opencode/skills/endsession/SKILL.md` with full step-by-step instructions | ✅ |
| Trigger skill to verify it fires and produces valid session note + SESSION-LOG update | ✅ |
| Rename skill from `docwright-shutdown` to `endsession` | ✅ |
| Mark plan completed and generate doc | ✅ |

## Tests

| Test | Verifies | Result |
|------|----------|--------|
| Trigger "endsession" — session note created at correct path | Skill fires on trigger phrase | ✅ Pass |
| SESSION-LOG.md appended with new entry | LOG update step works | ✅ Pass |
| Skill does not commit or mutate document state | Constraint enforcement | ✅ Pass |
| Skill runs without permission prompts | No-ask requirement | ✅ Pass |

## Test Results

All tests passed — verified across 3+ live session shutdowns (2026-06-05 and 2026-06-06).

## Phase Gate

This plan delivers a skill file (`.opencode/skills/endsession/SKILL.md`) — no
compiled code, no CI pipeline, no deployment artifacts. There are no automated
test suites to run in CI. Gate waiver is appropriate.

| Check | Status |
|-------|--------|
| All implementation steps complete | ✅ |
| `tests_defined: true` | ✅ |
| Skill verified by live use (3+ sessions) | ✅ |
| CI not applicable (skill file, no code) | — waiver required |

**gate_status:** pending — set to `waived` to close (CI not applicable for skill deliverables)

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Plan created from approved proposal | NetYeti |
| 2026-06-06 | All steps complete — skill implemented, verified, renamed to endsession | NetYeti |
