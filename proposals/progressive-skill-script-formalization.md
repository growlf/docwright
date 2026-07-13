---
title: "Progressive skill → script formalization discipline for code work"
author: "NetYeti"
created: "2026-07-13"
tags: [process, skills, automation, code-over-memory, tokens]
category:
  - process-change
complexity: medium
approved: false
priority: high
created_by: "NetYeti@cluster-llm"
assigned_to: NetYeti
related_to:
  - "[[policies/core/code-over-memory]]"
  - "[[.opencode/rules/one-off-formalization]]"
depends_on: []
blocks: []
---

# Progressive skill → script formalization discipline for code work

## Summary

When working on code projects, DocWright should require a **manual → skill → script**
escalation for repeated tasks, driven by a simple counting rule: after doing a similar
thing ~2–3 times, **write a skill**; after using that skill ~2–3 times, **codify a script**
the skill invokes for consistent, low-token results. Extends
[[policies/core/code-over-memory]] and [[.opencode/rules/one-off-formalization]] with an
explicit frequency ladder.

## Problem Statement

The existing one-off-formalization rule says "a one-off you've done before → file a
formalization proposal," but it lacks a concrete cadence, and it stops at "propose" rather
than driving all the way to a script. In practice the AI re-derives the same multi-step
flow repeatedly — burning tokens and risking inconsistency. The 2026-07-11..13 sessions
are Exhibit A: several flows were executed 6–10× by hand with no skill or script:

- **merge PR → reconcile dogfood ← main → close-out plan** (~10×)
- **branch-per-fix → edit → typecheck/test → commit → PR** (~11×)
- **stage a plan for the completion gate** (mark steps done → verify_plan_tests →
  restore tests_defined → append history) (~6×)

Each repeat re-invented the steps in-context. A skill would have made them consistent;
a script would have made them cheap and deterministic.

## Proposed Solution

1. **Counting rule (the ladder):**
   - 1st–2nd time: do it manually (learn the shape).
   - ~3rd similar task: **write a skill** capturing the process.
   - ~2nd–3rd use of that skill: **codify the deterministic core as a script** (npm
     script / dispatch fn / MCP tool) the skill calls, so results are consistent and
     token-cheap.
2. **Track the count.** A lightweight tally the agent maintains (candidate: extend the
   friction log, or a `docs/repeat-tasks.md` ledger) so "have I done this ~3 times?" is
   answered from data, not memory (code-over-memory).
3. **Enforce vs guide.** Start as a session-start reminder + a soft gate that surfaces
   "repeated task with no skill" candidates; harden later if useful.
4. **Applies to all code projects**, DocWright first; bundle the discipline into the
   dev-oriented profiles' instructions so adopting orgs inherit it.

## Expected Outcomes

- Repeated multi-step flows become skills, then scripts — consistent + low-token.
- The three flows above (reconcile/close-out, branch-per-fix, stage-for-gate) become the
  first concrete skill/script candidates.

## Security implications

- Scripts that mutate git/lifecycle state must keep the existing guardrails (human-gated
  approvals, no self-approval, dry-run where destructive) — formalization must not bypass
  governance, only make it consistent.

## Verification

- A repeated task, on its 3rd occurrence, produces a skill; on the skill's ~3rd use, a
  script. Demonstrated on the reconcile/close-out flow as the pilot.
- Token/step count for the pilot flow drops measurably once scripted.

## Related

- [[policies/core/code-over-memory]] — the parent principle.
- [[.opencode/rules/one-off-formalization]] — the rule this sharpens with a cadence + the
  skill→script rung.
