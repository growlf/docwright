---
title: Phase close-out from the Web UI
status: in-progress
author: NetYeti
created: 2026-07-11
tags:
  - webui
  - lifecycle
  - release
proposal_source: proposals/phase-close-web-ui.md
priority: low
complexity: medium
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Happy path: the /status page detects when all current-phase plans are completed and shows a 'Phase N ready to close' banner; a human-gated Close Phase button (confirmation dialog) calls POST /api/phase/close, which validates completeness, bumps VERSION + package.json, and reports back — so a non-developer BDFL can close a phase from a browser. Failure avoided: phase close is CLI-only (npm run phase:close), invisible and unavailable to Web-UI-only contributors. Governance: releasing/tagging stays the BDFL's explicit, confirmed action — the endpoint never auto-tags/pushes without confirmation."
total_steps: 3
completed_steps: 3
tests_last_run: "2026-07-12T22:19:26.460Z"
tests_last_result: pass
tests_last_commit: 1436677
---

# Phase close-out from the Web UI

## Overview

Phase close-out is CLI-only (`npm run phase:close -- N`), invisible + unavailable to
Web-UI-only contributors, with no in-UI readiness feedback. Surface it in the UI,
reusing the existing `scripts/phase-close.ts` logic server-side (do NOT reimplement
the version math). Full detail: [[proposals/phase-close-web-ui]].

## Constraints & Invariants

1. **Release is the BDFL's explicit call** ([[feedback-release-is-bdfl-call]]): the
   Close Phase action is human-gated (confirmation dialog); the tag/push remain a
   deliberate, confirmed step — never auto-fired.
2. **Reuse phase-close.ts logic** via a shared function the endpoint imports — no
   reimplemented version math (code-over-memory).
3. AI governance: the endpoint bumps VERSION/package.json on a human click; it must
   not let AI drive it unattended.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Phase readiness indicator on /status | Detect when every plan for the current phase has `status: completed` (reuse the phase/plan data the /status page already loads) and show a "Phase N ready to close — <summary of completed plans>" banner. Verify: with all phase-N plans completed the banner appears; with a pending plan it does not. | ✅ Done |
| 2 | POST /api/phase/close (server) | New authenticated endpoint that: validates all current-phase plans are completed (refuse loudly otherwise), then invokes the SHARED phase-close logic (factor the core of `scripts/phase-close.ts` into an importable function) to bump `VERSION` + `package.json` to `0.{N+1}.0`. Return what it changed. It does NOT tag/push — that stays a separate, explicit BDFL step (surface the exact tag command in the response). Verify: hitting it with an incomplete phase → 422 with reason; with a complete phase → version bumped, response lists the change. | ✅ Done |
| 3 | Close Phase button + confirmation | A human-gated button on the readiness banner that opens a confirmation dialog ("Bump version to 0.N+1.0?") and calls the endpoint, surfacing success (+ the tag command to run) or the refusal reason. Verify (UI): button appears only when ready, confirmation required, result/refusal shown. | ✅ Done |

## Testing Plan

*   Step 1: readiness banner shows iff all current-phase plans are completed (unit/component test on the predicate).
*   Step 2: endpoint refuses (422) an incomplete phase and bumps version for a complete one; the shared phase-close function has parity with the CLI (unit test).
*   Step 3: UI click-through — button gated on readiness, confirmation required, no auto-tag/push.

## Phase Gate

*   A BDFL can see phase-readiness and close a phase (version bump) from the browser.
*   The endpoint reuses the CLI's phase-close logic (no reimplemented version math) and refuses an incomplete phase.
*   Tag/push remain a separate, explicitly-confirmed BDFL step (not auto-fired).
*   `tests_defined` + human review confirmed.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the proposal. Status draft, awaiting BDFL approval. | NetYeti |
| 2026-07-12 | Test run recorded via verify_plan_tests: npm run test:dispatch → PASS @ 1436677 | NetYeti |
| 2026-07-12 | All 3 steps shipped in PR #344 (merged): shared phase-close-core, GET/POST /api/phase/close, /status readiness banner + human-gated Close Phase button; CLI refactored to delegate. test:dispatch PASS (10 core tests). Staged for the completion gate. | NetYeti |
