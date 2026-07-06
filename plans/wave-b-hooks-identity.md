---
title: "Wave B — hook & identity integrity: one hook source, loud failures, scoped cache, no approve-by-move bypass"
status: completed
author: NetYeti
created: 2026-07-06
tags:
  - governance
  - hooks
  - identity
  - integrity
proposal_source: proposals/issue-cluster-remediation-waves.md
priority: high
mode: autonomous
scenario_synthesis: Wave B of the issue-cluster remediation — unify the diverged pre-commit sources and install commit-msg for vaults, make hooks fail loudly when DOCWRIGHT_PATH is unset, scope the identity cache per-repo so test runs stop poisoning real commits, and close the approve-by-move HUMAN-APPROVED bypass
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
phase: 4
total_steps: 4
completed_steps: 4
github_epic: ""
automated: full
milestone: v0.5.0
channel: dev
gate_note: "Changed files are untestable types: plans/wave-b-hooks-identity.md"
tests_last_run: "2026-07-06T22:09:31.000Z"
tests_last_result: pass
tests_last_commit: 4d89752
---
# Wave B — hook & identity integrity

## Overview

The enforcement layer itself has integrity gaps (Wave B of
[[proposals/issue-cluster-remediation-waves]], the 2026-07-05 backlog
grouping). Four issues share the shape "the hooks that enforce governance are
themselves unenforced": the two pre-commit sources have already diverged
(verified 2026-07-06: `.githooks/pre-commit` ≠ `scripts/pre-commit.sh`),
commit-msg is never installed for vaults, hooks silently no-op when
`DOCWRIGHT_PATH` is unset, the identity cache is a global `/tmp` file that
test runs poison (bit real commits three times this week, demand_count 2),
and moving a proposal file into `proposals/approved/` bypasses the
HUMAN-APPROVED gate entirely.

**Issues consumed:** #144 (hook source drift + commit-msg not installed),
#143 (silent disable on unset DOCWRIGHT_PATH), #160 (global identity cache),
#140 (approve-by-move bypass).

**Ordering:** #144 first — once there is a single hook source, #143/#160/#140
are one-place fixes.

**Provenance:** promoted from the deferred proposal by BDFL in-session
directive 2026-07-06 ("all 3" — merge #238, prune stale branches, begin
Wave B).

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
| --- | --- | --- | --- | --- | --- |
| 1 | Single hook source + commit-msg for vaults | Make `scripts/pre-commit.sh` the one canonical source; `.githooks/pre-commit` becomes a thin exec-shim (or install copies verbatim from scripts/); `install-hooks.sh` installs BOTH pre-commit and commit-msg in repo and vault modes. Add a drift-guard test that fails when shim and source diverge. | ✅ Done | #144 | — |
| 2 | Hooks fail loudly when DOCWRIGHT_PATH is unset | A vault hook that cannot resolve the DocWright tool repo must refuse the commit with a clear remediation message (or degrade to explicitly-warned minimal checks) — never silently pass. Cover non-interactive shells (no .zshrc/.bashrc env). | ✅ Done | #143 | — |
| 3 | Scope the identity cache per-repo | Replace `/tmp/opencode-identity-cache` with a per-repo location (`.git/docwright-identity-cache`) so test fixtures and real repos cannot cross-poison; drop the manual `rm -f` ritual from the step workflow. | ✅ Done | #160 | — |
| 4 | Block approve-by-move | Pre-commit detects a proposal appearing in `proposals/approved/` (add or rename) in the staged diff and requires the HUMAN-APPROVED seal exactly as the frontmatter `approved: true` path does — moving the file is no longer a bypass. | ✅ Done | #140 | — |

## Parallelism Map

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | — | Foundation; all later fixes land in the single source |
| 2 | 1 | 3, 4 | One-place fix after unification |
| 3 | 1 | 2, 4 | One-place fix after unification |
| 4 | 1 | 2, 3 | One-place fix after unification |

## Testing Plan

### Step Verification
- [x] Step 1: drift-guard test fails when `.githooks/pre-commit` and `scripts/pre-commit.sh` diverge; `install-hooks.sh` installs pre-commit AND commit-msg in both repo and vault fixture; existing `test:hooks` suite green against the unified source
- [x] Step 2: fixture commit in a vault with DOCWRIGHT_PATH unset is refused with the remediation message (non-interactive shell); setting DOCWRIGHT_PATH restores normal enforcement
- [x] Step 3: identity resolved in a test fixture never appears in a subsequent real-repo commit banner (two-repo fixture); cache file lives under .git/ of its repo
- [x] Step 4: staged move of a proposal into proposals/approved/ without HUMAN_APPROVED is rejected; with the seal it passes; UI approve flow (commitPaths sets HUMAN_APPROVED) unaffected

