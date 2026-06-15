---
title: Policy Atom Framework: Generic Tiered Policy Engine for DocWright Governance
author: NetYeti
created: 2026-06-12
tags:
  - governance
  - policy-as-code
  - architecture
  - mcp
  - phase-4
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
priority: critical
complexity: high
depends-on:
  - "[[plans/completed/enforce-lifecycle-compliance.md]]"
consumed_by: plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
related_to:
  - plans/plan-ui-polish-bundle-panels-tags-navigation-wikilinks-and-deferred-polish.md
  - proposals/policy-atom-framework.md
automated: full
status: draft
---
## Problem

DocWright's current governance is enforced as a fairly monolithic rule-set (`.opencode/rules/*`, pre-commit hooks, lifecycle-gate checks) that mixes deterministic checks (frontmatter validity, status-transition legality) with judgment-requiring checks (is this description specific enough, does this plan have adequate scope) in a single undifferentiated layer. As governance rules grow — and especially as DocWright moves toward managing _other_ projects' policy sets in addition to its own — this monolithic shape has three problems:

1.  **Context cost.** Any AI agent that needs governance awareness must load the full rule-set, even for the 90% of cases where only one or two rules are actually relevant to the action being taken.
2.  **No atomic enforceability.** Rules aren't independently versioned, tested, or toggled — changing one means re-reviewing the whole governance surface.
3.  **No tiered enforcement.** There's currently no clean mechanism for "this installation's preference" vs. "an organization's non-negotiable floor" vs. "general best-practice default" to coexist and resolve predictably — a gap that matters as DocWright becomes a manager-of-projects tool (see Phase 4 profile/ACL work and the manager/project separation being explored in a parallel thread).


## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Define what constitutes a "synchronized representation" and review existing migration tools for applicable best practices in this context.  Verify that files and directories specified for migration exist and are accessible before proceeding with the migration operation. | Identify all existing governance rules in `.opencode/rules/*` and pre-commit hooks. Recode these rules into standalone policy atoms with three synchronized representations. | |
| 2 | Develop concrete requirements document based on previous decisions and include relevant legal and technical preconditions such as license compatibility. Implement Policy Atom Framework Core Library using detailed specifications outlined in the new requirements document. | Design and implement `policy-atoms-core` library, including index-builder, router, resolver, sync-checker components, license the core library as MIT-licensed to ensure compatibility and reuse. | |
| 3 | Develop Consuming Applications that utilize Policy Atoms, Integration Frameworks, and standardized APIs to automate consumption of policies. | Create consumers for policy atoms in various formats (e.g., `.opencode`, pre-commit hooks) by integrating the `policy-atoms-core` library into project workflows | |
| 4 | Have the team define example policies, use cases, and test scenarios in collaboration with subject matter experts to ensure their accuracy and relevance to actual business operations. Review these definitions and examples with stakeholders to ensure they are well-understood and fit for purpose. | Implement a set of example policies, use cases, and test scenarios to validate the effectiveness and scalability of the Policy Atom Framework. Ensure governance atoms work correctly with various configurations (e.g., instance-specific settings) | ⏳


## Proposed Solution

Introduce a **Policy Atom Framework**: decompose governance rules into small, standalone, individually-enforceable units ("atoms"), each with three synchronized representations sized for different consumers, plus a generic `policy-atoms-core` library that any project (DocWright itself, or a project DocWright manages) can adopt.

Full design — atom schema, two-pass (synopsis-index / deep-context) consumption model, `check_kind: deterministic | judgment` split, three-tier enforcement resolution (atom default → instance config → optional signed org-policy floor), and the deliberately-deferred org-bundle transport question — is captured in \[\[docs/policy-atom-framework-concept.md\]\]. That document is the working design reference; this proposal is the entry point for turning it into planned work.

**High-level shape:**

