---
title: "Harden AI-agent plan/proposal lifecycle tooling"
author: Claude (on behalf of user)
created: 2026-07-10
tags:
  - lifecycle
  - mcp
  - webui
  - tooling
approved: true
created_by: "claude@claude-code"
assigned_to: NetYeti
sources:
  - issues/bug-proposal-to-plan-lifecycle-transition-duplicates-a.md
  - issues/bug-updatestep-row-replacement-corrupts-table-when-det.md
  - issues/bug-web-ui-complete-button-only-sets-status-field-neve.md
  - issues/bug-web-ui-run-tests-button-never-persists-testslastre.md
consumed_by: plans/plan-harden-ai-agent-plan-proposal-lifecycle-tooling.md
automated: full
---

# Harden AI-agent plan/proposal lifecycle tooling

## Problem

Four independent bugs surfaced in a single session of otherwise-normal plan/proposal work, all sharing the same shape: **the tool appears to succeed, but silently does the wrong thing or corrupts state**, and the human or AI operating it has no way to tell without manually cross-checking the filesystem.

1. **Proposal→plan transition duplicates `approved/` paths.** Transitioning a proposal to approved and generating its plan intermittently (a) moves the proposal to a doubly-nested `proposals/approved/approved/<name>.md` instead of `proposals/approved/<name>.md`, and (b) leaves an orphan skeleton plan at `plans/approved/<name>.md` (status: draft, empty steps) alongside a separately-generated, fully-authored plan at `plans/<name>.md`. Both artifacts' cross-references (`proposal_source`, `consumed_by`) end up pointing at paths that don't exist. Observed twice — once already committed to the repo from an earlier session (`plans/approved/release-v0.5.0.md`), once caught mid-transition this session before it could land.

2. **`update_step` corrupts the Implementation Steps table when a Details cell contains an unescaped `|`.** A cell documenting a literal pipe (e.g. `` `category: bug|feature` ``) desyncs the tool's row-parsing, truncating the cell text and duplicating the Status cell (`✅ Done | ⏳ Pending`). The corruption is silent — the tool reports success. A related regression in the same code path flipped `tests_defined` from `true` to `false` with no corresponding edit.

3. **The Web UI's "Complete" button only sets `status: completed` in frontmatter.** It never moves the plan to `plans/completed/`, never generates the completion doc, and never navigates anywhere — it just closes with a toast. The equivalent, correct behavior already exists as the `transition_to_completed` MCP tool, but the button doesn't call it or anything like it. A user clicking Complete sees no error and no confirmation beyond the button disappearing, and is left to wonder whether it worked.

4. **The Web UI's "Run Tests" button never persists a test-run record.** It only sets in-memory component state (`testPassed`) used to decide whether to show "Certify Tests." Because `transition_to_completed` hard-requires a recorded `tests_last_result` (written by the separate `verify_plan_tests` MCP tool), any plan taken through the UI's Run Tests → Certify Tests → Complete flow will always fail completion with "no recorded test run" — even though a human genuinely ran and certified the tests through the UI. There is currently no way to produce a valid completion from the Web UI alone.

**Why bundle these four:** each is a different manifestation of the same underlying gap — the MCP tools and their Web UI counterparts have drifted apart, each side implementing partial or divergent logic instead of sharing one source of truth. Bugs 3 and 4 are the same drift pattern (`transition_to_completed` vs. the Complete button; `verify_plan_tests` vs. the Run Tests button). Fixing them together, with a shared principle, is more valuable than four disconnected patches.

## Proposed Solution

**1. Proposal→plan transition path duplication**
- Audit the transition script's path-construction logic for the case where the source path already contains `approved/` (likely a naive string concatenation appending `approved/` unconditionally rather than checking).
- Audit why plan-generation appears to run twice per transition (producing both the thin skeleton and the full plan) — dedupe to a single invocation.
- Add a regression test: transitioning a proposal already partway through relocation must not double-nest, and must produce exactly one plan file.