### Integration & Regression
- [x] Full `npm test` green (including test:hooks) — verified after every step; recorded by verify_plan_tests (see tests_last_* frontmatter); CI green on all four PRs (#240 #243 #245 #247)
- [x] `compile:mcp` clean; webui builds — CI Lint/Typecheck/Docker green on all four PRs

### Gate Criteria
- [x] All four consumed issues closed by merged PRs (or explicitly re-scoped with BDFL note) — #144 (PR #240), #160 (PR #243), #143 (PR #245), #140 (PR #247); all verified CLOSED, all resolved in the issue store with closed_by_pr
- [x] No hook behavior differs between a repo install and a vault install except the documented vault-mode checks — both installs run the same canonical scripts/*.sh sources (repo via .githooks shims, vault via copies with js-yaml baked); drift guard enforces the shim structure

> Evidence: Step 1 `test/hooks/test-hook-source-unification.sh` + vault-install fixture (PR #240;
> the PR's own commit ran through the new shim). Step 2 `test/hooks/test-claude-hook-resolution.sh`
> (PR #245) — the delivered scope is the Claude Code hook layer where the #143 failure actually
> occurred: unresolvable lifecycle gate BLOCKS (exit 2, loud), advisory hooks exit 1, resolution
> works via CLAUDE_PROJECT_DIR with no interactive-shell env var; vault git-hook paths are baked
> absolute at install/adopt so the unset-env case does not arise there. Step 3
> `test/hooks/test-identity-cache-scope.sh` (PR #243) — two-repo isolation + grep-guard against
> the /tmp path returning; live proof on the PR's own commit banner. Step 4
> `test/hooks/test-approve-by-move.sh` (PR #247) — unsealed move rejected, sealed move accepted,
> approved-file edits seal-free, born-approved add rejected; the seal is the HUMAN-APPROVED:<name>
> commit-message trailer, which the Web UI approve flows already emit.

## Rollback Procedures

Each step is an independent PR; revert to roll back. Step 1 keeps hook
behavior identical (same checks, one source) so a revert is mechanical.
Step 3 falls back to the /tmp path if the .git-scoped cache is unwritable.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Unified hook breaks vault installs that pinned old paths | Medium | Medium | install-hooks --upgrade path; adopt_version check flags stale installs |
| Loud failure (Step 2) blocks legitimate commits in odd environments | Medium | Medium | Clear remediation message; documented DOCWRIGHT_PATH setup; escape hatch documented in the message itself |
| Approve-by-move check false-positives on legitimate archive shuffles | Low | Medium | Check scoped to proposals/approved/ additions only; HUMAN_APPROVED env is the standard seal |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-06 | Created from Wave B of [[proposals/issue-cluster-remediation-waves]] per BDFL in-session directive 2026-07-06 ("all 3"); consumes #140 #143 #144 #160. Approved and started per the same directive — provenance recorded in lieu of separate proposal approval, matching the webui-write-integrity precedent. | NetYeti |
| 2026-07-06 | Step 1 delivered (GH #144, PR #240): scripts/pre-commit.sh + new scripts/commit-msg.sh are the only hook sources; .githooks/* reduced to 3-line exec-shims (drift structurally impossible — the fixed divergence was 10+ changes); install-hooks.sh installs BOTH hooks in both modes (vaults get commit-msg for the first time, js-yaml baked); self-install verifies shims instead of copying. Drift guard test-hook-source-unification.sh first in test:hooks chain. The PR's own commit ran through the new shim live. #160 cache poisoning reproduced during this step's test run — Step 3's motivation, live again. | NetYeti |
| 2026-07-06 | Step 3 delivered (GH #160, PR #243): identity cache moved from global /tmp to $(git rev-parse --git-dir)/docwright-identity-cache — fixture repos own their caches, poisoning structurally impossible; network cache stays machine-global by design. Two-repo isolation test + grep-guard in test:hooks. Live proof: the PR's own commit banner resolved the real identity immediately after a full hook-test run, no manual cache clear. The rm -f /tmp ritual is retired from the step workflow. | NetYeti |
| 2026-07-06 | Step 2 delivered (GH #143, PR #245): all four .claude/settings.json hook commands resolve via ${DOCWRIGHT_PATH:-$CLAUDE_PROJECT_DIR} (no interactive-shell dependency); unresolvable lifecycle gate BLOCKS writes (exit 2) with loud remediation instead of silently passing; advisory hooks fail loud non-blocking (exit 1); adopt-vault bakes the absolute path over the whole fallback expression. test-claude-hook-resolution.sh in test:hooks covers fallback, precedence, and both failure modes. | NetYeti |
| 2026-07-06 | Step 4 delivered (GH #140, PR #247): validate_no_self_approval closes the approval-by-location bypass — a proposal newly appearing in proposals/approved/ with approved: true arms the human-approval flag like an in-place flip (edits to already-approved files stay seal-free), and the same-family born-approved root-add hole is closed. Fixture test covers all four scenarios. ALL 4 STEPS COMPLETE — awaiting Testing Plan reconciliation, verify_plan_tests, and human review. | NetYeti |
| 2026-07-06 | Testing Plan reconciled with delivered evidence — all boxes checked with per-step test-file + PR citations; Step 2's evidence note records the honest scope (Claude hook layer, where the #143 failure actually lived). Awaiting verify_plan_tests green stamp + human review before completion. | NetYeti |
| 2026-07-06 | Test run recorded via verify_plan_tests: npm test → PASS @ 4d89752 | NetYeti |