*   `policy-atoms-core` (new, standalone library, MIT-licensed like the rest of DocWright): index-builder, router, resolver, sync-checker. No DocWright-specific or project-specific knowledge — pure atom-schema logic.
*   `policies/` (new top-level directory in DocWright, parallel to `proposals/` and `plans/`): DocWright's _own_ manager-level governance atoms (plan-lifecycle rules currently living in `.opencode/rules/` and the pre-commit hooks, migrated into atom form).
*   `<managed-project>/policies/`: same format, for projects DocWright manages — independent atom set, never merged with DocWright's own.
*   Deterministic atoms (`check_kind: deterministic`) replace the bulk of current `.opencode/rules/*` and pre-commit checks with zero-AI-cost evaluation. Judgment atoms (`check_kind: judgment`) are the minority that still route to an LLM, and only when Pass-1 routing has already determined they're in scope.

## Expected Outcomes

*   Existing governance rules (commit-format, frontmatter-validate, lifecycle-gate, no-secrets, etc.) decomposed into atoms — most becoming pure-code `check_kind: deterministic` checks with no AI involvement at all.
*   A small reusable check-type library (`field_required`, `status_transition_allowed`, `regex_match`, `linked_artifact_exists`, ...) covering the bulk of current rules.
*   Synopsis index small enough that any AI agent session (regardless of context size) can always see "what governance categories might apply here" cheaply.
*   Foundation laid for the manager/project separation: DocWright's own `policies/` vs. a managed project's `policies/`, same engine.
*   Enforcement resolution (default/instance/org) implemented with org-bundle transport left as a documented, pluggable interface — not blocking on a trust-anchor decision that doesn't need to be made yet.

## Resources Required

