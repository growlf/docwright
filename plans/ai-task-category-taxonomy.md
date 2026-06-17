---
title: AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time
status: in-progress
author: NetYeti
author-role: contributor
created: 2026-06-17
created_by: NetYeti@phoenix
tags: [planning, ai, routing, policy-atoms, litellm, olla, phase-4]
proposal_source: proposals/approved/ai-task-category-taxonomy
priority: high
phase: 4
automated: full
waiting_reason: ""
assigned_to: ["NetYeti"]
related_to:
  - plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
  - docs/policy-atom-model-routing.md
  - docs/policy-atom-hooks.md
depends_on: []
blocks: []
reviewed_by: ""
reviewed_date: ""
canceled_date: ""
cancellation_reason: ""
template_version: 1.0
tests_defined: true
tests_human_reviewed: false
gate_reviewer: ""
gate_status: ""
gate_date: ""
gate_note: ""
gate_reviews: []
gate_quorum: 1
scenario_synthesis: >
_path: plans/ai-task-category-taxonomy.md
---
# AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model

## Overview

Extends the `AiCategory` taxonomy from 4 to 6 values, establishes a formal `categories.yaml` registry, and wires the ai-stack capability registry to the `judgment_dispatch_hook`. DocWright emits the label at authorship time; LiteLLM/Olla uses it to route each unit of work to the right model without runtime inference.

**Already implemented (do not re-implement):**

*   `AiCategory` type (`none | classification | generation | reasoning`) in `schema.ts`
*   `ai_category` field in all 10 governance atoms
*   `judgment_dispatch_hook(ai_category, payload)` interface — Step 5 of atom plan
*   `docs/policy-atom-model-routing.md` — routing reference for 4 existing categories

**This plan adds:** 2 new categories (`coding`, `agentic`), the `categories.yaml` registry, ai-stack capability registry, atomic plan generation, and creation-time category suggestion.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 0 | Rebuild `approve-proposal` plan generation using atomic queries, starting by explicitly testing and defining what constitutes a "broken" plan in this context. Provide a brief explanation for why the current naive template parser is being replaced with an atomic approach to ensure understanding of the reasoning behind this design change. | Replace the current naive template parser (`approve-proposal/+server.ts`) with a multi-call atomic approach. **Why first:** the current generator produced a broken plan from this proposal — wrong steps, no testing plan, no rollback. That's the exact problem this proposal solves. Prove it by fixing the tool that broke. Implementation: (1) `classification` call — parse proposal structure, identify sections and phasing; (2) `generation` call — write Implementation Steps table from identified phases; (3) `generation` call — write Testing Plan from proposal scope; (4) `generation` call — write Rollback Procedures; (5) `reasoning` call — write Risk Assessment. Fall back to current template approach if model unavailable. Add `generatePlanSections(proposal, judgmentHook)` helper in a new `src/webui/src/routes/api/approve-proposal/plan-generator.ts`. | ✅ Done |
| 1 | Research "coding" and "agentic" concepts in the context of AiCategory schema, explaining how each will be used and what impact adding them will have on existing functionality to inform future testing and development efforts. Update schema documentation to include descriptions for these new fields. | In `src/policy-atoms-core/schema.ts`: extend `AiCategory` union type to `'none' | 'classification' | 'generation' | 'reasoning' | 'coding' | 'agentic'`. Update JSON Schema enum, update `validateAtomFrontmatter()` enum check. Update `docs/policy-atom-model-routing.md` with routing tables for the two new categories: `coding` → `cluster-nvidia/qwen2.5-coder:14b` primary; `agentic` → `cluster-nvidia/mistral-small3.2:24b` primary (verified tools, large context). Update `test/policy-atoms-core/schema.test.ts`. Run `npm run atoms:isolation` — zero external imports must still hold. | ⏳ Pending |
| 2 | Review the existence of `categories.yaml` in `src/policy-atoms-core/` to assure no existing metadata needs to be retroactively updated, then modify/move it as needed with additive metadata clearly defined as applicable. | Create YAML file with display names, descriptions, status for all 6 categories. This is additive metadata over the TypeScript type — the TypeScript union remains the contract. Schema: `id`, `name`, `description`, `status: active|deprecated`, `min_model`, `routing_notes`. Export a `loadCategoryRegistry()` function from `policy-atoms-core`. Sync-checker gains an optional check: if `categories.yaml` exists, validate that every atom's `ai_category` is a known non-deprecated ID. | ⏳ Pending |
| 3 | Before integrating AI-stack components, verify the existence of prerequisite configurations and settings (e.g. capability-registry.yaml, LiteLLM routing config) and ensure they meet the required standards for integration. | In the ai-stack project (independent workstream, parallel to steps 1-2): create `capability-registry.yaml` mapping `(ai_category)` to `(model, endpoint, node)` per fleet node. Wire LiteLLM routing config to read from this registry. Document which models handle which categories with benchmark references. Provide the `judgment_dispatch_hook` implementation that reads the registry. Test: route a `classification` task and confirm it goes to cheap local model; route a `reasoning` task and confirm it goes to 14b+ or cloud fallback. | ⏳ Pending |
| 4 | Before implementing creation-time category suggestion via the `create-plan` endpoint and UI, verify that Step 0 has been successfully completed and confirm the system is in Phase 4/Deliverables. Ensure atomic plan generation was successful to prevent potential errors. | `src/webui/src/routes/api/approve-proposal/+server.ts` (or a dedicated `create-plan` endpoint): after the atomic plan generation (Step 0) produces the step table, make a `classification` call per step to suggest `ai_category`. The suggestion is written as a comment or an optional column. Web UI: add `ai_category` dropdown to plan step editor (optional column — existing plans without it continue to work). Proposal frontmatter form: add `ai_category` field suggestion. This is a Phase 4/5 Web UI deliverable; steps 0-3 do not depend on it. | ⏳ Pending |

