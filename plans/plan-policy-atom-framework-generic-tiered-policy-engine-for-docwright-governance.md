---
title: "Policy Atom Framework — Generic Tiered Policy Engine"
status: draft
author: NetYeti
created: 2026-06-12
phase: 4
tags:
  - governance
  - policy-as-code
  - architecture
  - mcp
  - phase-4
priority: critical
complexity: high
automated: full
scenario_synthesis: Policy atom decomposition — build policy-atoms-core library in isolation, pilot with 2-3 live rules, migrate remaining governance checks, add manager/project isolation; no IDE-specific steps
assigned_to: NetYeti
proposal_source: proposals/policy-atom-framework.md
depends_on:
  - plans/completed/enforce-lifecycle-compliance.md
related_to:
  - docs/profile-contribution-architecture.md
  - plans/plan-ui-polish-bundle-panels-tags-navigation-wikilinks-and-deferred-polish.md
tests_defined: true
tests_human_reviewed: false
total_steps: 5
completed_steps: 0
---

# Policy Atom Framework — Generic Tiered Policy Engine

## Overview

Decomposes DocWright's governance from a monolithic rule-set into small, standalone,
individually-enforceable units ("atoms"). Each atom has three synchronized representations
sized for different consumers. A generic `policy-atoms-core` library provides the index-
builder, router, resolver, and sync-checker — reusable by any project DocWright manages.

Full design (atom schema, two-pass consumption model, `check_kind` split, three-tier
enforcement resolution, open questions) is in [[docs/policy-atom-framework-concept.md]].
The design is considered done; this plan executes it.

## Problem

DocWright's current governance is a monolithic rule-set (`.opencode/rules/*`, pre-commit
hooks, lifecycle-gate checks) that mixes deterministic checks (frontmatter validity,
status-transition legality) with judgment-requiring checks (is this description specific
enough) in a single undifferentiated layer. As governance rules grow — and especially as
DocWright moves toward managing *other* projects' policy sets — this shape creates three
problems:

1. **Context cost.** Any AI agent needs governance awareness must load the full rule-set,
   even for the 90% of cases where only one or two rules are relevant.
2. **No atomic enforceability.** Rules aren't independently versioned, tested, or toggled.
   Changing one means re-reviewing the whole governance surface.
3. **No tiered enforcement.** There is no clean mechanism for "this installation's
   preference" vs. "an organization's non-negotiable floor" vs. "general best-practice
   default" to coexist and resolve predictably — a gap that matters as DocWright becomes
   a manager-of-projects tool.

## Proposed Solution

Introduce a **Policy Atom Framework**: decompose governance rules into atoms, each with
three synchronized representations:

| Representation | Size | Consumer |
|----------------|------|----------|
| **Synopsis** | 1–2 sentences | Synopsis index — loaded every session, always in context |
| **Context** | Full rule, rationale, examples | Loaded on-demand when the router routes a query to this atom |
| **Code** | Executable check function (deterministic atoms only) | Run by the MCP server or pre-commit hook with zero AI cost |

The `policy-atoms-core` library provides:
- **Index-builder** — scans `policies/` and produces a synopsis index
- **Router** — pass-1: cheaply identifies which atoms are in scope for a given action
- **Resolver** — pass-2: loads full context for the routed atoms only
- **Sync-checker** — validates that all three representations stay in sync

**Two-pass consumption model:**
- Pass 1 (cheap): load synopsis index → router identifies relevant atoms
- Pass 2 (on-demand): resolver loads full context for only the relevant atoms

**`check_kind` split:**
- `deterministic` — pure code evaluation, no AI cost, no context needed
- `judgment` — still requires an LLM, but now explicitly scoped and routed

**Three-tier enforcement resolution** (lowest wins):
1. Atom default — what the atom ships with
2. Instance config — this installation's preference (`.docwright/config.json`)
3. Org-policy floor — optional signed override from an external org bundle

