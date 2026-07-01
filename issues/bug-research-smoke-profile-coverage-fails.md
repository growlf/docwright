---
title: "research-smoke tests fail: asset-management profile missing research type; test hardcodes '4 profiles'"
status: open
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: medium
complexity: low
estimated_effort: S
tags:
  - testing
  - profiles
  - schema
created_by: "NetYeti@cluster-llm"
assigned_to: ""
closed_by_pr: ""
cross_link: ""
milestone: v0.5.0
---

> Found 2026-07-01 during the test-isolation work — surfaced when the full `npm test`
> was run (the dispatch-only runs used earlier never exercised the integration suite).
> Confirmed **pre-existing**: the failures reproduce with the test-isolation changes
> stashed (13 passing / 3 failing either way), so they are not caused by that fix.

## Problem

`test/integration/research-smoke.test.ts` has 3 failing assertions:

```
Research smoke test — profile coverage
  schema.json exists in all 4 profiles with research type:
    AssertionError: asset-management/schema.json missing research type definition
```

Two distinct issues are tangled here:

1. **The `asset-management` profile's `schema.json` has no `research` document type**, while
   the test asserts every profile defines one.
2. **The test hardcodes "4 profiles"** but the repo now ships more (`asset-management`,
   `doc-lifecycle`, `infra-topology`, `knowledge-base`, `org-operations`, and — once #82
   lands — `docwright-dev`). The count and the per-profile expectation are stale.

## Impact

`npm test` is **red** on `main` independent of feature work, which erodes the "test verified
at every stage" guarantee and masks new regressions (a red suite trains people to ignore
failures). Note `docwright-dev` (from #82) also has no `research` type by design, so this
assertion will flag it too unless the expectation is corrected.

## Proposed Fix

Decide the intended contract, then make code + test agree:
- **If `research` is universal:** add a `research` type (schema + template) to
  `asset-management` (and any profile genuinely meant to support it), and stop hardcoding the
  profile count — iterate over the actual `src/profiles/*` dirs.
- **If `research` is opt-in:** change the test to assert `research` only for profiles that
  declare it (e.g. via a `documentTypes` include check), not all of them.

Prefer discovering profiles dynamically so adding a profile never silently breaks or is
missed by this test.

## Verification

- `npm test` is green on `main`.
- Adding or removing a profile does not require editing a hardcoded count in this test.
