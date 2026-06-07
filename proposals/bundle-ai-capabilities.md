---
title: "AI Capabilities Bundle — Complexity Estimation, Perspective Synthesis, Parallel Review, Model Voting, and Automated Testing"
author: NetYeti
created: 2026-06-06
tags:
  - ai
  - governance
  - testing
  - review
  - dispatch
  - phase-3
complexity: high
estimated_effort: XL
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
absorbs:
  - proposals/ai-complexity-estimation.md
  - proposals/ai-perspective-synthesis.md
  - proposals/model-voting.md
  - proposals/parallel-model-review.md
  - proposals/automated-test-lifecycle.md
depends_on:
  - proposals/approved/web-ui-ai-chat-panel.md
  - plans/phase-3-profile-acl-ai.md
  - proposals/approved/split-agent-governance.md
---

## Problem

Five proposals extend how AI participates in the DocWright governance workflow —
beyond answering chat prompts, toward AI that actively estimates complexity,
generates tests, reviews in parallel, and synthesizes perspectives. All five
require the Phase 2 chat panel as a foundation and benefit from the Phase 3
dispatch/orchestrator maturity. They also carry shared design constraints:
AI must assist, never decide.

## Proposed Solution

Deliver as a Phase 3 AI Capabilities plan. Items are ordered by risk and
dependency complexity; deliver lower-risk items first.

### Item 1 — AI-Powered Complexity Estimation (low risk, early Phase 3)

Upgrade the existing heuristic complexity estimator to use an LLM when the
AI backend is available:

- Send proposal body + frontmatter to the active model
- Prompt: reason about scope, dependencies, risk, and reversibility
- Return structured output: `{complexity, confidence, reasoning}`
- Surface the reasoning as hint text in the properties pane
- Heuristic remains as the fallback when no AI backend is available

The "⟳ Complexity" button in the properties pane already exists. This
proposal upgrades what it calls, not the UI.

### Item 2 — Parallel Multi-Model Review Panel (medium risk, mid Phase 3)

A "Multi-Review" mode in the chat panel that queries N models simultaneously:
- Same prompt sent to each configured model concurrently
- Responses shown in split panel, 2–4 columns (bounded for readability)
- Models drawn from OpenCode's configured providers
- Contributor reads across columns and synthesizes — no auto-aggregation

Use cases: architecture choices, policy activations, phase gate sign-offs
where sequential second-opinion is too slow.

### Item 3 — Automated Test Lifecycle (high effort, Phase 3)

Make `tests_defined` a living automated status rather than a one-time human
checkbox:

**Rule 1 — Reset on mutation:** Any mutation to a plan's Implementation Steps
(via `update_step`, `write_plan`) resets `tests_defined: false`. A changed
plan has changed coverage requirements.

**Rule 2 — AI generates tests on step completion:** When a step is marked
✅ Done, the orchestrator dispatches a code agent (not the governance agent)
to identify changed files, generate or update tests, and report coverage gaps.

**Rule 3 — AI verifies coverage and auto-certifies:** After test generation:
- Full coverage → `tests_defined: true` set automatically
- Untestable gap (UI, LLM output, external service) → records blocker in
  `gate_note`, leaves `tests_defined: false`
- Tests fail → records failure output, `tests_defined: false`

**Rule 4 — Human first-review gate:** On a plan's first AI test generation,
`tests_defined` stays `false` until a human clicks "Certify tests" in the
properties pane. After initial human certification, AI auto-certify is allowed.

Frontmatter gains `tests_human_reviewed: false` on plan creation.

Implementation phases: (A) MCP mutation hook resets `tests_defined`, (B) AI
test generation dispatch via orchestrator, (C) coverage analysis and auto-cert,
(D) human-first-review flag.

Depends on: [[proposals/approved/split-agent-governance.md]] — test generation
must run as a code agent with no governance context access.

### Item 4 — AI-Assisted Perspective Synthesis (high risk, late Phase 3)

After N perspectives are collected via the multi-review panel, an optional
synthesizer model reads all responses and produces:
- Where perspectives agree
- Where they disagree (with the specific disagreement named)
- Its own recommendation, clearly labeled as one more perspective, not a verdict
- Flagged items that require human judgment before proceeding

**Critical design constraint:** The synthesizer output is presented alongside
the raw perspectives, never instead of them. The UI must visually distinguish
"here is what reviewers found + synthesizer's read" from "here is the answer."
Synthesizer must not imply finality.

This is deliberately last in delivery order because getting the human-preserving
design right is non-trivial. Build and validate the parallel review panel first;
add synthesis only after the usage pattern is well understood.

### Item 5 — Model Voting and Confidence Scoring (evaluate before building)

Structured review output where models rate their confidence and flag items
categorically. Aggregated summary: "3/3 models flagged the ACL section" vs.
"1/3 models flagged the timeline."

**Recommendation: validate the need before building.** Governance decisions
are not well-served by voting mechanics — a 2/3 AI majority does not make a
policy correct. This approach risks introducing false quantitative confidence
into qualitative judgments. It may be valuable for research contexts but
potentially counter-productive for governance tooling. Re-evaluate after the
parallel review panel is in use; if users naturally want aggregate signals,
build it. If not, drop it.

## Design Invariants (all items)

These constraints apply to every AI capability in this bundle:

1. AI assists, human decides — no AI output auto-approves a governance document
2. AI reasoning is always surfaced to the human, not hidden behind a verdict
3. All AI actions carry `actor_type: "ai"` in the governance audit log
4. Every AI capability degrades gracefully when no AI backend is available

## Relationship to Existing Work

| Proposal / Plan | Relationship |
|-----------------|-------------|
| [[proposals/approved/split-agent-governance.md]] | Automated test lifecycle requires the orchestrator/code-agent split |
| [[proposals/approved/multi-perspective-review-feature.md]] | Parallel review and synthesis are the Phase 3 evolution of this feature |
| [[proposals/approved/plan-test-certification-checkboxes.md]] | Automated testing evolves the `tests_defined` field defined here |
| [[policies/core/multi-perspective-review.md]] | All AI review features must reinforce, not undermine, this policy |
| [[plans/completed/lifecycle-gates-extension-bundle.md]] | AI-assisted gate prep (Bundle B) provides the LLM scaffolding test lifecycle builds on |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| AI making gate decisions | AI prepares and summarizes; human approves — always |
| Test quality scoring (mutation testing, coverage %) | Phase 4+; start with pass/fail |
| Multi-language test generation (Python, Go) | TypeScript dispatch first |
| UI component tests (Playwright/Cypress) | Framework decision needed first |
| Automatic test repair when tests break | Requires careful AI boundaries; post-launch |
| Cross-model telemetry and session correlation | No telemetry, ever |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-06 | Created — consolidated from 5 individual deferred proposals | NetYeti |
