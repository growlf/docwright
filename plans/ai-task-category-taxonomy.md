---
title: AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time
status: in-progress
author: NetYeti
created: 2026-06-17
tags: ai, governance, routing, llm, policy-atoms, litellm, olla, phase-4
proposal_source: proposals/approved/ai-task-category-taxonomy.md
priority: medium
automated: guided
assigned_to: NetYeti
scenario_synthesis: Extend AiCategory TypeScript union and JSON Schema to 6 values, create categories.yaml registry, add routing docs for coding and agentic; no VS Code API, no database; ai-stack integration is an independent workstream
tests_defined: true
tests_human_reviewed: false
_path: plans/ai-task-category-taxonomy.md
---

# AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time

## Overview

*Plan generated from approved proposal: AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time*

### What Is Already Implemented

The policy atom framework plan (completed 2026-06-17) delivered:

- **`AiCategory` type** in `src/policy-atoms-core/schema.ts` — `'none' | 'classification' | 'generation' | 'reasoning'` (4 values, enforced by JSON Schema validator)
- **`ai_category` field** in every atom's `atom.yaml` — all 10 DocWright governance atoms are already categorised
- **`judgment_dispatch_hook(ai_category, payload)` interface** — frozen per Design Decision Q5 in `src/policy-atoms-core/resolver.ts`
- **`docs/policy-atom-model-routing.md`** — model routing reference for the 4 existing categories, grounded in validated hardware constraints (decisions-ledger F3/F6)

This proposal picks up where that work stopped. It does **not** re-implement those deliverables.

### Summary

Extend the `AiCategory` taxonomy from 4 to 6 values, establish a formal `categories.yaml` registry with display metadata, embed category labels in plan steps at authorship time, and wire the ai-stack capability registry to the `judgment_dispatch_hook`. DocWright emits the label; LiteLLM/Olla uses it to route each unit of work to the most capable and cost-effective model — without runtime inference.

### Problem Statement

DocWright is building toward a future where governance enforcement, plan execution,
and document review can run entirely on local hardware using Olla, Ollama, and
LiteLLM — removing cloud AI dependency for the bulk of day-to-day work. The
blocker is **routing**: dispatching the right task to the right model requires
knowing what *kind* of cognitive work the task represents.

Today there is no label for this. When a governance atom runs a judgment check, or
an executor runs a plan step, the dispatcher has to infer the task type at runtime
— which requires reading the task, which requires a model, which is circular. The
result is either: always use the biggest model available (wasteful), or always use
the smallest (inaccurate on complex tasks).

The same problem exists for proposals and plans: a step that says "write a
critique of the risk assessment" requires different model capability than "extract
all frontmatter fields from this document." Both look like text to the dispatcher.

A second problem: even if a dispatcher knew the task type, there is no shared
registry of what each available model handles well. The ai-stack project has the
hardware; DocWright has the work. They have no shared language.

### Alternatives Considered

**Runtime inference (no labels):** Dispatcher reads the task text and infers the
category at execution time. This is circular (requires a model to categorize for
a model), adds latency to every dispatch, and produces inconsistent results across
model families. Rejected.

**Binary check_kind only (deterministic | judgment):** The current policy atom
design. Sufficient for governance atoms but too coarse for plan step execution
routing — it doesn't distinguish `coding` from `reasoning` from `creative`, which
require different model families, not just different capability tiers. Retained as
a derived property; `ai_category: none` implies `check_kind: deterministic`.

**Per-model routing without shared taxonomy:** Each tool (OpenCode, LiteLLM,
DocWright executor) maintains its own internal routing logic. Produces duplicated,
divergent routing tables that drift apart as models change. Rejected in favor of
a single shared label that all tools consume.

**Larger taxonomy (30+ categories):** The AI research literature has fine-grained
taxonomies with 30+ task types. These are useful for benchmarking but too granular
for practical routing — the difference between "dialogue summarization" and
"document summarization" doesn't change which node you route to. 11 categories is
the right granularity for routing; finer distinctions live in the task description
itself.

### Expected Outcomes

- Every governance atom, plan step, and proposal carries an `ai_category` label
  from the moment it is created.
- The policy atom framework's `judgment_dispatch_hook` (Step 5) receives
  `(ai_category, payload)` — a concrete, stable interface.
- LiteLLM/Olla can route 100% of `none`, `extraction`, `classification`, and
  `summarization` tasks to local models with no cloud API calls.
