---
title: MCP server — rebuild or warn on stale dist/ at start
status: draft
author: NetYeti
created: 2026-07-11
tags:
  - mcp
  - build
  - dx
proposal_source: proposals/mcp-server-stale-dist-detection.md
priority: medium
complexity: low
automated: guided
assigned_to: ""
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Happy path: on MCP server start, if any dist/mcp/**/*.js is older than its src/mcp/**/*.ts source, rebuild automatically (or at minimum warn loudly) before registering tools — so a stale build never silently produces wrong behaviour. Failure avoided: the 2026-06-25 incident where a 3-day-stale dist/mcp/lib/steps.js miscounted steps (0/14) and silently blocked a phase completion for a whole session, with a misleading 'pending steps' error and no build-staleness hint. dist/ is gitignored so there is no CI safety net."
total_steps: 2
completed_steps: 0
---

# MCP server — rebuild or warn on stale dist/ at start

## Overview

`dist/` is gitignored, so a developer who skips `npm run compile` leaves the running
MCP server on a stale build indefinitely — which once silently blocked a phase
completion for a whole session (stale `countSteps` read the wrong column). Detect
staleness at start and self-heal. Full detail:
[[proposals/mcp-server-stale-dist-detection]].

## Constraints & Invariants

1. Transparent + cheap: the staleness check runs at startup; the rebuild cost is
   only paid when something actually changed.
2. Loud, not silent: if rebuilding (or if a rebuild is skipped/failed), log clearly
   so the operator knows the running code matches source.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Stale-dist check + rebuild on start | In `src/mcp/server.ts` (entry point), BEFORE registering tools, compare mtimes: if any `dist/mcp/**/*.js` is older than its corresponding `src/mcp/**/*.ts` (or any src is newer than the newest dist), run `tsc -p tsconfig.json` and log `⚠ dist/ was stale — rebuilt before starting (took Ns)` (Option A from the proposal). If the rebuild fails, log a loud error and refuse to start on a known-stale build rather than serving wrong behaviour. Verify: touch a src file after building, start the server → it rebuilds + logs; start with fresh dist → no rebuild. | ⏳ Pending |
| 2 | Test the staleness predicate | Factor the "is dist stale vs src" comparison into a pure, testable function and unit-test it: newer-src → stale=true; fresh → false; missing dist → stale. (Keeps the startup path deterministic + regression-safe.) Verify: `test:mcp` covers the predicate. | ⏳ Pending |

## Testing Plan

*   Step 1: runtime — touch a `src/mcp/**/*.ts`, start the server, observe the rebuild + log; fresh dist starts with no rebuild.
*   Step 2: unit test on the staleness predicate (newer-src/fresh/missing-dist cases).
*   `test:mcp` green.

## Phase Gate

*   The MCP server never serves a stale build silently — it rebuilds (or refuses + warns loudly) at start.
*   The staleness comparison is a tested pure function.
*   `tests_defined` + human review confirmed; `test:mcp` green.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the proposal (Option A: rebuild-on-start-if-stale). Status draft, awaiting BDFL approval. | NetYeti |