**Org-bundle tier:** scoped to pluggable interface only in this plan. The transport and
trust-anchor question is explicitly deferred until a real org-governance need exists.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | **Spike** — build `policy-atoms-core` in complete isolation | Define atom YAML schema and JSON Schema validator. Implement index-builder, router, resolver, and sync-checker as a standalone TypeScript package under `src/policy-atoms-core/`. Include the deterministic check-type library: `field_required`, `status_transition_allowed`, `regex_match`, `linked_artifact_exists`. No DocWright integration — pure library. Full unit test coverage before moving to Step 2. | ⏳ Pending |
| 2 | **Pilot** — decompose 2–3 real rules into atoms | Choose 2–3 plan-lifecycle rules from `.opencode/rules/*` or `pre-commit.sh` (e.g., `commit-format`, `frontmatter-validate`, one lifecycle-gate rule). Express each as a policy atom under a new `policies/` top-level directory. Wire DocWright's MCP server to consult the atom router for those rules **alongside** (not replacing) existing checks. All existing tests must still pass; add atom-specific tests. | ⏳ Pending |
| 3 | **Migration** — replace old enforcement paths | Migrate remaining `.opencode/rules/*` and pre-commit deterministic checks into atoms. Retire old-path checks incrementally — only after the atom-backed equivalent passes the full test suite. Update MCP tools to route all governance queries through the atom router. | ⏳ Pending |
| 4 | **Manager/project separation** — independent atom sets | Add `<managed-project>/policies/` support: independent atom set per managed project, same engine, no cross-contamination with DocWright's own `policies/`. MCP router must scope queries to the active project's atom set. Verify with a real secondary vault. | ⏳ Pending |
| 5 | **Org-bundle tier** — pluggable interface only | Implement the resolver's pluggable `org-source` hook as an interface: function signature, documented contract, stub implementation that returns `null`. Do NOT build transport or trust-anchor. Document the hook location and expected signature for future implementors. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: `policy-atoms-core` unit tests pass in complete isolation (`npm test` from `src/policy-atoms-core/`)
- [ ] Step 2: 2–3 pilot atoms enforce correctly; all existing pre-commit and MCP tests still pass
- [ ] Step 3: Full migration — `npm test` passes with atom routing active; old-path files removed
- [ ] Step 4: Secondary vault uses independent atom set; no bleed from DocWright's own `policies/`
- [ ] Step 5: Org-source hook present and documented; returns `null` gracefully when not configured

### Integration & Regression

- [ ] Existing tests pass without modification at every step (`npm test`)
- [ ] TypeScript compiles cleanly at every step (`npm run typecheck`)
- [ ] Atom-backed deterministic rules produce identical decisions to old-path checks for all known inputs
- [ ] Synopsis index size stays under a documented size budget (to be set in Step 1)

### Gate Criteria

- [ ] Human reviewer has verified step outcomes above
- [ ] No governance rules are unintentionally dropped during migration (Step 3 audit)
- [ ] `policy-atoms-core` has zero DocWright-specific imports (verified by CI check added in Step 1)

## Risk Assessment

- **Migration disruption (Step 3):** Atom checks run alongside old checks before any old-path is retired. No hard cutover. Low risk.
- **Scope creep (org-bundle tier):** Explicitly scoped to interface-only. Transport and trust-anchor are deferred.
- **Synopsis index size creep:** If the index grows beyond practical context size it defeats the whole design. Enforce a byte-budget in the sync-checker from Step 1.
- **Judgment atom quality regression:** When judgment atoms replace old rule prose, the LLM may interpret them differently. Pilot (Step 2) catches this early with side-by-side comparison.

## Rollback Procedures

- **Steps 1–2:** Pure additions — no production impact. Remove `policies/` and the MCP router wiring.
- **Step 3:** Old-path checks retired incrementally. Revert by re-enabling `.opencode/rules/*` files from git history.
- **Steps 4–5:** Additive. Remove `<managed-project>/policies/` or the org-source hook stub without affecting core function.

## Expected Outcomes

- Existing governance rules (commit-format, frontmatter-validate, lifecycle-gate, no-secrets, etc.) decomposed into atoms — most becoming pure-code `deterministic` checks with zero AI involvement.
- A reusable check-type library covering the bulk of current rules.
- Synopsis index small enough that any AI agent session (regardless of context size) can always see "what governance categories might apply here" cheaply.
- Foundation for manager/project separation: DocWright's own `policies/` vs. a managed project's `policies/`, same engine.
- Enforcement resolution (default/instance/org) implemented with org-bundle transport left as a documented, pluggable interface.

## Resources Required

- New `src/policy-atoms-core/` package (TypeScript) — design, implement, test in isolation first.
- Migration pass over `.opencode/rules/*`, `pre-commit.sh`, and lifecycle-gate logic to map each check to an atom `check_kind`.
- New `policies/` top-level directory + 2–3 initial atoms as pilot before full migration.
- No new external dependencies for the deterministic check library; judgment atoms reuse existing OpenCode/AI session plumbing.

## Related Documents

- [[docs/policy-atom-framework-concept.md]] — full design reference (schema, two-pass model, enforcement tiers, open questions)
- [[plans/completed/enforce-lifecycle-compliance.md]] — current governance baseline this framework generalizes
- [[docs/profile-contribution-architecture.md]] — profile/module contribution design that benefits from per-project atom sets
- [[PROJECT.md]] §8 Profile System, §14 Phase 4 — manager/ACL context this framework supports

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-14 | Plan rewritten — steps from Notes section, duplicates removed, frontmatter corrected | NetYeti |
| 2026-06-12 | Initial draft created | NetYeti |