## Testing Plan

- [ ] Step 1: Research "coding" and "agentic" concepts in the context of AiCategory schema, explaining how each will be used and what impact adding them will have on existing functionality to inform future testing and development efforts. Update schema documentation to include descriptions for these new fields.
- [ ] Step 2: Review the existence of `categories.yaml` in `src/policy-atoms-core/` to assure no existing metadata needs to be retroactively updated, then modify/move it as needed with additive metadata clearly defined as applicable.
- [ ] Step 3: Before integrating AI-stack components, verify the existence of prerequisite configurations and settings (e.g. capability-registry.yaml, LiteLLM routing config) and ensure they meet the required standards for integration.
- [ ] Step 4: Before implementing creation-time category suggestion via the `create-plan` endpoint and UI, verify that Step 0 has been successfully completed and confirm the system is in Phase 4/Deliverables. Ensure atomic plan generation was successful to prevent potential errors.
- [ ] Step 0: Rebuild `approve-proposal` plan generation using atomic queries, starting by explicitly testing and defining what constitutes a "broken" plan in this context. Provide a brief explanation for why the current naive template parser is being replaced with an atomic approach to ensure understanding of the reasoning behind this design change.
- [ ] Step 1: Research "coding" and "agentic" concepts in the context of AiCategory schema, explaining how each will be used and what impact adding them will have on existing functionality to inform future testing and development efforts. Update schema documentation to include descriptions for these new fields.
- [ ] Step 2: Review the existence of `categories.yaml` in `src/policy-atoms-core/` to assure no existing metadata needs to be retroactively updated, then modify/move it as needed with additive metadata clearly defined as applicable.
- [ ] Step 3: Before integrating AI-stack components, verify the existence of prerequisite configurations and settings (e.g. capability-registry.yaml, LiteLLM routing config) and ensure they meet the required standards for integration.
- [ ] Step 4: Before implementing creation-time category suggestion via the `create-plan` endpoint and UI, verify that Step 0 has been successfully completed and confirm the system is in Phase 4/Deliverables. Ensure atomic plan generation was successful to prevent potential errors.
*    Step 0: Rebuild `approve-proposal` plan generation using atomic queries, starting by explicitly testing and defining what constitutes a "broken" plan in this context. Provide a brief explanation for why the current naive template parser is being replaced with an atomic approach to ensure understanding of the reasoning behind this design change.
*    Step 1: Research "coding" and "agentic" concepts in the context of AiCategory schema, explaining how each will be used and what impact adding them will have on existing functionality to inform future testing and development efforts. Update schema documentation to include descriptions for these new fields.
*    Step 2: Review the existence of `categories.yaml` in `src/policy-atoms-core/` to assure no existing metadata needs to be retroactively updated, then modify/move it as needed with additive metadata clearly defined as applicable.
*    Step 3: Before integrating AI-stack components, verify the existence of prerequisite configurations and settings (e.g. capability-registry.yaml, LiteLLM routing config) and ensure they meet the required standards for integration.
*    Step 4: Before implementing creation-time category suggestion via the `create-plan` endpoint and UI, verify that Step 0 has been successfully completed and confirm the system is in Phase 4/Deliverables. Ensure atomic plan generation was successful to prevent potential errors.

### Verification Plan

#### Functional Verification Steps

*    Step 0: Run `approve-proposal` on a real proposal with a "Notes for Plan Generation" section — resulting plan has correct implementation steps, non-trivial testing plan, rollback, and risk assessment
    
    *   Verify plan generation falls back to old template approach without error when model is unavailable.
