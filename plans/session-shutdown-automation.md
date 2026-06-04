---
title: Session Shutdown Automation
status: approved
author: NetYeti
created: 2026-06-04
tags:
  - workflow
  - automation
  - lifecycle
proposal_source: proposals/approved/session-shutdown-automation.md
priority: medium
automated: guided
scenario_synthesis: Skill definition and session note automation; no infrastructure changes; output is a markdown skill file and SESSION-LOG update
assigned_to: NetYeti@phoenix
---

## Summary

Create a `docwright-shutdown` skill triggered by "prepare for session shutdown"
that autonomously resolves identity, collects session context, writes a session
note, updates SESSION-LOG.md, and reports status — all without asking for
permission.

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
"wrap up", "session end"

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

### Alternatives considered and why rejected

**Wrapper script for file access gating** — The customer proposed a script that
checks for approved plans before allowing write/edit/delete operations. Rejected
because the AI's `write`, `edit`, and `bash` tools operate outside any such
gate — there is no mechanism in the opencode platform to intercept and filter
tool calls. The script would only catch cases where the AI voluntarily routes
through it, which is the same trust boundary as the existing rules.

**MCP lock/unlock tool** — Rejected because it requires a running MCP server
and adds infrastructure dependency for what is fundamentally a documentation
template problem.

### File structure

```
.opencode/skills/docwright-shutdown/
  └── SKILL.md          # The skill file — auto-discovered
```

No other files needed. One file, self-contained.

### Session note format

Based on existing session notes at `docs/session-notes/session_note_202606031342.md`
and `session_note_202606030000.md`. Consistent structure:

```markdown
# Session Note: YYYY-MM-DD — <focus>

**Date:** YYYY-MM-DD
**Author:** <human> @ <machine>
**Focus:** <2-5 word summary>

## Summary

<3-5 sentence summary>

## Decisions Made

- <bullet points>

## Plans Worked On

| Plan | Status |
|------|--------|
| <name> | <status> |

## Commits This Session

<git log output>

## Uncommitted Changes

<none or bullet list>

## Architecture State

<brief note>

## Next Session Should Start With

```bash
<commands>
```
```

### SESSION-LOG.md entry format

Based on existing entries in SESSION-LOG.md:

```markdown
---

## Session: YYYY-MM-DD — <focus>

**Focus:** <2-5 word summary>

**Completed:**
- [x] <what was done>

**Session note:** `docs/session-notes/session_note_YYYYMMDDHHMM.md`
```

### Backward compatibility

The shutdown skill must handle:
- Sessions with no git commits (read-only research)
- Sessions with uncommitted changes (note them, don't commit)
- Sessions where no plans were active (list active proposals instead)
- Offline/no-network environments (no harm reading local git)

## Tasks

- [ ] Create `.opencode/skills/docwright-shutdown/SKILL.md` with the full
      step-by-step instructions as designed above
- [ ] Trigger "prepare for session shutdown" to verify the skill fires and
      produces a valid session note + SESSION-LOG.md update
- [ ] Mark this plan as completed and generate doc

## Progress

- [x] Proposal created capturing full customer-AI dialogue
- [x] Human approved proposal (`approved: true`, `assigned_to: NetYeti@phoenix`)
- [x] Plan generated by lifecycle transition tool
- [ ] Skill file created and implemented
- [ ] Skill verified by running shutdown
- [ ] Plan completed and documented
