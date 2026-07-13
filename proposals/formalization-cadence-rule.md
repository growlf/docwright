---
title: "Formalization cadence rule (repeated task → skill → script)"
author: "NetYeti"
created: "2026-07-13"
tags: [process, skills, automation, code-over-memory]
category:
  - process-change
complexity: medium
approved: true
priority: medium
created_by: "NetYeti@cluster-llm"
assigned_to: NetYeti
related_to:
  - [[proposals/progressive-skill-script-formalization]]
  - [[docs/formalization-proposal-review]]
  - [[policies/core/code-over-memory]]
  - [[.opencode/rules/one-off-formalization]]
  - proposals/progressive-skill-script-formalization.md
depends_on: []
blocks: []
---

# Formalization cadence rule (repeated task → skill → script)

## Summary

**Part A** of the split progressive-formalization proposal
([[proposals/progressive-skill-script-formalization]] — split per
[[docs/formalization-proposal-review]]). A lightweight, safe amendment to
[[.opencode/rules/one-off-formalization]]: give the existing "formalize repeated work" rule a
concrete **cadence** and a **detection surface**, hardened per the three-reviewer critique.
**Part B (the skill-writer / self-authored-tooling engine) is deferred** — it is a
trust/supply-chain surface and must bind to the authz generated-tooling review gate first; it
stays in the original proposal, not here. This proposal is safe to adopt on its own.

## Problem

`one-off-formalization` says "a one-off you've done before → file a formalization proposal" but
lacks a cadence and a reliable way to *notice* repetition. In practice the same multi-step flows
get re-derived by hand, burning tokens and risking inconsistency (the 2026-07-11..13 sessions ran
several flows 6–10× by hand).

## Proposed rule (hardened per review)

1. **Trigger = repetition AND stability, not raw count.** Consider formalizing when a flow ran
   **≥3×** *and* its shape was **unchanged between the last runs** *and* the substrate it wraps
   is **not an in-progress plan** (don't freeze a moving target). Count alone is insufficient.
2. **Detection from a structured event log, not prose.** Reuse the existing gitignored append-only
   substrate: a `.docwright/skill-usage.jsonl` (sibling to `audit.jsonl`). A skill's
   instrumentation is one deterministic "append a `skill_invoked` record" call — **not**
   self-tracking markdown (a static `.md` can't execute/self-count). A small aggregator surfaces
   candidates at session-start as **advisory, human-confirmed suggestions** (mirror
   `capture_bug_report` suggest→confirm), over a rolling window.
3. **Retirement path (a chute, not just a ratchet).** Record `last_used`; session-start also
   surfaces "skill X unused in N sessions — retire?" so the library doesn't sprawl.
4. **Form is a judgment call, decoupled from count.** The count *suggests considering*; the
   *form* (skill / npm script / dispatch fn / MCP tool) is chosen from `one-off-formalization`'s
   menu by the nature of the work. MCP tools (state mutations) need explicit human sign-off
   regardless of count.
5. **When NOT to formalize (explicit stop-list):** volatile substrate; high run-to-run variance;
   the flow is cheap to redo; the deterministic core can't be separated from judgment.
6. **Measured pilot first.** Baseline ONE settled flow (e.g. branch-per-fix) — steps/tokens for
   the manual version — and require the formalized version to beat it net of amortized
   authoring+maintenance before generalizing the rule.

## Expected outcomes

Genuinely-repeated, *settled* flows become skills/scripts — consistent + low-token — without
premature abstraction, skill sprawl, or an unmeasured "it saves tokens" claim.

## Security implications

Low. The usage log is gitignored operational telemetry (not governance state); detection is
advisory (never auto-creates); no new authorization surface. (Any move to *generate* tooling is
Part B, gated separately.)

## Verification

- `.docwright/skill-usage.jsonl` accrues `skill_invoked` records; the aggregator surfaces a
  repeated flow at session-start as a human-confirmed suggestion (not auto-action).
- The retirement prompt surfaces an unused skill.
- The pilot flow's measured step/token count drops net of authoring+maintenance.

## Related

- [[proposals/progressive-skill-script-formalization]] — the original (holds deferred Part B).
- [[docs/formalization-proposal-review]] — the three-perspective review this hardens.
- [[.opencode/rules/one-off-formalization]] — the rule this sharpens with a cadence.
