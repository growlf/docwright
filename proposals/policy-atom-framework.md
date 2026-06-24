---
title: "Policy Atom Framework: Generic Tiered Policy Engine for DocWright Governance"
author: NetYeti
created: 2026-06-12
tags:
  - governance
  - policy-as-code
  - architecture
  - mcp
  - phase-4
approved: true
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: high
complexity: high
depends-on:
  - "[[plans/completed/enforce-lifecycle-compliance.md]]"
related_to:
  - plans/completed/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
consumed_by: plans/completed/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
---

## Problem

DocWright's current governance is enforced as a fairly monolithic rule-set
(`.opencode/rules/*`, pre-commit hooks, lifecycle-gate checks) that mixes
deterministic checks (frontmatter validity, status-transition legality) with
judgment-requiring checks (is this description specific enough, does this plan
have adequate scope) in a single undifferentiated layer. As governance rules grow
— and especially as DocWright moves toward managing *other* projects' policy sets
in addition to its own — this monolithic shape has three problems:

1. **Context cost.** Any AI agent that needs governance awareness must load the
   full rule-set, even for the 90% of cases where only one or two rules are
   actually relevant to the action being taken.
2. **No atomic enforceability.** Rules aren't independently versioned, tested, or
   toggled — changing one means re-reviewing the whole governance surface.
3. **No tiered enforcement.** There's currently no clean mechanism for "this
   installation's preference" vs. "an organization's non-negotiable floor" vs.
   "general best-practice default" to coexist and resolve predictably — a gap
   that matters as DocWright becomes a manager-of-projects tool (see Phase 4
   profile/ACL work and the manager/project separation being explored in a
   parallel thread).

## Proposed Solution

Introduce a **Policy Atom Framework**: decompose governance rules into small,
standalone, individually-enforceable units ("atoms"), each with three
synchronized representations sized for different consumers, plus a generic
`policy-atoms-core` library that any project (DocWright itself, or a project
DocWright manages) can adopt.

Full design — atom schema, two-pass (synopsis-index / deep-context) consumption
model, `check_kind: deterministic | judgment` split, three-tier enforcement
resolution (atom default → instance config → optional signed org-policy floor),
and the deliberately-deferred org-bundle transport question — is captured in
[[docs/policy-atom-framework-concept.md]]. That document is the working design
reference; this proposal is the entry point for turning it into planned work.

**High-level shape:**

- `policy-atoms-core` (new, standalone library, MIT-licensed like the rest of
  DocWright): index-builder, router, resolver, sync-checker. No DocWright-specific
  or project-specific knowledge — pure atom-schema logic.
- `policies/` (new top-level directory in DocWright, parallel to `proposals/` and
  `plans/`): DocWright's *own* manager-level governance atoms (plan-lifecycle
  rules currently living in `.opencode/rules/` and the pre-commit hooks, migrated
  into atom form).
- `<managed-project>/policies/`: same format, for projects DocWright manages —
  independent atom set, never merged with DocWright's own.
- Deterministic atoms (`check_kind: deterministic`) replace the bulk of current
  `.opencode/rules/*` and pre-commit checks with zero-AI-cost evaluation.
  Judgment atoms (`check_kind: judgment`) are the minority that still route to
  an LLM, and only when Pass-1 routing has already determined they're in scope.

## Expected Outcomes

- Existing governance rules (commit-format, frontmatter-validate, lifecycle-gate,
  no-secrets, etc.) decomposed into atoms — most becoming pure-code
  `check_kind: deterministic` checks with no AI involvement at all.
- A small reusable check-type library (`field_required`,
  `status_transition_allowed`, `regex_match`, `linked_artifact_exists`, ...)
  covering the bulk of current rules.
- Synopsis index small enough that any AI agent session (regardless of context
  size) can always see "what governance categories might apply here" cheaply.
- Foundation laid for the manager/project separation: DocWright's own
  `policies/` vs. a managed project's `policies/`, same engine.
- Enforcement resolution (default/instance/org) implemented with org-bundle
  transport left as a documented, pluggable interface — not blocking on a
  trust-anchor decision that doesn't need to be made yet.

## Resources Required

- New `policy-atoms-core` package (likely TypeScript, to match Phase 2's MCP
  server direction) — design, implement, test in isolation first.
- Migration pass over `.opencode/rules/*`, `.githooks/pre-commit`, and
  `lifecycle-gate` logic to identify which existing checks map to which atom
  `check_kind`.
- New `policies/` top-level directory + a handful of initial atoms as a pilot
  (start with 2-3 plan-lifecycle rules, as discussed) before a full migration.
- No new external dependencies required for the deterministic check library;
  judgment atoms reuse existing OpenCode/AI session plumbing.

## Related Documents

- [[docs/policy-atom-framework-concept.md]] — full design reference (schema,
  two-pass model, enforcement tiers, open questions)
- [[plans/completed/enforce-lifecycle-compliance.md]] — current governance
  baseline this proposal generalizes and replaces piecemeal
- [[PROJECT.md]] §8 Profile System, §14 Phase 4 — manager/ACL context this
  framework supports

## Notes for Plan Generation

This proposal is pre-approved (`approved: true`) — the design discussion is
already done and recorded in the concept doc. When converted to a plan, suggest
phasing as:

1. **Spike:** build `policy-atoms-core`'s schema + resolver + sync-checker in
   isolation (no DocWright integration yet), with the deterministic check-type
   library.
2. **Pilot:** decompose 2-3 real plan-lifecycle rules from current governance
   into atoms under a new `policies/` directory; wire DocWright's MCP to consult
   the router for those rules only, alongside (not yet replacing) existing
   `.opencode/rules/*`.
3. **Migration:** once pilot proves out, migrate remaining `.opencode/rules/*`
   and pre-commit checks into atoms; retire the duplicated old-path checks.
4. **Manager/project separation:** add `<managed-project>/policies/` support,
   independent atom sets per managed project.

Org-policy-bundle tier (3rd enforcement layer) should be scoped as
interface-only in this plan — implement the resolver's pluggable org-source
hook, but do not build a transport/trust-anchor until a real org-governance
need exists.