**2. `update_step` table corruption**
- Fix row-parsing to split table cells only on true cell-boundary pipes, respecting backtick-fenced code spans (or any inline code) that may contain a literal `|`.
- Add a regression test: marking a step done when its Details cell contains an unescaped `|` inside a code span must leave every other cell, and the frontmatter fields around it, untouched.
- Investigate whether the same code path is responsible for the `tests_defined` flip and fix at the root if so.

**3. Web UI "Complete" button**
- Add a server endpoint (or reuse the MCP tool's underlying function directly from the webui server) that performs the same work as `transition_to_completed`: move the plan to `plans/completed/`, generate the completion doc.
- Wire the Complete button to call it, then navigate to `/status` on success, matching the user's reasonable expectation (and matching what "Complete" already implies elsewhere in the app).
- Surface a clear error (not a silent no-op) if the same gates `transition_to_completed` enforces (e.g. no recorded test run) are not met, ideally *before* the button is enabled rather than after clicking it.

**4. Web UI "Run Tests" button**
- Wire `runTests()` to call the same underlying logic `verify_plan_tests` uses, so a passing run persists `tests_last_result` / `tests_last_run` / `tests_last_commit` to the plan's frontmatter exactly as the MCP tool does.
- This both fixes the immediate bug and is a prerequisite for #3's gate-checking to work correctly from the UI.

**Cross-cutting:** for both #3 and #4, the fix should factor the real logic into a function shared by the MCP tool and the Web UI API route (matching this repo's own `code-over-memory` policy), not reimplement it a second time in the webui server. This prevents the next feature added to one surface from silently missing the other.

## Alternatives Considered

**Fix each bug as a separate, independent PR.** Rejected — the four share a root cause (MCP/Web UI logic drift) and a shared fix pattern (extract-and-share instead of reimplement). Bundling makes that pattern explicit and easier to review as one coherent architectural fix rather than four unrelated patches that happen to land in the same week.

**Leave `update_step`'s pipe-in-cell bug as "just don't put `|` in cell text."** Rejected — documenting a literal pipe character (e.g. `category: bug|feature`, a valid TypeScript union) inside a code span is a completely reasonable and foreseeable thing to write in a plan. Silently corrupting the table instead of handling it is exactly the kind of gap `policies/core/code-over-memory.md` says should be enforced by code, not avoided by convention.

**Have the Web UI just call the MCP tools directly instead of adding new API endpoints.** Considered, but the Web UI's server already has its own frontmatter-mutation code paths (separate from the MCP server process) for other document types; the pragmatic fix is a shared TypeScript function both surfaces import, not a runtime dependency of the webui process on the MCP server process.

## Future

- A test suite that exercises MCP tool + Web UI endpoint pairs *together* (e.g. "certifying via the API produces a plan `transition_to_completed` will accept") would catch this class of drift automatically, rather than relying on someone hitting it manually in a live session, as happened here.
- Once the location-invariant class of bug (proposal→plan duplication) is fixed, consider extending `pre-commit`'s `validate_no_duplicate_locations` check (which already catches `proposals/approved/` + `proposals/` root duplicates) to also catch the `plans/approved/` skeleton-orphan pattern specifically, as defense in depth.

## Success Criteria

- [ ] Transitioning a proposal to approved and generating its plan never produces a doubly-nested `approved/approved/` path or an orphan skeleton plan, verified by a regression test
- [ ] `update_step` marking a step done preserves every other cell's content when a Details cell contains an unescaped `|`, verified by a regression test
- [ ] Clicking "Complete" in the Web UI on a plan with all gates met moves it to `plans/completed/`, generates the completion doc, and returns the user to `/status`
- [ ] Clicking "Run Tests" then "Certify Tests" then "Complete" in the Web UI — with no manual MCP tool calls — successfully completes a plan end-to-end
- [ ] The Complete/Run-Tests logic shared between the MCP tools and the Web UI API routes lives in one function each, not two parallel implementations
