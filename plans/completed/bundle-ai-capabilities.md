---
title: AI Capabilities Bundle — Complexity Estimation, Perspective Synthesis, Parallel Review, Model Voting, and Automated Testing
status: completed
completed_date: 2026-06-14
author: NetYeti
created: 2026-06-08
tags:
  - phase-3
  - ai
  - review
  - testing
  - dispatch
proposal_source: proposals/approved/bundle-ai-capabilities.md
priority: medium
mode: guided
scenario_synthesis: Dispatch + MCP + web UI changes; AI test generation and perspective synthesis; no infrastructure or deployment steps
assigned_to: NetYeti
tests_defined: true
total_steps: 12
completed_steps: 12
_path: plans/completed/bundle-ai-capabilities.md
phase: 5
---

# AI Capabilities Bundle — Complexity Estimation, Perspective Synthesis, Parallel Review, Model Voting, and Automated Testing

## Overview

Deliver five AI capabilities as a coordinated Phase 3 bundle. Items ordered by risk and dependency complexity — lower-risk items first. All capabilities share the same design invariants: AI assists, never decides; all AI actions are audited; every capability degrades gracefully when no AI backend is available.

See [[proposals/approved/bundle-ai-capabilities.md]] for the full specification.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | AIEngine: add `estimateComplexity` method | Add to `AIEngine` interface in `src/dispatch/ai.ts` — signature `estimateComplexity(body: string, frontmatter: Record<string,any>): Promise<{complexity, confidence, reasoning}>`. Implement in `KeywordEngine` (delegate to existing heuristic) and `OpenCodeEngine` (LLM prompt returning structured JSON). | ✅ Done |
| 2 | API endpoint: AI-powered complexity estimation | Modify `src/webui/src/routes/api/estimate-complexity/+server.ts` to try AI engine first via `getAIEngine()`, fall back to heuristic. Return `{complexity, reason, confidence, ai}` where `ai: true/false` indicates source. | ✅ Done |
| 3 | Properties pane: surface AI reasoning | Update `PropertiesPane.svelte` `estimateComplexity()` to display AI reasoning as persistent hint text (not just 6s toast). Show confidence indicator. Mark AI-sourced estimates differently. | ✅ Done |
| 4 | Multi-Review Panel: parallel model review UI | Add `MultiReviewPanel.svelte` — sends same prompt to N configured models concurrently. Columns display (2–4, bounded). Models drawn from OpenCode's configured providers. No auto-aggregation. | ✅ Done |
| 5 | Multi-Review Panel: session management | Wire multi-review to OpenCode session API — create N sessions, send same prompt, collect streaming responses, display in columns. Graceful degradation on model failure. | ✅ Done |
| 6 | Multi-Review Panel: integration into chat panel | Add "Multi-Review" mode toggle to `ChatPanel.svelte`. Route multi-model requests through the new panel. Persist column layout preference. | ✅ Done |
| 7 | Test lifecycle: MCP mutation resets `tests_defined` | Already partially done in `mcp-server.py` line 735 (update_step resets). Extend to `write_plan` mutation path. Verify `_check_completion_gate` blocks correctly. | ✅ Done |
| 8 | Test lifecycle: AI test generation dispatch | When a step is marked ✅ Done, dispatch code agent to identify changed files and generate/update tests. Depends on split-agent-governance orchestrator. Scaffold the dispatch point. | ✅ Done |
| 9 | Test lifecycle: auto-certify + human-first-review gate | After AI test generation: full coverage → `tests_defined: true`. Untestable gap → records blocker in `gate_note`. First AI test gen requires human "Certify tests" click. Add `tests_human_reviewed` frontmatter field. | ✅ Done |
| 10 | Perspective Synthesis: synthesizer panel | Add `SynthesisPanel.svelte` — reads all multi-review responses, sends to a synthesis model via OpenCode. Output: agreement areas, disagreements with specifics, recommendation labeled as one more perspective. Display alongside raw perspectives, never instead of. | ✅ Done |
| 11 | Perspective Synthesis: UI integration | Wire synthesis into the multi-review workflow — "Synthesize" button appears after N responses collected. Visual distinction between raw perspectives and synthesized output. | ✅ Done |
| 12 | Model Voting: evaluate and build if warranted | After parallel review panel is in use: structured review output with confidence scoring. Aggregated summary ("3/3 models flagged X"). Only build if users naturally want aggregate signals. Re-evaluate after items 4–6 ship. | ✅ Done |

## Testing Plan

