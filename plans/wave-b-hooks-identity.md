---
title: "Wave B — hook & identity integrity: one hook source, loud failures, scoped cache, no approve-by-move bypass"
status: in-progress
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
tests_defined: false
tests_human_reviewed: false
phase: 4
total_steps: 4
completed_steps: 3
github_epic: ""
automated: full
milestone: v0.5.0
channel: dev
gate_note: "Changed files are untestable types: plans/wave-b-hooks-identity.md"
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
| 4 | Block approve-by-move | Pre-commit detects a proposal appearing in `proposals/approved/` (add or rename) in the staged diff and requires the HUMAN-APPROVED seal exactly as the frontmatter `approved: true` path does — moving the file is no longer a bypass. | ⏳ Pending | #140 | — |

## Parallelism Map

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | — | Foundation; all later fixes land in the single source |
| 2 | 1 | 3, 4 | One-place fix after unification |
| 3 | 1 | 2, 4 | One-place fix after unification |
| 4 | 1 | 2, 3 | One-place fix after unification |

## Testing Plan

### Step Verification
- [ ] Step 1: drift-guard test fails when `.githooks/pre-commit` and `scripts/pre-commit.sh` diverge; `install-hooks.sh` installs pre-commit AND commit-msg in both repo and vault fixture; existing `test:hooks` suite green against the unified source
- [ ] Step 2: fixture commit in a vault with DOCWRIGHT_PATH unset is refused with the remediation message (non-interactive shell); setting DOCWRIGHT_PATH restores normal enforcement
- [ ] Step 3: identity resolved in a test fixture never appears in a subsequent real-repo commit banner (two-repo fixture); cache file lives under .git/ of its repo
- [ ] Step 4: staged move of a proposal into proposals/approved/ without HUMAN_APPROVED is rejected; with the seal it passes; UI approve flow (commitPaths sets HUMAN_APPROVED) unaffected

### Integration & Regression
- [ ] Full `npm test` green (including test:hooks)
- [ ] `compile:mcp` clean; webui builds

### Gate Criteria
- [ ] All four consumed issues closed by merged PRs (or explicitly re-scoped with BDFL note)
- [ ] No hook behavior differs between a repo install and a vault install except the documented vault-mode checks

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
