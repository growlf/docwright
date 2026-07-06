---
title: "MCP Server Stale dist/ Detection — Rebuild or Warn on Start"
author: NetYeti
created: 2026-06-25
tags:
  - mcp
  - dx
  - reliability
  - tooling
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
milestone: backlog
---

## Problem

On 2026-06-25, the Phase 3 transition to `completed` was silently blocked for an entire session because `dist/mcp/lib/steps.js` was compiled on 2026-06-22 — three days before the Implementation Steps table was extended from 4 columns to 6. The compiled `countSteps()` function read the **last column** (Branch) for `✅`, while the source had been updated to locate the Status column by header name. Result: all 14 steps reported as incomplete (0/14), blocking `update_plan_status completed`.

The failure mode was:
- Silent: no warning that dist was stale on server start
- Misleading: the error message said "has ⏳ pending steps" with no hint that the real problem was a build artifact mismatch
- Time-consuming: required reading compiled JS, running `countSteps` against the live file in Node, and `npm run compile` to resolve

`dist/` is gitignored, so there is no CI safety net for this. Any `npm run compile` skipped by a developer leaves the running server in an inconsistent state indefinitely.

## Proposed Solution

**Option A (Recommended): Rebuild on start if stale**

In `src/mcp/server.ts` (entry point), before registering any tools, check whether any `dist/mcp/**/*.js` file is older than its corresponding `src/mcp/**/*.ts` source. If stale, run `tsc -p tsconfig.json` automatically and log:

```
⚠  dist/ was stale — rebuilt before starting (took 2.3s)
```

This is fully transparent and requires zero developer action. The 2-3 second startup cost only pays when something changed.

**Option B: Warn and refuse to start if stale**

Same staleness check, but instead of rebuilding, print a clear error and exit:

```
ERROR: dist/ is stale. Run: npm run compile
       Stale files: dist/mcp/lib/steps.js (src modified 3 days ago)
```

Forces explicit rebuild but avoids any surprise mutation on start.

**Option C: Add a pre-start freshness check npm script**

`"prestart:mcp": "npx tsx scripts/check-dist-freshness.ts"` — runs before `start:mcp`, fails with a clear message if stale. Developers can bypass with `node dist/mcp/server.js` directly.

Recommendation: Option A for the MCP server entry point (transparent, zero friction), Option C as a belt-and-suspenders check in `package.json`.

## Implementation Notes

- Staleness check: `fs.statSync(distFile).mtimeMs < fs.statSync(srcFile).mtimeMs` for each `src/mcp/**/*.ts` → `dist/mcp/**/*.js` pair
- Auto-rebuild uses `execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' })`
- Add to `src/mcp/server.ts` before `new Server(...)` instantiation
- The `scripts/check-dist-freshness.ts` variant can be shared with CI

## Alternatives Considered

- **Commit dist/ to git** — makes the repo large and creates merge conflicts on every compile. Not recommended.
- **Always rebuild on start** — adds 2-3s to every server start unconditionally. Wasteful.
- **Trust developer discipline** — the incident on 2026-06-25 proves this is insufficient.

## Future

This pattern generalises: any tool that ships compiled artifacts alongside source (atoms, dispatch module) benefits from the same freshness check.
