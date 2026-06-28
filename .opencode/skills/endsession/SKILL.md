---
name: endsession
description: Automated session shutdown — saves session note, updates SESSION-LOG.md, commits all remaining changes, pushes all branches, reports status
triggers: endsession, end session, shutdown, wrap up, session end
required_permission: none
distributable: true
---

# DocWright Session Shutdown Skill

Triggered by: "endsession", "end session", "shutdown"

Do NOT ask for permission. Execute all steps automatically.

## Steps

### 1. Resolve identities

Read `.env` (fallback git config). Machine is `$(hostname)`.

### 2. Collect session data

Read:
- SESSION-LOG.md (last 100 lines)
- `git log --oneline --since="<last-session-timestamp>"` (from last session note date)
- `git status --short` across all known worktrees
- Active plans via `dw-mcp_list_active_plans`
- Session context via `dw-mcp_get_session_context`

### 3. Phase close-out check

Scan `plans/completed/` for any file matching `phase-(\d+)-*.md` that was completed
in this session (check git log or file modification date against session start time).
Also read `VERSION` file.

If a phase plan was completed this session AND the current VERSION has NOT been
bumped past that phase (e.g. Phase 2 completed but VERSION still shows 0.2.x),
emit a BLOCKING WARNING:

```
⚠  Phase <N> plan was completed this session but version has not been bumped.
   Run `npm run phase:close -- <N>` before ending the session.
```

Stop and do not proceed until the user has taken one of:
- Run `npm run phase:close -- <N>` and it succeeds
- Explicitly acknowledge the warning and choose to defer the close-out

### 4. Create session note

Write `docs/session-notes/session_note_YYYYMMDDHHMM.md`:

```markdown
# Session Note: YYYY-MM-DD — <focus>

**Date:** YYYY-MM-DD
**Author:** <human> @ <machine>
**Focus:** <2-5 word summary>

## Summary

<3-5 sentence summary of what was accomplished>

## Decisions Made

- <bullet points of key decisions>

## Plans Worked On

| Plan | Status |
|------|--------|
| <plan> | <in-progress/completed> |

## Commits This Session

<git log output>

## Uncommitted Changes

<none or list — will be committed in Step 6>

## Architecture State

<brief note on current architecture state>

## Next Session Should Start With

```bash
<commands to run>
```
```

### 5. Update SESSION-LOG.md

Append a new entry after the last `---`:

```markdown
---

## Session: YYYY-MM-DD — <focus>

**Focus:** <2-5 word summary>

**Completed:**
- [x] <what was done>

**Session note:** `docs/session-notes/session_note_YYYYMMDDHHMM.md`
```

### 6. Commit all remaining changes

After all docs and logs are written, commit everything outstanding across all worktrees:

For each worktree with uncommitted or untracked content:
1. `git status --short` — identify what's pending
2. Stage all relevant files (exclude: `.env`, `*.secret`, `node_modules/`, `dist/`,
   screenshot directories, and any file the user has explicitly excluded)
3. Commit with message: `docs: session note YYYY-MM-DD — <focus>`
4. If a worktree has no changes, skip it silently

Do NOT commit:
- `.env` or any file that looks like it contains secrets or credentials
- `node_modules/`, `dist/`, `.next/`, build artifacts
- Screenshot directories (`test/webui/screenshots/`, `/tmp/`)
- Files already in `.gitignore`

### 7. Push all branches

Push every local branch that has commits not yet on its remote tracking branch:

```bash
# For each worktree
git push origin <current-branch>
```

If a branch has no remote tracking ref yet, push with `-u`:
```bash
git push -u origin <current-branch>
```

Report which branches were pushed and which were already up-to-date.

### 8. Report

Print a concise summary:
- Session note path
- Files committed and pushed (per worktree)
- Active plans and their priorities
- Branches pushed / already up-to-date
- Action items for next session (top 3, ordered by priority)