*   New `policy-atoms-core` package (likely TypeScript, to match Phase 2's MCP server direction) — design, implement, test in isolation first.
*   Migration pass over `.opencode/rules/*`, `.githooks/pre-commit`, and `lifecycle-gate` logic to identify which existing checks map to which atom `check_kind`.
*   New `policies/` top-level directory + a handful of initial atoms as a pilot (start with 2-3 plan-lifecycle rules, as discussed) before a full migration.
*   No new external dependencies required for the deterministic check library; judgment atoms reuse existing OpenCode/AI session plumbing.

## Related Documents

*   \[\[docs/policy-atom-framework-concept.md\]\] — full design reference (schema, two-pass model, enforcement tiers, open questions)
*   \[\[plans/completed/enforce-lifecycle-compliance.md\]\] — current governance baseline this proposal generalizes and replaces piecemeal
*   \[\[PROJECT.md\]\] §8 Profile System, §14 Phase 4 — manager/ACL context this framework supports

## Notes for Plan Generation

This proposal is pre-approved (`approved: true`) — the design discussion is already done and recorded in the concept doc. When converted to a plan, suggest phasing as:

1.  **Spike:** build `policy-atoms-core`'s schema + resolver + sync-checker in isolation (no DocWright integration yet), with the deterministic check-type library.
2.  **Pilot:** decompose 2-3 real plan-lifecycle rules from current governance into atoms under a new `policies/` directory; wire DocWright's MCP to consult the router for those rules only, alongside (not yet replacing) existing `.opencode/rules/*`.
3.  **Migration:** once pilot proves out, migrate remaining `.opencode/rules/*` and pre-commit checks into atoms; retire the duplicated old-path checks.
4.  **Manager/project separation:** add `<managed-project>/policies/` support, independent atom sets per managed project.

Org-policy-bundle tier (3rd enforcement layer) should be scoped as interface-only in this plan — implement the resolver's pluggable org-source hook, but do not build a transport/trust-anchor until a real org-governance need exists.

## Structural Review

**1. Missing Steps**

* Define clear testing plan with concrete test cases for each policy atom type and edge case scenarios.
* Conduct regular code reviews and ensure adherence to coding standards.
* Document release notes and change logs for future reference.

**2. Duplicate or Overlapping Steps**

* Actions 1 and 3 can be merged: instead of migrating existing rules first, consume applications should be developed concurrently with implementing policy atom framework core library. Existing rules can be gradually migrated while developing consuming applications.

**3. Approach Gaps**

* The plan assumes a "big bang" approach to migration, where all existing rules are simultaneously recoded into policy atoms. However, this might lead to significant downtime or disruption for the system. A more gradual migration with phased rollout could be considered.
* There is no clear mention of versioning and backwards compatibility strategies for existing consuming applications.
* The plan lacks a clear evaluation strategy to measure the success of Policy Atom Framework adoption.

**4. Step Ordering**

* Step 2, **Implement Policy Atom Framework Core Library**, can start immediately after understanding the core goal and objectives from review notes (section 1 summary). However, Steps 3 and 1 should be reordered: while migrating existing rules into policy atoms would be a necessary step, developing consuming applications could create a bottleneck. Start with consuming application development to allow faster iteration on policy atom development.


## AI Review Findings

### Overall Assessment

Here are the structured notes as requested:

**1. Summary of Core Goal (1-2 sentences)**

* **Core goal:** Decouple governance rules from monolithic rule-set into modular, standalone policy atoms for easier management and evaluation.
* **Key objective:** Introduce a Policy Atom Framework to improve scalability, flexibility, and enforcement in governance.

**2. Concrete Implementation Steps (3-5 action items)**

* Action 1: **Migrate Existing Rules**
	+ Identify all existing governance rules in `.opencode/rules/*` and pre-commit hooks.
	+ Recode these rules into standalone policy atoms with three synchronized representations.
* Action 2: **Implement Policy Atom Framework Core Library**
	+ Design and implement `policy-atoms-core` library, including index-builder, router, resolver, sync-checker components.
	+ License the core library as MIT-licensed to ensure compatibility and reuse.
* Action 3: **Develop Consuming Applications**
	+ Create consumers (


## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-14 | AI-improved via Review | NetYeti |
| 2026-06-13 | AI-improved via Review | NetYeti |


## Structural Review

Here is the analysis of the governance plan:

**1. Missing steps**

* A **testing plan** is missing entirely, which is crucial for ensuring that the new policy system will work as intended.
* A **risk assessment** is also absent, which is essential for identifying potential pitfalls and mitigating risks associated with migration or introducing new frameworks like Policy Atom Framework.
* **Rollback procedures** are not included, which is critical for business continuity in case the introduced system does not meet its objectives.

**2. Duplicate or overlapping steps**

None identified.

**3. Approach gaps**

* The plan lacks a comprehensive strategy to address potential issues that may arise during implementation. This could include unclear completion criteria.
* There is no clear consideration of preconditions for successful implementation, such as stakeholder engagement or training requirements.
* The approach appears to focus primarily on building the new system without adequate consideration for the organizational and procedural changes needed to support its successful deployment.

**4. Step ordering**

The plan appears to follow a logical sequence from defining "synchronized representation" to developing Consuming Applications that utilize Policy Atoms. However, it may be beneficial to consider whether certain steps could occur concurrently or earlier in the process:

* For example, step 3 (Develop Consuming Applications) would likely benefit from concurrent development of a testing plan and risk assessment.
* The approach assumes that policy definitions will be created first, but it may be beneficial to involve subject matter experts earlier in the process than just test scenarios.


## AI Review Findings

### Overall Assessment

The plan overview appears to be coherent in terms of its high-level objectives. However, there are gaps in detailed planning for several crucial aspects that typically accompany such plans:

1. **Testing Plan:** Without mentioning a testing plan, the review cannot assess if the new policy system will effectively ensure the integrity and accuracy of policies when implemented.

2. **Risk Assessment:** A risk assessment helps identify potential pitfalls associated with migrating systems or introducing new frameworks like the Policy Atom Framework. This is essential for mitigating any challenges that may arise during implementation.

3. **Rollback Strategy:** Knowing how to revert back to an older state if the introduced system does not achieve its intended objectives is crucial. It ensures business continuity and prepares for failure points in transition processes.

These gaps suggest that while the plan has some critical aspects covered, it lacks detail on the planning for contingency scenarios and future-proofing measures, which are important for the governance system's resilience and integrity.
