---
title: "Deferred: Cross-tool agent definition sync (.opencode/agents ↔ .claude/agents)"
author: NetYeti
author-role: contributor
created: 2026-07-04
tags:
  - cross-tool
  - agents
  - automation
  - code-over-memory
complexity: low
estimated_effort: S
priority: 4
deferred: true
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - policies/core/code-over-memory.md
  - scripts/sync-claude-skills.ts
milestone: backlog
---

## Problem

DocWright now defines subagents in two places: `.opencode/agents/*.md`
(OpenCode format: `mode`, `triggers`, `permission`) and `.claude/agents/*.md`
(Claude Code format: `name`, `description`, `tools`). The bodies are nearly
identical system prompts, but each surface needs its own frontmatter dialect.

Today the two copies are kept in sync only by an HTML comment ("keep the two
in sync") — memory, not code. This is the exact failure mode that already
dropped `docwright-issue-workflow` from git for a week, and the same one
`scripts/sync-claude-skills.ts` was built to prevent for skills.

## Proposed Solution

Extend the cross-tool sync layer to agents:

1. A single canonical agent definition per agent (shared body + a small
   frontmatter map per surface), or a generator that reads
   `.opencode/agents/*.md` and emits `.claude/agents/*.md` with translated
   frontmatter (`permission.bash: deny` → drop `Bash` from `tools`, etc.).
2. Wire it into `npm run sync:skills` (or a sibling `sync:agents` script).
3. Add a `test/compat/` check: every OpenCode agent has a Claude counterpart
   whose body matches, failing CI on drift.

## Alternatives Considered

- Keep manual sync with comments — rejected: violates code-over-memory and
  already proven to fail for skills.
- Claude-only agents — rejected: multi-perspective review policy requires
  the same capabilities on both surfaces.

## Future

Extend the same generator to Gemini (`.gemini/agents/`) when that surface
gains agent support.
