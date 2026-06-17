---
name: docwright-session-start
description: Automated session startup — resolves identity, gathers active plans, session history, git status, and sets up todo
triggers: what's next, what is next, session start, resume, continue, status, start session, wake up
required_permission: read
---

# DocWright Session Start Skill

Triggered by: "what's next", "session start", "resume", "continue", "status"

Do NOT ask for permission. Execute all steps automatically. Return a clear, concise summary.

## Steps

### 1. Gather session context

Call `dw-mcp_session_context` to get structured JSON with:
- Identity (human name, email, machine hostname, network fingerprint)
- Active plans (title, file, status, steps_done/total, assigned_to)
- Pending proposals (unapproved and approved counts)
- Last session entry from SESSION-LOG.md
- Git status (staged, modified, total files)

### 2. Resolve network identity

Run `traceroute -n 8.8.8.8` to verify network path. Note the last-visible hop.

### 3. Report summary

Return a concise session-start summary:
```
Session: <date> | <hostname> | <network hint>
Human: <name> | Identity: matched|discrepancy

Active plans:
- <title> (<file>) [<status>] — <steps_done>/<steps_total> steps ✅

Pending proposals: <N> unapproved, <M> approved
Git: <staged> staged, <modified> modified

Last session: <date> — <summary>

TODOs set from active plan state.
```

### 4. Adoption health check

If `.docwright/config.json` exists in the current repo, read `adopt_version` from it and
compare to the current DocWright installation version (from `$DOCWRIGHT_PATH/package.json`).

If they differ, emit a non-blocking advisory **before** the plan summary:

```
ℹ  This vault was adopted with DocWright <adopt_version>. Current installation is <current_version>.
   Run `npm run adopt -- --dest . --upgrade` from $DOCWRIGHT_PATH to update hooks and skills.
```

If `.docwright/config.json` does not exist (e.g. this is the DocWright repo itself, or
the vault has never been adopted), skip this check silently.

### 5. Set up todo list

Create a todo list from active plans, with the highest-progress plan first. Mark one item as `in_progress` only if there's a clear next step. Otherwise leave all `pending`.
