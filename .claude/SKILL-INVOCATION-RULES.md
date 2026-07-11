# Skill Invocation Rules — Decision Tree

**Updated:** 2026-07-10 — DocWright Claude skills converted to the registered
directory layout (`.claude/skills/<name>/SKILL.md`, GH #313); the old
"read the file manually" workaround for them is retired.
**History:** 2026-07-06 incident — `Skill("endsession")` failed because the
flat-file layout meant the skill was never registered. Root cause fixed
2026-07-10; the rule below is now simple.

---

## The rule

1. **If the skill appears in the harness's available-skills list** (built-ins
   like Explore/Plan, plus the repo's `.claude/skills/<name>/SKILL.md` skills:
   `endsession`, `docwright-session-start`, `docwright-adopt-vault`,
   `critique-plan`, `status`) → invoke it with the `Skill` tool:
   `Skill(skill: "endsession")`.
2. **OpenCode workflow skills** (`.opencode/skills/<name>/SKILL.md` —
   `docwright-proposal`, `docwright-lifecycle`, `docwright-issue-workflow`,
   etc.) are NOT harness-registered → read the SKILL.md and follow its process
   directly. The table in CLAUDE.md lists them.
3. **Never guess a skill name.** If it isn't in the available list and has no
   SKILL.md on disk, it doesn't exist.

## When a skill doesn't appear in the available list

Skills are scanned at session start — a SKILL.md added mid-session won't
register until the next session. Until then, read the file and execute it
directly (same content, manual invocation). If a `.claude/skills` skill is
missing across sessions, check the layout rules in
[.claude/skills/README.md](skills/README.md) — flat files are silently
ignored, and `npm run sync:skills` validates the layout.

## Examples

```typescript
// ✅ Registered skill (harness or .claude/skills):
Skill(skill: "endsession")
Skill(skill: "Explore", ...)

// ✅ OpenCode workflow skill — read and follow:
//    Read .opencode/skills/docwright-proposal/SKILL.md, then execute its steps.

// ❌ Wrong: inventing a skill name not in the available list
Skill(skill: "docwright-magic")   // → Unknown skill
```