- `reasoning` and `agentic` tasks have a configured local default (14b model on
  phoenix) with cloud fallback — cloud is the exception, not the default.
- A new model added to the ai-stack fleet slots into routing by adding one entry
  to the capability registry, with no DocWright code changes.
- The category taxonomy is versioned, community-grounded (LMSYS/MT-Bench
  lineage), and stable enough to be referenced in documentation and tooling built
  by future contributors.

### Resources Required

**DocWright (remaining work — already done items noted):**
- ✅ ~~`ai_category` field in atom YAML schema~~ — done, `AiCategory` type in `schema.ts`
- ✅ ~~`judgment_dispatch_hook(ai_category, payload)` interface~~ — done, Step 5 of atom plan
- ✅ ~~Model routing reference for existing 4 categories~~ — done, `docs/policy-atom-model-routing.md`
- **New:** Extend `AiCategory` in `schema.ts` to add `'coding'` and `'agentic'`
- **New:** Update `docs/policy-atom-model-routing.md` with routing tables for `coding` and `agentic`
- **New:** `src/policy-atoms-core/categories.yaml` — display names, descriptions, status (additive metadata over the TypeScript type)
- **New:** `create-plan` endpoint: classification call to suggest `ai_category` per step
- **New:** Web UI: `ai_category` dropdown in plan step editor (optional column, Phase 4/5)

**ai-stack project:**
- `capability-registry.yaml` — maps `(ai_category)` to `(model, endpoint, node)` per fleet node
- LiteLLM routing config wired to read from registry
- Documentation: which models handle which categories, with benchmark references

**Shared:**
- Deprecation policy: ✅ decided — deprecated IDs remain valid indefinitely; no forced migration

### Notes for Plan Generation

### What's already done (do not re-implement)

Steps 2 and 3 from the original phasing are complete. The plan generated from this proposal should start at step 4:

| Original step | Status | Notes |
|--------------|--------|-------|
| 1. Define `categories.yaml` / shared contract | 🔄 Partial | TypeScript type exists; YAML registry still needed |
| 2. Add `ai_category` to atom YAML schema | ✅ Done | 4 values in `schema.ts` |
| 3. Wire `judgment_dispatch_hook` interface | ✅ Done | Step 5 of atom plan |
| 4. Build capability registry and LiteLLM routing (ai-stack) | ⏳ Pending | |
| 5. Extend taxonomy to 6 categories | ⏳ Pending | Add `coding` + `agentic` |
| 6. Add creation-time category suggestion (create-plan + UI) | ⏳ Pending | Phase 4/5 Web UI |

### Suggested plan phases

1. **Extend schema** — add `'coding'` and `'agentic'` to `AiCategory` in `schema.ts`, update JSON Schema validator, extend `docs/policy-atom-model-routing.md` with routing tables for the two new categories
2. **`categories.yaml` registry** — create `src/policy-atoms-core/categories.yaml` with display names, descriptions, status for all 6 categories (additive over the TypeScript type)
3. **ai-stack integration** — `capability-registry.yaml` mapping `(ai_category)` to `(model, endpoint, node)`, LiteLLM routing config, node documentation (parallel to phases 1–2, independent workstream)
4. **Creation-time suggestion** — `create-plan` endpoint classification call for step-level category suggestion; Web UI dropdown (Phase 4/5, not blocking phases 1–3)

The TypeScript type extension (phase 1) is the new blocking dependency — it must land before the `categories.yaml` YAML file can be complete.

### Related Documents

- [[plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md]] — completed prerequisite; atom schema and dispatch hook already implemented
- [[docs/policy-atom-model-routing.md]] — existing routing reference for 4 categories; will be extended in phase 1
- [[docs/policy-atom-hooks.md]] — `judgment_dispatch_hook` contract and LiteLLM extension path
- [[docs/ai-inference-routing-research.md]] — prior routing research and Olla stack context
- [[docs/profile-contribution-architecture.md]] — profile/module design that benefits from per-profile category defaults


*(AI improvement timeout — showing original body)*

### Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | AI-improved via Improve | NetYeti |


## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Extend the AiCategory schema by adding `coding` and `agentic` properties with a clear description of their expected values (e.g., booleans or enums) and ensure that all relevant types, models, and existing data are updated accordingly. Update relevant code documentation with links to the modified schema and migration script details. | Add `coding` and `agentic` to the TypeScript union type in schema.ts | ✅ Done |
| 2 | Update categories.yaml to include the new entries for “coding” and “agentic”, then verify changes through automated testing of the file's contents against a golden standard. | Add `coding` and `agentic` entries with metadata to categories.yaml | ✅ Done |
| 3 | Review model-routing docs for completeness and accuracy. Ensure changes are properly reflected in all relevant sections, including decision logic implementation, before finalizing updates. | Reflect new categories in routing documentation and decision logic | ⏳ Pending |
| 4 | Establish a detailed specification for the categories.yaml file, including its location, expected format, and required elements, to ensure clarity and consistency throughout the registry establishment process. | Define display names, descriptions, and deprecation status in categories.yaml on top of the TS union | ⏳ Pending |
| 5 | Update action text: Wire the AI stack's capability registry API to use the judgment dispatch hook for runtime capability lookup by adding a call to 'add_creds_to_registry_and_dispatch' in ai-stack's setup function. Verify the update by checking that a newly created runner can successfully look up its capabilities using get_capabilities_from_judgement. | Connect ai-stack capability registry to the judgment_dispatch_hook for runtime lookup | ⏳ Pending |

## Testing Plan
### Step Verification
- [ ] Step 1: Extend the AiCategory schema by adding `coding` and `agentic` properties with a clear description of their expected values (e.g., booleans or enums) and ensure that all relevant types, models, and existing data are updated accordingly. Update relevant code documentation with links to the modified schema and migration script details.
- [ ] Step 2: Update categories.yaml to include the new entries for “coding” and “agentic”, then verify changes through automated testing of the file's contents against a golden standard.
- [ ] Step 3: Review model-routing docs for completeness and accuracy. Ensure changes are properly reflected in all relevant sections, including decision logic implementation, before finalizing updates.
- [ ] Step 4: Establish a detailed specification for the categories.yaml file, including its location, expected format, and required elements, to ensure clarity and consistency throughout the registry establishment process.
- [ ] Step 5: Update action text: Wire the AI stack's capability registry API to use the judgment dispatch hook for runtime capability lookup by adding a call to 'add_creds_to_registry_and_dispatch' in ai-stack's setup function. Verify the update by checking that a newly created runner can successfully look up its capabilities using get_capabilities_from_judgement.
- [ ] Step 1: Extend the AiCategory schema by adding `coding` and `agentic` properties with a clear description of their expected values (e.g., booleans or enums) and ensure that all relevant types, models, and existing data are updated accordingly. Update relevant code documentation with links to the modified schema and migration script details.
- [ ] Step 2: Update categories.yaml to include the new entries for “coding” and “agentic”, then verify changes through automated testing of the file's contents against a golden standard.
- [ ] Step 3: Review model-routing docs for completeness and accuracy. Ensure changes are properly reflected in all relevant sections, including decision logic implementation, before finalizing updates.
- [ ] Step 4: Establish a detailed specification for the categories.yaml file, including its location, expected format, and required elements, to ensure clarity and consistency throughout the registry establishment process.
- [ ] Step 5: Update action text: Wire the AI stack's capability registry API to use the judgment dispatch hook for runtime capability lookup by adding a call to 'add_creds_to_registry_and_dispatch' in ai-stack's setup function. Verify the update by checking that a newly created runner can successfully look up its capabilities using get_capabilities_from_judgement.
- [ ] Step 1: Extend the AiCategory schema by adding `coding` and `agentic` properties with a clear description of their expected values (e.g., booleans or enums) and ensure that all relevant types, models, and existing data are updated accordingly. Update relevant code documentation with links to the modified schema and migration script details.
- [ ] Step 2: Update categories.yaml to include the new entries for “coding” and “agentic”, then verify changes through automated testing of the file's contents against a golden standard.
- [ ] Step 3: Review model-routing docs for completeness and accuracy. Ensure changes are properly reflected in all relevant sections, including decision logic implementation, before finalizing updates.
- [ ] Step 4: Establish a detailed specification for the categories.yaml file, including its location, expected format, and required elements, to ensure clarity and consistency throughout the registry establishment process.
- [ ] Step 5: Update action text: Wire the AI stack's capability registry API to use the judgment dispatch hook for runtime capability lookup by adding a call to 'add_creds_to_registry_and_dispatch' in ai-stack's setup function. Verify the update by checking that a newly created runner can successfully look up its capabilities using get_capabilities_from_judgement.