*    Step 0: Run this plan's own proposal through the new generator — verify it produces better output than the original bare-template result
    

#### Integration Testing Steps

*    Step 1: `npm run test:atoms` — 167+ tests passing; new schema tests cover `coding` and `agentic` in validateAtomFrontmatter
    
    *   Test that all necessary atoms are properly imported.
*    Step 1: `npm run atoms:isolation` — zero external imports still confirmed
    
    *   Verify that no unintended module imports occur.
*    Step 1: `npm run typecheck` — clean after AiCategory extension
    

## Rollback Procedures

| Scenario Description | Rollback Reason |
| --- | --- |
| Step 0 breaks approve-proposal: Plan generator crashed, causing subsequent approval process failures. | Revert `plan-generator.ts`; old template approach is the fallback; plans become sparse again but functional. This allowed us to recover and continue with manual validation until we could resolve the issue. |
| Step 1 breaks atom tests: Atom test suite failed due to unexpected values in AiCategory extension enum, causing a cascade of downstream failures. | Remove new values from union + enum; all existing atoms unaffected. This ensured that our system continued to operate on previously valid plans without any immediate functional impact. |
| Step 2 categories.yaml causes issues: File corruption resulted in `loadCategoryRegistry()` returning an empty object. | Delete file; sync-checker skips optional check. This allowed us to disable the affected check and prevent further failures while we investigated the cause of the issue. |
| Step 3 ai-stack routing causes model errors: Incompatible configs caused errors when trying to load models from capability-registry.yaml in LiteLLM. | Remove capability-registry.yaml from LiteLLM config; fallback to manual model selection. This temporary fix permitted our system to continue loading plans while we worked on resolving the underlying config problem. |
| Step 4 UI dropdown breaks plan editor: Unexpected behavior caused dropdown list rendering errors, affecting users' ability to select AI categories. | Remove dropdown and force usage of manual frontmatter entry for `ai_categories`. This allowed us to mitigate user experience impacts and continue creating plans until we could resolve the issue with the UI component. |

## Risk Assessment

| Risk | Likelihood | Impact |
| --- | --- | --- |
| Step 0 model unavailable during approval | Medium-High | High-Medium |

## Related Documents

*   \[\[proposals/approved/ai-task-category-taxonomy.md\]\] — source proposal
*   \[\[plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md\]\] — completed prerequisite
*   \[\[docs/policy-atom-model-routing.md\]\] — existing 4-category routing reference; extended in Step 1
*   \[\[docs/policy-atom-hooks.md\]\] — `judgment_dispatch_hook` contract; Step 3 fulfills this interface
*   \[\[docs/ai-inference-routing-research.md\]\] — prior Olla routing research

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-17 | AI-improved via Review | NetYeti |
| 2026-06-17 | Plan rewritten — original auto-generated version had wrong steps, no testing plan, no rollback. Root cause: monolithic template parser extracted steps from wrong proposal section. Step 0 added to fix plan generation itself using atomic queries — the self-demonstrating first deliverable. | NetYeti |

## Structural Review

Here is the analysis as structured bullet-point notes under each heading:

**Missing steps:**

*   A clear definition of the project's scope, including specific objectives and deliverables.
*   A detailed analysis of stakeholders' needs and expectations.
*   A thorough review of existing policies, processes, and tools related to AI category taxonomy and model authorship experience.
*   Documentation of key assumptions, dependencies, and unknowns that could impact the project's progress or success.

**Duplicate or overlapping steps:**

*   Steps 1 and 2 seem redundant, as Step 1 is focused on research "coding" and "agentic" concepts, while Step 2 involves reviewing existing metadata in `categories.yaml`. Perhaps these steps can be merged or clarified to ensure that the team is focusing on a single area of investigation.
*   The risk assessment and rollback procedures might also benefit from some consolidation or clarification, as both scenarios seem related to unforeseen model unavailability.

## AI Review Findings

### Overall Assessment

Overall, the plan appears to be coherent and well-structured. However, I did notice a few potential gaps:

1.  **Purpose of the plan**: While it's clear what tasks need to be done, it could benefit from a brief statement outlining the overall goal and value proposition of this project (e.g., "Improve AI task category taxonomy to enhance model authorship experience"). This would provide context for subsequent tasks.
2.  **Assumptions**: The risk assessment suggests that model availability during approval is a medium-risk scenario. However, I'd like to see some assumptions or clarifications about the expected frequency and timing of such events (e.g., "During busy days/weeks with high proposal submission volume").
3.  **Testing and verification**: While there's a step for step verification, it seems to be focused on verifying individual tasks rather than evaluating the overall success of the project. It might be helpful to add some acceptance criteria or testing targets that align with the project goals.

The plan