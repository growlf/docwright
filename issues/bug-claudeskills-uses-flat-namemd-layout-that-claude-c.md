---
title: .claude/skills uses flat <name>.md layout that Claude Code silently ignores — skills never register, adopt-vault propagates the defect
status: resolved
resolved_by: #316
created: 2026-07-11
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-11]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/313
tags:
  - reported-bug
---

# .claude/skills uses flat <name>.md layout that Claude Code silently ignores — skills never register, adopt-vault propagates the defect

> **Resolved 2026-07-11** (backlog cleanup). Fixed by #316 — skills converted to the registered dir/SKILL.md layout.


## Description

**Root cause (from lilyetibot's debugged pattern, ~/Projects/M5Stack/lilyetibot/.claude/skills/README.md):** Claude Code discovers a skill only as a DIRECTORY containing a file named exactly SKILL.md (`.claude/skills/<name>/SKILL.md`). A flat `.claude/skills/<name>.md` file is silently ignored — no error, the skill just never appears. All five DocWright Claude skills (critique-plan, docwright-adopt-vault, docwright-session-start, endsession, status) use the flat layout, so none has ever been registered or invocable as a /command.

**Compounding effects:**
1. The entire read-and-execute-manually workaround (`.claude/SKILL-INVOCATION-RULES.md`, CLAUDE.md invocation section, the 2026-07-06 Skill("endsession") incident) exists to route around this undiagnosed defect.
2. `scripts/adopt-vault.ts` copySkillsBridge() copies `.claude/skills/*.md` flat files (`if (!f.endsWith('.md')) continue`), propagating the broken layout into every adopted vault (csdocs, cs-erp-images).
3. Two of the five files (critique-plan.md, status.md) also lack frontmatter entirely; endsession.md's body carries an "Invocation note" documenting the workaround.
4. Downstream failures attributed to skill quality (endsession runs bricked — GH #306, protected-main push bugs) were partly discoverability failures: the runbook was never loaded as a skill.

**Fix (BDFL-directed 2026-07-10, per lilyetibot README):** convert each skill to `.claude/skills/<name>/SKILL.md` with `name` matching the directory, `description` carrying what-it-does + exact trigger phrases, imperative runbook body; update copySkillsBridge to copy the directory layout; retire SKILL-INVOCATION-RULES workaround docs; add a layout guard to sync/CI so flat files are rejected (code-over-memory).

## System Info

DocWright main @ post-PR#305, Claude Code CLI, phoenix
