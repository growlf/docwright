---
title: "Completing a plan writes a stray docs/ duplicate and doesn't live-refresh the panel"
status: open
author: NetYeti
author-role: contributor
created: 2026-06-30
category: bug
priority: high
complexity: medium
estimated_effort: M
tags:
  - webui
  - lifecycle
  - data-integrity
  - reactivity
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: v0.5.0
---

> Found by dogfooding on 2026-06-30 completing the `governance-engine-view-container`
> plan through the Web UI (Properties pane → Complete).

## Problem

Clicking **Complete** on a plan does the right primary action — moves it to
`plans/completed/` with `status: completed` + `completed_date` — but also has two
defects:

**Symptom A (data integrity).** Completion writes a **stray duplicate** to
`docs/<plan-name>.md` in addition to the correct `plans/completed/<plan-name>.md`.
The two copies differ (the `docs/` one has a re-serialized, quote-wrapped
frontmatter), so completion produces two divergent files for one plan. `docs/` is
not where completed plans belong.

**Symptom B (reactivity).** After Complete succeeds, the left panel (file tree /
governance lifecycle view) does **not** update — the plan still appears active
until a manual page refresh. The lifecycle move doesn't trigger a live refresh.

## Steps to Reproduce

1. Open a plan at `status: in-progress` with its gates satisfied.
2. Properties pane → **Complete**.
3. Observe: `plans/completed/<name>.md` created (correct) **and**
   `docs/<name>.md` created (stray duplicate).
4. Observe: the left panel still shows the plan as active until you refresh.

## Expected vs Actual

**Expected:** Complete moves the plan to `plans/completed/` only (one file), and
the UI live-updates the tree/lifecycle view without a manual refresh.

**Actual:** Two files written (one stray in `docs/`); the panel is stale until refresh.

## Environment

DocWright Web UI (SvelteKit dev, :5173), 2026-06-30 dogfooding session. Observed
completing `plans/governance-engine-view-container.md`.

## Proposed Fix

- **Symptom A:** audit the Complete / `setPlanStatus('completed')` path and the
  vault-write/move logic — something writes a second copy to `docs/`. Ensure
  completion performs a single move to `plans/completed/` and writes no `docs/`
  copy. (Also: the `docs/` copy's re-serialized frontmatter hints the same
  full-file re-serialization seen in the WYSIWYG bug — see related.)
- **Symptom B:** emit the file-change/SSE event (or invalidate the tree store) on
  lifecycle transitions so the panel refreshes live, as create/rename/delete do.

## Related

- [[proposals/bug-wysiwyg-editor-corrupts-documents]] — same full-file re-serialization smell
- [[plans/completed/governance-engine-view-container]] — the plan completed when this was found
- [[policies/core/bugs-before-features]]
