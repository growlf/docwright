---
title: "Web UI rewrites plan frontmatter just from viewing it (automated: full, tests_defined: true)"
status: open
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: high
complexity: medium
estimated_effort: M
tags:
  - webui
  - governance
  - data-integrity
  - plans
created_by: "NetYeti@cluster-llm"
assigned_to: ""
closed_by_pr: ""
cross_link: "issues/bug-webui-lifecycle-actions-not-committed-to-git"
---

> Found 2026-07-01 while dogfooding #68. Sibling of
> [[issues/bug-webui-lifecycle-actions-not-committed-to-git]] — same surface, same
> "the UI writes to disk unexpectedly" family, but this one fires on *read*, not on an
> explicit action.

## Problem

Opening a plan in the Web UI (the properties/detail view) **rewrites the plan file's
frontmatter on disk** without any explicit save. Observed on
`plans/separate-dev-tracking-milestones-and-beta-channel.md`:

```
-automated: guided
+automated: full
-tests_defined: false
+tests_defined: true
```

## How it was isolated

During the session the plan kept reverting to `automated: full` after being restored.
Diagnosis eliminated every other candidate:

1. A 2-minute file watch with **zero actions** showed **no** change → not a passive daemon.
2. The `lifecycle-processor.py --watch` daemon is pointed at a *different* repo
   (`bms-ai-cluster`), not DocWright.
3. The test suite was ruled out for this field (that was a separate audit-log leak, fixed
   in the test-isolation PR).
4. **The mutations correlated exactly with the plan being open in the browser, and stopped
   the moment it was closed** — confirmed live with the user.

The webui runs with the real `DOCWRIGHT_ROOT`, so its writes hit real files.

## Impact

The UI silently mutates governance documents' state (`automated`/`tests_defined`) just by
being viewed. That:
- corrupts plan state without human intent (violates "frontmatter is source of truth"),
- produces phantom `git` diffs that get committed by accident,
- and combined with [[issues/bug-webui-lifecycle-actions-not-committed-to-git]], leaves the
  working tree dirty with changes nobody made.

## Proposed Fix

- The detail/properties view must be **read-only on load** — never write frontmatter unless
  the user explicitly edits and saves.
- Find the code path that normalizes/"improves" a plan on view (likely a frontmatter
  normalizer defaulting `automated`/`tests_defined`) and gate it behind an explicit action.
- Do not coerce `automated: guided → full` or `tests_defined: false → true`; preserve
  on-disk values verbatim unless changed by the user.

## Verification

- Open a plan in the UI, navigate away → `git diff` on that plan is empty.
- Editing + saving in the UI writes only the fields the user changed.
