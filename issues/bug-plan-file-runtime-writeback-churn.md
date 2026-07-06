---
title: "Runtime writes derived fields (_path, automated) back into tracked plan files → churn"
status: open
author: NetYeti
author-role: contributor
created: 2026-07-06
category: bug
priority: medium
complexity: medium
estimated_effort: S
tags:
  - plans
  - lifecycle
  - reproducibility
  - dogfooding
milestone: v0.5.0
created_by: "NetYeti@cluster-llm"
assigned_to: ""
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

Two problems:
1. **`_path` is a derived/internal field leaking into the persisted file** — it just repeats the
   file's own path. It should never be written back into the doc.
2. **An `automated: guided → full` flip** appeared as an untracked write-back (not via a
   deliberate MCP mutation), so its provenance is unclear.

This is the same **"runtime modifies a tracked file"** class as the `opencode.jsonc` churn (#194)
and the `.docwright` cache — but here it's a **governed plan file**, which is supposed to change
only through the MCP tools (`set_plan_field`, `append_history`, …), not be passively rewritten on
read/normalize.

## Impact

- The vault goes **perpetually dirty** (any read/process re-writes the plan), which — among other
  things — trips the git branch-switcher's dirty-guard we just added.
- Noisy `git status`; risk of derived/internal fields being committed into governed docs.

## Investigation / Fix direction

- Find what persists these fields (a `get_plan` / plan-normalize / executor path that writes the
  in-memory plan — including derived `_path` — back to disk).
- **Never serialize derived/internal fields** (`_path`, etc.) into the on-disk plan; strip them
  before any write.
- Confirm whether `automated: guided → full` is an intended normalization; if so it should happen
  once via an explicit MCP mutation, not as a passive read-time write-back.

## Acceptance

- Reading/opening/processing a plan does **not** modify its file on disk.
- Derived fields (`_path`) never appear in a committed/serialized plan.