- [ ] **Step 1a:** Verify "coding" category is present in `categories.yaml`.
- [ ] **Step 1b:** Verify "agentic" category is present in `categories.yaml`.
- [ ] **Step 2:** Integration test: Prove that a task with `tag: coding` resolves to the correct model tier.

### Integration & Regression

- [ ] **Type Check:** Run `npm run typecheck` and ensure no type errors from extended union.
- [ ] **Unit Tests:** Verify all existing unit tests regarding taxonomy remain unaffected by the change.
- [ ] **Regression Test:** Confirm that Existing 4-category tasks (chat, reasoning, embedding, image) still dispatch identically before and after the change.
- [ ] CI Validation: Ensure `categories.yaml` is validated against `schema.ts` at CI time. A mismatch should fail the build.
## Rollback Procedures
| Scenario | Rollback |
|---|---|---|
| `coding`/`agentic` values in `categories.yaml` or schema.ts mismatch union type — dispatch routes to undefined handler | Revert `schema.ts`, update mapping in `categories.yaml` and model-routing docs to reflect default value of AiCategory. Restore original 4 values for AiCategory.
| `judgment_dispatch_hook` reads stale or missing `categories.yaml` — ai-stack capability registry sends job to wrong inference target because of incorrect metadata in categories.yaml | Revert changes made to `categories.yaml`, update hook wiring and restore old static mapping in the capability registry.
## Risk Assessment
| Description | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TypeScript union (`AiCategory`) and `categories.yaml` drift apart | Medium | High | Generate TypeScript types from `categories.yaml` at build time; reject PRs that modify one without the other |
| `judgment_dispatch_hook` wiring breaks existing dispatch for pre-existing categories | Low | High | Add integration tests for the hook that verify all 4 original categories still route identically before and after |
| Downstream consumers (LiteLLM/Olla configs, dashboards) choke on `coding`/`agentic` values | Medium | Medium | Add backward-compat mapping in the hook: unknown categories fall through to existing `reasoning` path; deploy consumers before hook rollout |
| YAML registry logic (display names, depr
## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | AI-improved via Review | NetYeti |
| 2026-06-17 | Created from approved proposal | NetYeti |


## Structural Review

Here is an analysis of the governance plan with specific and actionable suggestions under each heading:

**Missing Steps**

* More details on how to handle conflicts between `categories.yaml` and TypeScript union (`AiCategory`). The risk assessment mentions generating types from `categories.yaml` at build time as a mitigation, but it's unclear what steps are required for this.
* A clear explanation of "Route Atoms and Plan Steps to the Right Model at Authorship Time" is still missing. What does this mean in practical terms? How do the plan steps achieve this goal?
* Consider adding a step on how to document and maintain the new taxonomy, including any updates or modifications.

**Duplicate or Overlapping Steps**

* Step 2 ("Update categories.yaml") and Step 4 ("Establish YAML as registry") seem somewhat similar, but with different focuses. A more detailed breakdown of these steps might be helpful to avoid overlap.
* Remove redundant verbiage from the testing plan to make it easier to follow.

**Approach Gaps**

* As mentioned in the review, there's a disconnect between Step 4 and Step 5. Consider adding explicit links or dependencies between these steps to clarify the flow.
* Clarify how the plan addresses ongoing maintenance of the taxonomy, including dealing with new categories, conflicts, or updates.

**Step Ordering**

* Reorder Step 3 ("Review model-routing docs") before Step 2 ("Update categories.yaml"). This makes sense because you'll want to ensure the model-routing documents are up-to-date before modifying categories.yaml.
* Consider removing Step 1a and Step 1b from the TESTING PLAN as these seem unnecessary after Step 1 has been completed.


## AI Review Findings

### Overall Assessment

Here's a review of the plan overview:

**Coherence:** Yes, the plan is coherent and follows a logical sequence. The steps build upon each other to establish a standardized taxonomy for AI task categories.

**Gaps:**

* There seems to be a disconnect between Step 4 ("Establish YAML as registry") and Step 5 ("Wire capability registry"). It's unclear how these two steps are related or how the YAML registration (Step 4) leads to the wiring of the capability registry (Step 5).
* There is no mention of what " Route Atoms and Plan Steps to the Right Model at Authorship Time" means, which is mentioned in the plan title. It's unclear how this aligns with the specific steps outlined.
* The testing section only includes a single scenario for Step 1, but it's not clear if there will be additional tests or scenarios for subsequent steps.

Overall, while the plan has a clear sequence of steps, some connections between these steps could be
