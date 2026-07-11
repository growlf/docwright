# Creating Claude Code skills in this repo

How to add a new `/command` skill so Claude Code actually discovers it.
Pattern ported back from lilyetibot (which debugged it after porting DocWright's
originals) — follow this exactly and the skill will work; deviate and it will be
silently ignored. Layout is CI-enforced by `scripts/sync-claude-skills.ts`.

## The one rule that matters

A skill is a **directory** containing a file named exactly `SKILL.md`:

```
.claude/skills/<skill-name>/SKILL.md     ✅ discovered
.claude/skills/<skill-name>.md           ❌ silently ignored — this is the
                                            mistake that hid every DocWright
                                            skill until 2026-07-10 (GH #313)
```

There is no error message for the wrong layout. The skill just never appears.
If a skill "doesn't show up," check the layout first.

## SKILL.md format

Two parts: YAML frontmatter, then a markdown body.

### Frontmatter (required)

```yaml
---
name: endsession
description: Automated session shutdown — writes the session note, updates SESSION-LOG.md, commits outstanding work, and pushes all branches. Use when the user says "endsession", "end session", or "wrap up".
---
```

- `name` — lowercase, no spaces (hyphens OK). Must match the directory
  name. This becomes the `/name` command.
- `description` — one or two sentences. **This is the trigger.** The model
  reads only this line when deciding whether to invoke the skill, so it
  must say (a) what the skill does and (b) *when to use it*, including the
  exact phrases a user might type ("Use when the user says X or Y").

### Body = instructions TO the agent, not documentation ABOUT the feature

The body is loaded when the skill is invoked and the agent follows it as
instructions. Write it in imperative voice, like a runbook:

- ✅ "Run `npm run session:end` from the repo root."
- ✅ "If the phase close-out gate fails, ask the user before deferring."
- ❌ "This skill writes session notes and commits work." (describes the
  outcome but tells the agent nothing about how to achieve it)

If the skill wraps a script, the body should cover:
1. The exact command to run (and from what directory).
2. What arguments/flags to pass, and how to choose their values from
   conversation context.
3. How to handle each failure mode (ask the user? retry? report and stop?).
4. What to report back to the user when done.

## Recipe: adding a new skill

1. Create the directory and file:
   ```bash
   mkdir -p .claude/skills/<skill-name>
   ```
   Then write `.claude/skills/<skill-name>/SKILL.md` with the format above.

2. If the skill needs a script, put it in `scripts/` (repo-visible, testable),
   not inside the skill directory. The skill body points at it. Supporting
   reference files the agent should read *only when the skill runs* may live
   in the skill directory next to SKILL.md.

3. Run `npm run sync:skills` — it validates the layout (and fails CI on flat
   files, missing SKILL.md, or name/directory mismatch).

4. Commit the skill and any script together.

5. **Restart Claude Code** (or start a new session). Skills are scanned at
   session start. To verify it registered: ask Claude "what skills are
   available?" — the skill's `name` and `description` should be listed.

6. If it still doesn't appear, re-check in this order:
   - Layout: is it `<name>/SKILL.md`? (Not `<name>.md`, not `skill.md` —
     the filename `SKILL.md` is case-sensitive.)
   - Frontmatter: valid YAML between `---` lines, with `name` and
     `description` present?
   - `name` matches the directory name?

## Scope notes

- `.claude/skills/` in this repo = canonical source, committed. In *adopted
  vaults* the same path is a managed copy installed by `adopt-vault.ts` and
  gitignored there.
- `~/.claude/skills/` = personal skills, available in all your projects
  (don't put project procedures there).
- `.opencode/skills/<name>/SKILL.md` = OpenCode workflow skills (separate
  registry, same directory-layout idea); `npm run sync:skills` renders their
  table into CLAUDE.md.
