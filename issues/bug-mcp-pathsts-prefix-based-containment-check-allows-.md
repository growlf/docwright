---
title: MCP paths.ts: prefix-based containment check allows path traversal; three helpers unchecked
status: resolved
created: 2026-07-11
author: Claude (Fable 5) via Cowork — verified from Gemini Antigravity Round 5 finding
author-role: user
category: bug
priority: critical
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-11]
channel: dev
resolved_by: src/mcp/lib/paths.ts (fix/mcp-paths-containment)
tags:
  - reported-bug
---

> **Resolved 2026-07-11.** Replaced the prefix `startsWith(REPO_ROOT)` guard (and
> added guards to the previously-unchecked `fileExists`/`getMtime`/`globFiles`)
> with a single canonical `resolveSafe()` helper used by every I/O function:
> resolve against the root, then require `path.relative(root, full)` to not climb
> out (`..` / `../…`) and not be absolute. Regression test `test/mcp/paths.test.ts`
> covers the sibling-prefix bypass, dot-dot traversal in all six helpers, and
> absolute escapes — **verified it fails on the old code and passes on the fix**;
> full `test:mcp` green (99 tests). Wired into the `test:mcp` script.

# MCP paths.ts: prefix-based containment check allows path traversal; three helpers unchecked

## Description

Two related containment failures in src/mcp/lib/paths.ts (found by Gemini Round 5 review of the agent-roles proposal, verified in code 2026-07-10):

1. readFile/writeFile/moveFile guard with fullPath.startsWith(REPO_ROOT) with no trailing path separator. Any sibling directory sharing the vault root name prefix passes (e.g. root /x/DocWright-cowork admits /x/DocWright-cowork-evil/file via relPath ../DocWright-cowork-evil/file).
2. fileExists, getMtime, and globFiles perform NO containment check at all: getMtime('../../etc/passwd') and globFiles('../../anydir') operate outside the vault today (existence/mtime oracle + arbitrary directory listing).

Fix: canonical containment helper — resolve then require rel = path.relative(REPO_ROOT, fullPath) with !rel.startsWith('..') && !path.isAbsolute(rel) — applied in every exported function; unit tests for sibling-prefix and dot-dot cases. Security-relevant for the agent-roles dispatch-layer enforcement design (Annex A), which assumes MCP-side file access is vault-contained.

## System Info

branch docs/agent-roles-research-rounds @ 0005bb6