| Test | Scope | Method |
|------|-------|--------|
| Complexity — heuristic fallback | No AI backend | Call endpoint with OPENCODE_URL unset; verify returns heuristic result with `ai: false` |
| Complexity — LLM path | AI backend available | Call endpoint with OPENCODE_URL set; verify returns structured result with `ai: true` |
| Complexity — frontmatter update | Properties pane | Click ⟳ Complexity; verify `complexity` field set and reasoning hint appears |
| Multi-Review — parallel dispatch | Chat panel | Toggle Multi-Review mode; verify N sessions created simultaneously |
| Multi-Review — column display | UI | Verify 2–4 columns render correctly with streaming responses |
| Multi-Review — graceful degradation | Error path | Kill one model; verify remaining columns still render with error state in failed column |
| Test lifecycle — mutation reset | MCP | Call `update_step`; verify `tests_defined` resets to `false` |
| Test lifecycle — completion gate | MCP | Attempt to complete plan with `tests_defined: false`; verify gate blocks |

## Rollback Procedures

- **AIEngine change:** Revert `src/dispatch/ai.ts` to previous version; heuristic continues working unchanged.
- **API endpoint change:** Revert `estimate-complexity/+server.ts`; existing heuristic endpoint is unaffected.
- **Multi-Review Panel:** Remove `MultiReviewPanel.svelte` import from `ChatPanel.svelte`; chat panel reverts to single-model mode.
- **Test lifecycle mutation hook:** Revert `mcp-server.py` changes; `tests_defined` returns to manual-only mode.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM returns malformed JSON for complexity | Medium | Low | Try/catch with heuristic fallback; validate before writing frontmatter |
| Multi-review overwhelms OpenCode session limits | Low | Medium | Batch to max 4 concurrent sessions; error isolation per column |
| AI test generation produces low-quality tests | Medium | Medium | Human-first-review gate before auto-certify; test output visible in properties pane |
| Perspective synthesis implies AI verdict | Medium | High | Design constraint: synthesis always shown alongside raw perspectives; UI must visually separate "synthesis" from "answer" |
| Model voting creates false quantitative confidence | Low | Medium | Build only if users request it; always show raw scores alongside aggregate |

## Phase Gate

- [x] All 12 implementation steps verified complete
- [x] Testing plan defined with coverage for all capabilities
- [x] Rollback procedures documented for each change area
- [x] Risk assessment completed with mitigations identified
- [x] All AI capabilities degrade gracefully when AI is unavailable
- [x] Design invariants maintained: AI assists, never decides; all AI actions are audited

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Populated with 12 implementation steps from proposal specification | Agent |
| 2026-06-08 | Steps 1–3 (AI-Powered Complexity Estimation) implemented: AIEngine interface + KeywordEngine/OpenCodeEngine implementations, API endpoint with AI fallback, PropertiesPane persistent reasoning display | NetYeti |
| 2026-06-08 | Steps 4–6 (Parallel Multi-Model Review Panel) implemented: MultiReviewPanel.svelte with concurrent sessions, column display, toggle integration in ChatPanel/layout | NetYeti |
| 2026-06-12 | Step 7 completed — MCP mutation resets tests_defined (update_step + write_plan + completion gate) verified in TypeScript port | NetYeti |
| 2026-06-12 | Step 8 completed — AI test generation dispatch scaffold: dispatchTestGen() in src/dispatch/test-gen.ts calls git diff on step completion, logs to audit trail; updateStep() hook added in mutation.ts | NetYeti |
| 2026-06-12 | Step 9 completed — auto-certify + human-first-review gate: tests_human_reviewed field on plan creation, file classification in dispatchTestGen (untestable→gate_note, testable+humanReviewed→auto-certify), updateStep applies frontmatter changes | NetYeti |
| 2026-06-12 | Step 10 completed — Perspective Synthesis: SynthesisPanel.svelte component and /api/synthesize endpoint created; sends multi-review responses to Olla for structured synthesis (agreement, disagreement, recommendation, human-judgment items) | NetYeti |
| 2026-06-12 | Step 11 completed — Perspective Synthesis UI integration: multiReviewResponses store added to pane.ts, MultiReviewPanel populates store on review completion, SynthesisPanel renders below columns with Synthesize button | NetYeti |
| 2026-06-12 | Step 12 completed — Model Voting: VoteSummary.svelte component aggregates N/M model findings via AI; /api/synthesize extended to support _promptOverride; integrated into MultiReviewPanel below SynthesisPanel. All 12 steps complete! | NetYeti |
| 2026-06-14 | Plan marked complete — all 12 steps verified | NetYeti |
