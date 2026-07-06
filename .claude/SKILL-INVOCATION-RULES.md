# Skill Invocation Rules — Decision Tree

**Updated:** 2026-07-06  
**Health Audit:** Incident — tried Skill("endsession") despite exception; reorganized for clarity

---

## Decision Tree

```
Am I invoking a skill to help with a task?
│
├─ YES
│  │
│  └─ Is it in the harness-registered skills list? (Explore, Plan, code-reviewer, etc.)
│     │
│     ├─ YES → Use Skill(name: "...") tool. Examples:
│     │         • Skill(skill: "Explore", description: "...", prompt: "...")
│     │         • Skill(skill: "Plan", description: "...", prompt: "...")
│     │
│     └─ NO → Is it a DocWright skill? (Check if .claude/skills/<name>.md exists)
│        │
│        ├─ YES (docwright skill found)
│        │  │
│        │  └─ Read .claude/skills/<name>.md and execute directly
│        │     Examples:
│        │     • docwright-proposal → read skill file, follow step-by-step
│        │     • docwright-issue-workflow → read skill file, use MCP tools
│        │     • endsession → read skill file, run: npm run session:end -- [flags]
│        │
│        └─ NO (OpenCode skill? Check .opencode/skills/<name>/SKILL.md)
│           │
│           └─ Read the SKILL.md file and follow the process
│              (OpenCode skills are less common; usually docwright-* or harness)
│
└─ NO
   └─ Proceed without a skill
```

---

## Skill Invocation Matrix

| Skill Name | Type | Invocation | Location | When to Use |
|-----------|------|-----------|----------|-----------|
| Explore | Harness | `Skill(skill: "Explore", ...)` | Built-in | Fast read-only search across codebase |
| Plan | Harness | `Skill(skill: "Plan", ...)` | Built-in | Design implementation strategy |
| code-reviewer | Harness | `Skill(skill: "code-reviewer", ...)` | Built-in | Review code for bugs/style |
| Agent | Harness | `Agent(description: "...", prompt: "...")` | Built-in | General-purpose multi-step tasks |
| docwright-* | DocWright | Read `.claude/skills/<name>.md`, execute directly | `.claude/skills/` | DocWright-specific workflows |
| endsession | DocWright | Read `.claude/skills/endsession.md`, run `npm run session:end` | `.claude/skills/` | End session with cleanup |
| docwright-proposal | DocWright | Read `.claude/skills/docwright-proposal.md` | `.claude/skills/` | Create templated proposals |
| docwright-lifecycle | DocWright | Read `.claude/skills/docwright-lifecycle.md` | `.claude/skills/` | Manage document lifecycle |
| OpenCode skills | OpenCode | Read `.opencode/skills/<name>/SKILL.md` | `.opencode/skills/` | Specialized domain workflows |

---

## Examples

### ✅ Correct: Harness Skill

```typescript
Skill(skill: "Explore", description: "Find test files", prompt: "Where are the dispatch tests?")
```

### ✅ Correct: DocWright Skill

```bash
# Read .claude/skills/endsession.md
# Then run:
npm run session:end -- --focus "..." --summary "..."
```

### ❌ Wrong: DocWright via Skill Tool

```typescript
// DO NOT DO THIS:
Skill(skill: "endsession")  // → Error: Unknown skill
```

### ❌ Wrong: Forgotten Exception

```typescript
// DO NOT DO THIS:
Skill(skill: "docwright-proposal")  // → Error, must read .claude/skills/
```

---

## When Unclear

1. **Search CLAUDE.md** for the skill name — it may be called out as an exception
2. **Check if `.claude/skills/<name>.md` exists** — if yes, read it; don't use Skill()
3. **Check if it's in the harness-registered list** (Explore, Plan, Agent, code-reviewer) — if yes, use Skill()
4. **Ask:** "Does this skill operate on DocWright content?" If yes, likely a DocWright skill → read the file
5. **Default:** When in doubt, search for the skill file first before trying Skill()

---

## Health Audit Notes

- **2026-07-06:** Consolidated scattered skill rules into this matrix after incident where Skill("endsession") was attempted despite documentation saying not to
- **Why it happened:** Rule was buried in CLAUDE.md prose; no decision tree available at decision point
- **Fix:** Created this file; linked from CLAUDE.md
- **Weekly check:** Verify no skill invocation errors in next week's usage
