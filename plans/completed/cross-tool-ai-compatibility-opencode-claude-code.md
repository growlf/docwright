---
title: "Cross-Tool Compatibility: OpenCode and Claude Code Skills, Agents, and Governance Parity"
status: completed
author: NetYeti
created: 2026-06-06
tags:
  - architecture
  - opencode
  - claude-code
  - skills
  - agents
  - governance
  - compatibility
proposal_source: proposals/cross-tool-ai-compatibility-opencode-claude-code.md
priority: 4
mode: mentor
assigned_to: NetYeti
tests_defined: true
total_steps: 0
completed_steps: 0
_path: plans/cross-tool-ai-compatibility-opencode-claude-code.md
---

## Goal

Eliminate the divergence between OpenCode and Claude Code surface tooling. Skills defined
once should be discoverable from both tools. Governance rules should be enforced
consistently regardless of which tool is active. A CI gate verifies parity is maintained.

## Steps

| # | Step | Status |
|---|------|--------|
| 1 | Write `docs/specs/skill-format.md` — canonical skill format spec | ✅ |
| 2 | Write `docs/specs/agent-roles.md` — unified agent role contract | ✅ |
| 3 | Write `scripts/sync-claude-skills.ts` — auto-generate CLAUDE.md skills table | ✅ |
| 4 | Add `sync:skills` and `test:compat` to `package.json` scripts | ✅ |
| 5 | Run `npm run sync:skills` — regenerate CLAUDE.md with auto-generated table + SKILL.md links | ✅ |
| 6 | Write `test/compat/cross-tool.test.ts` — 10 tests verifying skill/table/role parity | ✅ |
| 7 | Add `.opencode/rules/governance-writes.md` — OpenCode behavioral write-block rule | ✅ |
| 8 | Update `scripts/claude-lifecycle-hook.sh` to check `$CLAUDE_AGENT_ROLE` alongside `$DOCWRIGHT_AGENT_ROLE` | ✅ |
| 9 | Update CI (`ci.yml`) to include `npm run test:compat` | ✅ |
| 10 | Verify all 10 compat tests pass and full test suite passes | ✅ |

## Tests

- [x] `test/compat/cross-tool.test.ts` — 10 tests (run: `npm run test:compat`)
  - [x] every skill dir has a SKILL.md
  - [x] every SKILL.md has required frontmatter (name + description)
  - [x] name matches directory
  - [x] CLAUDE.md contains auto-generated table markers
  - [x] every skill appears in CLAUDE.md table
  - [x] CLAUDE.md has no stale entries
  - [x] all SKILL.md path links point to real files
  - [x] agent-roles.md exists
  - [x] agent-roles.md defines all three roles
  - [x] skill-format.md exists

## History

| Date | Event | Detail |
|------|-------|--------|
| 2026-06-06 | created | Plan created from approved proposal |
| 2026-06-06 | steps 1-6 complete | specs, sync script, CLAUDE.md updated, 10/10 tests passing |
| 2026-06-06 | steps 7-10 complete | governance-writes rule, hook updated, CI wired, 100 tests passing |
