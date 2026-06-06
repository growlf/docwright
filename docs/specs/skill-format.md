# DocWright Skill Format Specification

Skills are reusable workflow procedures that AI agents follow when a task
matches the skill's domain. DocWright skills are defined once and consumed
by both OpenCode and Claude Code.

## Canonical location

```
.opencode/skills/<skill-name>/SKILL.md
```

One directory per skill. The `SKILL.md` file contains YAML frontmatter
followed by Markdown instructions.

## Frontmatter schema

```yaml
---
name: <string>             # REQUIRED. Unique slug. Matches directory name.
description: <string>      # REQUIRED. One line. Used in CLAUDE.md table and skill discovery.
triggers:                  # OPTIONAL. List of natural-language phrases that should activate this skill.
  - <phrase>
required_permission: none  # OPTIONAL. Defaults to none. Values: none | read | write | admin
---
```

All fields are lowercase. `name` must be kebab-case and match the directory name exactly.

## Instructions body

The body after frontmatter is plain Markdown. It should cover:

1. **When to use** — detection heuristics, trigger conditions
2. **Step-by-step process** — numbered or headed sections the AI follows
3. **Verification** — how to confirm the skill completed correctly
4. **Do not** — explicit anti-patterns to avoid

Keep instructions declarative. The AI executes them; avoid meta-commentary.

## Claude Code bridge

Claude Code cannot natively invoke `.opencode/skills/` skills via its `Skill` tool.
The bridge is the `## Available skills` table in `CLAUDE.md`, which is
**auto-generated** by `scripts/sync-claude-skills.ts`. Do not edit it manually.

The table format is:

```
| Skill | Description | SKILL.md |
|-------|-------------|----------|
| `<name>` | <description> | `.opencode/skills/<name>/SKILL.md` |
```

When Claude Code encounters a task matching a skill, it reads the SKILL.md at
the path in the table and follows the instructions directly.

## Adding a new skill

1. Create `.opencode/skills/<name>/SKILL.md` with valid frontmatter
2. Run `npm run sync:skills` — this regenerates the `## Available skills` table in `CLAUDE.md`
3. Commit both the new skill and the updated `CLAUDE.md`
4. The CI `cross-tool` test suite verifies the table is not stale

## Removing a skill

1. Delete the `.opencode/skills/<name>/` directory
2. Run `npm run sync:skills`
3. Commit

## Renaming a skill

1. Rename the directory
2. Update `name:` in frontmatter to match
3. Run `npm run sync:skills`
4. Commit
