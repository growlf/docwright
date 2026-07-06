---
title: Web UI approve→plan generator omits _path → out-of-band backfill churns the plan file
status: resolved
author: NetYeti
author-role: contributor
created: 2026-07-06
category: bug
priority: medium
complexity: medium
estimated_effort: S
tags: []
milestone: v0.6.0
assigned_to: []
created_by: NetYeti@cluster-llm
---

> Found by dogfooding on 2026-07-06, right after approving
> [[proposals/approved/git-panel-branch-switcher]] (proposal → plan generated the plan file).

## Problem

Immediately after the plan was generated + committed, `plans/git-panel-branch-switcher.md` came
back **modified but uncommitted** — a runtime process rewrote it:

```diff
-automated: guided
+automated: full
 assigned_to: NetYeti
 tests_defined: false
 tests_human_reviewed: false
+_path: plans/git-panel-branch-switcher.md
```

## Investigation findings (2026-07-06)

The original framing above was partly wrong. Reproduced on the dogfood-dev instance:
reverted the plan to its committed state, then triggered every read path
(`GET /plans/<slug>.md`, `GET /api/status`, `GET /api/read?path=…`) — the file **stayed
clean**. So this is **not** a perpetual read-time write-back; reads do not touch the file,
and `get_plan` is read-only. The churn was a **one-time out-of-band write** during the
approve flow.

1. **`_path` is NOT a derived leak — it's a legitimate persisted self-locator.**
   `moveDocument` ([[src/dispatch/vault-write.ts]] step 4) and `src/mcp/lib/paths.ts`
   deliberately keep `_path:` in sync when a doc moves, and **108 committed docs already
   carry it**. The MCP plan generator (`src/mcp/tools/transitions.ts:191`) writes it at
   generation time. The actual defect: the **Web UI** plan generator
   (`src/webui/.../approve-proposal/plan-generator.ts`) was the **one generator that omitted
   it**, so a subsequent normalize/move backfilled `_path` out-of-band → the uncommitted
   diff. Fix: emit `_path` at generation time so the plan is born complete and consistent
   with `transitions.ts` and the rest of the vault — nothing has to backfill it later.
2. **`automated: guided → full`** was a **one-time, non-recurring** change (reads never
   reproduce it) whose source could not be pinned — most likely a deliberate UI
   automation-mode set or a one-time normalize, not a passive write-back. Not chased
   further; if a systematic flip surfaces again, file it separately with a repro.

## Fix

- `plan-generator.ts` / `AssemblePlanInput` now emit `_path: plans/<slug>.md` (caller passes
  `planPath: planRel`), matching `transitions.ts` and the 108 existing docs.
- Regression test in `test/webui/plan-generator.test.ts` asserts `_path` is written.

## Acceptance

- Reading/opening/processing a plan does **not** modify its file on disk. ✅ (verified — reads
  are clean)
- The Web UI approve→plan generator emits `_path` at birth, so no out-of-band backfill
  re-dirties the file. ✅
