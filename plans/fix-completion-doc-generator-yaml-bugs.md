---
title: Fix completion-doc generator's invalid YAML output
status: in-progress
author: NetYeti
created: 2026-07-11
tags:
  - lifecycle
  - docs
  - yaml
proposal_source: proposals/fix-completion-doc-generator-yaml-bugs.md
priority: medium
complexity: low
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
scenario_synthesis: "Happy path: completing a plan whose title contains a colon or other YAML-special characters produces a docs/<plan>.md whose frontmatter js-yaml parses cleanly. Failure avoided: generateCompletionDoc's raw string interpolation emits unquoted title: Foo: Bar -> YAMLException on load. Fix pattern (code-over-memory): serialize frontmatter with a YAML-safe serializer, not string interpolation — the same class hit in more than one generator."
total_steps: 4
completed_steps: 4
tests_last_run: "2026-07-12T09:18:13.560Z"
tests_last_result: pass
tests_last_commit: 828a247
---

# Fix completion-doc generator's invalid YAML output

## Overview

`generateCompletionDoc()` (`src/dispatch/completion-doc.ts`) — shared by the MCP
`transition_to_completed` tool and the Web-UI `/api/lifecycle/transition-completed`
route — builds `docs/<plan>.md` frontmatter via raw string interpolation with no
YAML-safe quoting, so a title containing a colon (e.g. `Wave C — …UX: modal form…`)
emits invalid YAML that `js-yaml` refuses to load. Fix at the root: serialize with a
YAML-safe serializer. Two related sub-bugs (#136 created-date, #185 tags) appear
already fixed/guarded — verify and close rather than re-fix. Full detail:
[[proposals/fix-completion-doc-generator-yaml-bugs]].

## Constraints & Invariants

1. **Serialize, don't interpolate.** Emit frontmatter via a YAML-safe serializer
   (`js-yaml` dump, already a dependency) or correct quoting — never raw `${}`.
2. Verify by RUNNING the generator on a colon/special title and loading the output
   with `js-yaml` (must not throw).

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | YAML-safe frontmatter serialization | In `src/dispatch/completion-doc.ts` `generateCompletionDoc()`, replace the raw `title: ${title}` / `author:` / string interpolation with YAML-safe output — either build a frontmatter object and `yaml.dump()` it, or quote/escape each scalar. Keep the field set + order stable. Verify: generate a doc for a plan titled `Foo: bar | baz` and load the frontmatter with `js-yaml` — no exception. | ✅ Done |
| 2 | Regression test (colon + special-char titles) | Add a unit test in `test/dispatch/`: `generateCompletionDoc` output for titles containing `:`, `|`, quotes, and `#` all parse via `js-yaml.load` with the expected `title` value round-tripping. Verify it FAILS on the pre-fix generator and passes on the fix. | ✅ Done |
| 3 | Verify + close the #136 created-date half | Confirm `created:` is pulled from the source plan's ISO frontmatter (not a raw JS `Date`) and emits a clean ISO date (proposal says already fixed). If confirmed, note it in the doc and close that half of #136; if not, fix it here. | ✅ Done |
| 4 | Verify + harden the #185 tags half | Confirm array tags go through `formatYamlList`; harden the string-tag branch (`tags:\n  - ${tagsStr}`) so a tag with YAML-special characters can't break output (route it through the same safe serializer). Verify with a real multi-tag plan + a special-char tag. | ✅ Done |

## Testing Plan

*   Step 1/2: unit test — `generateCompletionDoc` output for `:`/`|`/quote/`#` titles parses via `js-yaml`; fails on old generator, passes on fix.
*   Step 3: confirm `created:` is a clean ISO date sourced from the plan (repro on a real plan).
*   Step 4: multi-tag + special-char-tag plan produces parseable `tags:`.
*   Full `test:dispatch` + `test:mcp` green (both surfaces share the generator).

## Phase Gate

*   `generateCompletionDoc` emits YAML that `js-yaml` loads for any title (colon/pipe/quote/#).
*   Regression test covers the special-character title cases.
*   #136 created-date + #185 tags halves verified (fixed/guarded) and their issues closed.
*   `tests_defined` + human review confirmed; `test:dispatch` + `test:mcp` green.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the approved proposal. Status draft, awaiting BDFL approval. | NetYeti |
| 2026-07-12 | Test run recorded via verify_plan_tests: npm run test:dispatch → PASS @ 828a247 | NetYeti |
| 2026-07-12 | Delivered via PR #334 (merged). generateCompletionDoc now serializes frontmatter with yaml.dump instead of raw string interpolation, so colon/pipe/quote/hash titles parse cleanly; tags normalized + dumped safely (#185); created sourced from plan frontmatter, not a JS Date (#136). Regression test in test/dispatch/completion-doc.test.ts. 4/4 done, test:dispatch PASS. Staged for completion. | NetYeti |
