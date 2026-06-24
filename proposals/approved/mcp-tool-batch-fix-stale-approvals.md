---
title: "MCP Tool or npm Script: Fix Stale Approved Proposals Not in proposals/approved/"
author: NetYeti
created: 2026-06-06
tags:
  - workflow
  - lifecycle
  - mcp
  - proposals
  - tooling
priority: 4
complexity: low
estimated_effort: S
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/approved/mcp-tool-batch-fix-stale-approvals.md
consumed_by: plans/completed/plan-mcp-tool-or-npm-script-fix-stale-approved-proposals-not-in-proposals-approved.md
---
## Problem

This proposal exists because we ran the following one-off script to fix 17 approved proposals that were stranded in `proposals/` root instead of `proposals/approved/`:

```bash
for f in $(grep -l "^approved: true" proposals/*.md); do
  slug=$(basename "$f")
  git mv "proposals/$slug" "proposals/approved/$slug"
done
```

This is a recurring lifecycle invariant violation. Proposals with `approved: true` must live in `proposals/approved/`. When the approval flow is bypassed (frontmatter edited directly, or approved via a tool that doesn't move the file), the violation accumulates silently.

We will hit this again. The script will be rediscovered. It should be a tool.

## Proposed Solution

### Option A — CI check (preferred first step)

Add a check to `test/compat/cross-tool.test.ts` or a dedicated `test/lifecycle/invariants.test.ts`:

```typescript
it('no approved proposals exist outside proposals/approved/', () => {
  const stale = glob('proposals/*.md').filter(f =>
    parseFrontmatter(readFileSync(f)).approved === true
  );
  assert.deepEqual(stale, [],
    `Stale approved proposals found: ${stale.join(', ')}. Run: npm run fix:stale-approvals`
  );
});
```

This catches the violation on every CI run and gives a clear fix command.

### Option B — npm script `fix:stale-approvals`

```typescript
// scripts/fix-stale-approvals.ts
// Finds proposals/*.md with approved: true and moves them to proposals/approved/
// using git mv to preserve history. Reports what it moved.
```

Runnable as `npm run fix:stale-approvals` — safe to run repeatedly (idempotent). Output: list of files moved, or "Nothing to fix."

### Option C — MCP tool `fix_stale_approvals`

Expose the same logic as an MCP tool so both Claude Code and OpenCode can call it without shell access:

```
fix_stale_approvals() → { moved: string[], skipped: string[] }
```

Validates each file before moving: `approved: true` present, not already in `approved/`. Logs to audit trail.

## Recommended approach

Implement in order: **A → B**. CI check first (catches it instantly), npm script second (fixes it without shell improvisation). Option C if MCP ergonomics warrant it after A+B are in place.

## Relationship to Existing Work

| Proposal / Policy | Relationship |
| --- | --- |
| \[\[proposals/one-off-scripts-trigger-formalization-proposals.md\]\] | This proposal exists because of that rule — retroactive application |
| \[\[policies/core/code-over-memory.md\]\] | The one-off loop is memory; the CI check + script is code |
| \[\[proposals/cross-tool-ai-compatibility-opencode-claude-code.md\]\] | fix:stale-approvals should be runnable from both tools |

## Out of Scope

| Idea | Why deferred |
| --- | --- |
| Auto-fixing on commit | The hook already catches `approved: true` in wrong location — fix on commit is redundant |
| Auto-fix as part of the Web UI Approve button | Already fixed: saveFrontmatter now calls handleApprove automatically |