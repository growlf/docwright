---
title: "DocWright Skills — AI Tool Usage Guide"
status: active
author: NetYeti
created: 2026-06-04
tags:
  - documentation
  - skills
  - ai
  - claude
  - opencode
---

# DocWright Skills — AI Tool Usage Guide

DocWright provides a set of skills that work across multiple AI tools.
The executable logic lives in `scripts/` — any AI can call the same script.

---

## `/critique-plan` — Adversarial Plan Review

Critiques a plan before execution begins. Finds failure modes, missing
dependencies, underestimated deliverables, and governance gaps.

**Script:** `scripts/critique-plan.js`

### With Claude Code

```
/critique-plan plans/phase-2-foundation.md
```

Claude Code runs the script, passes the output to an adversarial agent,
presents findings for your review, and writes the `## Critical Review`
section to the plan on approval.

### With OpenCode (BigPickle or any configured model)

```bash
node scripts/critique-plan.js plans/phase-2-foundation.md
```

Copy the output and paste it into any OpenCode session. Or pipe directly:

```bash
node scripts/critique-plan.js plans/phase-2-foundation.md | opencode chat
```

The `docwright-critic` agent in `opencode.json` is configured specifically
for this — it will find problems without softening them.

### With any other AI

The script output is plain text with the critic questions embedded.
Paste into any chat interface — Claude.ai, ChatGPT, Gemini, local Ollama:

```bash
node scripts/critique-plan.js plans/phase-2-foundation.md
# Copy output → paste into your AI of choice
```

### When to run it

- When a new plan is created
- When a new proposal is added to a plan's `proposal_source:`
- Before starting any Phase 1 or Phase 2 deliverable
- When the Critical Review section is stale (plan has changed substantially)

### Output format

The script produces a context block followed by critic questions. The AI
responds with findings in this format:

```markdown
### [Deliverable] ⚠️ warn
- **Finding:** [specific problem]
- **Action:** [what to do]
- **Resolution:** *(leave blank — fill in when addressed)*
```

Severity: 📝 note | ⚠️ warn | 🚫 block

Unresolved ⚠️ warn and 🚫 block items block the phase gate sign-off.

---

## `/status` — Vault Status

Shows the current vault status (proposals, plans, gates).

```
/status
```

Script: `scripts/vault-status.js`

---

## Adding new skills

1. Write the logic in `scripts/your-skill.js` (tool-agnostic, no AI calls)
2. Create `.claude/skills/your-skill.md` (Claude Code wrapper)
3. Document it in this file with both Claude Code and OpenCode usage
4. The skill must work by piping script output to any AI — no model lock-in

See `policies/core/code-over-memory.md` for the "scripts, not memory" principle.
