---
title: "One-Off Scripts Must Trigger Formalization Proposals"
author: NetYeti
created: 2026-06-06
tags:
  - workflow
  - governance
  - automation
  - skills
  - tools
  - meta
priority: 4
complexity: low
estimated_effort: S
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

Every time an AI agent (Claude Code or OpenCode) runs a one-off bash script,
ad-hoc Python snippet, or manual multi-step command to accomplish a recurring
task, it represents a failure of the "code over memory" principle. The operation
is implicitly known to be needed, but it is not formalized — so it will be
re-derived from scratch the next time, possibly differently, possibly incorrectly.

Examples from recent sessions:
- `for f in proposals/*.md; do git mv ...` — batch-move stale approved proposals
  (done ad-hoc; should be `npm run fix:stale-approvals` or an MCP tool)
- `grep -l "^approved: true" proposals/*.md` — detect misplaced approved proposals
  (repeated across sessions; should be a dispatch API endpoint or CI check)
- Direct `set_plan_field` calls to fix missing `completed_date` — symptom of the
  `transition-completed` endpoint not always setting it (fix the endpoint, not the patch)

The pattern is always the same: a one-off fills a gap. The gap closes temporarily.
The next session rediscovers the gap and fills it again, slightly differently.

## Proposed Solution

### 1. The rule (for both AI agents)

Whenever an AI agent runs a one-off script or ad-hoc command that:
- Operates on multiple files or records
- Is triggered by a recurring lifecycle event (approve, complete, close, audit)
- Has been done before (in this session or mentioned in session notes)

…the agent MUST immediately ask:

> "Have I done this before? If yes: should this be a **skill**, **MCP tool**,
> **npm script**, **dispatch API**, or **subagent design**? If yes: create a
> `priority: 4` proposal before moving on."

The proposal captures what the formalized version should do — it does NOT need
to be implemented immediately, just captured so it is not lost.

### 2. Detection heuristics

An operation is a formalization candidate if it matches any of:
- Multi-file loop (`for f in ...; do git mv/sed/grep ...`)
- Repeated grep pattern across lifecycle directories
- A "fix" applied after a failed commit or hook rejection that will recur
- A script called more than once within a session with similar args
- Any command the agent had to derive from memory or prior session notes

### 3. Proposal template for formalization

When creating the formalization proposal, include:

```
- What the one-off did (exact command or pseudocode)
- What lifecycle event triggers it
- Proposed form: skill | MCP tool | npm script | dispatch endpoint | CI check
- Why it must not remain ad-hoc
```

Priority: always `4` (high — this is a known recurring gap).

### 4. Wire the rule into both AI contexts

The rule must appear in:
- `opencode.json` instructions (OpenCode sees it on every session start)
- `CLAUDE.md` (Claude Code sees it on every session start)
- `.opencode/rules/one-off-formalization.md` (always-active OpenCode rule)

This ensures both tools enforce it without relying on human reminders.

## Relationship to Existing Work

| Policy / Proposal | Relationship |
|-------------------|-------------|
| [[policies/core/code-over-memory.md]] | This is a direct application — one-off scripts are "memory"; formalized tools are "code" |
| [[proposals/cross-tool-ai-compatibility-opencode-claude-code.md]] | Skills and tools created by this process must be registered in both tool contexts |
| [[proposals/automated-test-lifecycle.md]] | Same pattern — automate what AI currently does by hand |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-detection of one-offs in session transcripts | Interesting but Phase 3+; rule is enough for now |
| Automated proposal creation without human review | Proposals are cheap; the proposal draft is the right stopping point |
| Retroactive audit of all past sessions for one-offs | Useful once; do it as a single docwright-raw-proposal pass |
