---
title: AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time
status: approved
author: NetYeti
author-role: contributor
created: 2026-06-17
created_by: NetYeti@phoenix
tags: [planning, ai, routing, policy-atoms, litellm, olla, phase-4]
proposal_source: proposals/approved/ai-task-category-taxonomy
priority: high
phase: 4
automated: guided
waiting_reason:
assigned_to: ["NetYeti"]
related_to:
  - plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
  - docs/policy-atom-model-routing.md
  - docs/policy-atom-hooks.md
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:
cancellation_reason:
template_version: "1.0"
tests_defined: true
tests_human_reviewed: false
gate_reviewer:
gate_status:
gate_date:
gate_note:
gate_reviews: []
gate_quorum: 1
scenario_synthesis: >
  TypeScript schema extension + YAML registry + ai-stack routing config + Web UI
  dropdown. No VS Code API. Policy-atoms-core changes are additive. ai-stack
  integration is an independent workstream that can run in parallel with steps 1-2.
_path: plans/ai-task-category-taxonomy.md
---

# AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model

## Overview

Extends the `AiCategory` taxonomy from 4 to 6 values, establishes a formal
`categories.yaml` registry, and wires the ai-stack capability registry to the
`judgment_dispatch_hook`. DocWright emits the label at authorship time; LiteLLM/Olla
uses it to route each unit of work to the right model without runtime inference.

**Already implemented (do not re-implement):**
- `AiCategory` type (`none | classification | generation | reasoning`) in `schema.ts`
- `ai_category` field in all 10 governance atoms
- `judgment_dispatch_hook(ai_category, payload)` interface — Step 5 of atom plan
- `docs/policy-atom-model-routing.md` — routing reference for 4 existing categories

**This plan adds:** 2 new categories (`coding`, `agentic`), the `categories.yaml`
registry, ai-stack capability registry, atomic plan generation, and creation-time
category suggestion.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 0 | **Rebuild `approve-proposal` plan generation using atomic queries** | Replace the current naive template parser (`approve-proposal/+server.ts`) with a multi-call atomic approach. **Why first:** the current generator produced a broken plan from this proposal — wrong steps, no testing plan, no rollback. That's the exact problem this proposal solves. Prove it by fixing the tool that broke. Implementation: (1) `classification` call — parse proposal structure, identify sections and phasing; (2) `generation` call — write Implementation Steps table from identified phases; (3) `generation` call — write Testing Plan from proposal scope; (4) `generation` call — write Rollback Procedures; (5) `reasoning` call — write Risk Assessment. Fall back to current template approach if model unavailable. Add `generatePlanSections(proposal, judgmentHook)` helper in a new `src/webui/src/routes/api/approve-proposal/plan-generator.ts`. | ⏳ Pending |
| 1 | **Extend `AiCategory` schema — add `coding` and `agentic`** | In `src/policy-atoms-core/schema.ts`: extend `AiCategory` union type to `'none' \| 'classification' \| 'generation' \| 'reasoning' \| 'coding' \| 'agentic'`. Update JSON Schema enum, update `validateAtomFrontmatter()` enum check. Update `docs/policy-atom-model-routing.md` with routing tables for the two new categories: `coding` → `cluster-nvidia/qwen2.5-coder:14b` primary; `agentic` → `cluster-nvidia/mistral-small3.2:24b` primary (verified tools, large context). Update `test/policy-atoms-core/schema.test.ts`. Run `npm run atoms:isolation` — zero external imports must still hold. | ⏳ Pending |
| 2 | **`src/policy-atoms-core/categories.yaml` registry** | Create YAML file with display names, descriptions, status for all 6 categories. This is additive metadata over the TypeScript type — the TypeScript union remains the contract. Schema: `id`, `name`, `description`, `status: active\|deprecated`, `min_model`, `routing_notes`. Export a `loadCategoryRegistry()` function from `policy-atoms-core`. Sync-checker gains an optional check: if `categories.yaml` exists, validate that every atom's `ai_category` is a known non-deprecated ID. | ⏳ Pending |
| 3 | **ai-stack integration — capability registry + LiteLLM routing** | In the ai-stack project (independent workstream, parallel to steps 1-2): create `capability-registry.yaml` mapping `(ai_category)` to `(model, endpoint, node)` per fleet node. Wire LiteLLM routing config to read from this registry. Document which models handle which categories with benchmark references. Provide the `judgment_dispatch_hook` implementation that reads the registry. Test: route a `classification` task and confirm it goes to cheap local model; route a `reasoning` task and confirm it goes to 14b+ or cloud fallback. | ⏳ Pending |
| 4 | **Creation-time category suggestion — `create-plan` endpoint + UI** | `src/webui/src/routes/api/approve-proposal/+server.ts` (or a dedicated `create-plan` endpoint): after the atomic plan generation (Step 0) produces the step table, make a `classification` call per step to suggest `ai_category`. The suggestion is written as a comment or an optional column. Web UI: add `ai_category` dropdown to plan step editor (optional column — existing plans without it continue to work). Proposal frontmatter form: add `ai_category` field suggestion. This is a Phase 4/5 Web UI deliverable; steps 0-3 do not depend on it. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 0: Run `approve-proposal` on a real proposal with a "Notes for Plan Generation" section — resulting plan has correct implementation steps, non-trivial testing plan, rollback, and risk assessment
- [ ] Step 0: If model unavailable, endpoint falls back to old template approach without error
- [ ] Step 0: Run this plan's own proposal through the new generator — verify it produces better output than the original bare-template result
- [ ] Step 1: `npm run test:atoms` — 167+ tests passing; new schema tests cover `coding` and `agentic` in validateAtomFrontmatter
- [ ] Step 1: `npm run atoms:isolation` — zero external imports still confirmed
- [ ] Step 1: `npm run typecheck` — clean after AiCategory extension
- [ ] Step 1: Existing atoms with `ai_category: none/classification/generation/reasoning` unaffected by additive change
- [ ] Step 2: `categories.yaml` loads correctly; all 6 categories present with required fields
- [ ] Step 2: Sync-checker optional validation passes for all existing atoms
- [ ] Step 3: Mock `judgment_dispatch_hook` with category-aware routing; verify `classification` → cheap model, `reasoning` → capable model, `coding` → code-specialist
- [ ] Step 4: UI test — create-plan suggests `ai_category` for each step; dropdown override works; existing plans without column still load

### Integration & Regression

- [ ] `npm test` passes without modification at every step
- [ ] `npm run typecheck` clean at every step
- [ ] All existing atoms still valid after Step 1 schema extension
- [ ] `approve-proposal` endpoint still works with old proposals that lack "Notes for Plan Generation"

### Gate Criteria

- [ ] Human reviewer has verified step outcomes above
- [ ] Step 0 demonstrated on a real proposal (including this plan's own proposal)
- [ ] Step 1 type extension is additive — no existing atom files modified
- [ ] ai-stack integration (Step 3) may be deferred without blocking Steps 0, 1, 2, 4

## Rollback Procedures

| Scenario | Rollback |
|----------|---------|
| Step 0 breaks approve-proposal | Revert `plan-generator.ts`; old template approach is the fallback; plans become sparse again but functional |
| Step 1 breaks atom tests | AiCategory extension is additive; remove new values from union + enum; all existing atoms unaffected |
| Step 2 categories.yaml causes issues | Delete file; `loadCategoryRegistry()` returns empty; sync-checker skips optional check |
| Step 3 ai-stack routing causes model errors | Remove capability-registry.yaml from LiteLLM config; fallback to manual model selection |
| Step 4 UI dropdown breaks plan editor | Remove dropdown; `ai_category` reverts to manual frontmatter entry |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Step 0 model unavailable during approval | Medium | Low | Hard fallback to old template; bare plan is still created |
| Step 1 schema extension breaks downstream tools that hardcode 4-value AiCategory enum | Low | Medium | Additive change; TypeScript union is exhaustively checked; new values only appear in new atoms |
| Step 3 ai-stack workstream slips | High | Low | Explicitly parallel; DocWright steps 0-2 do not depend on it; ship independently |
| Step 4 creation-time suggestion latency is user-visible | Medium | Low | Classification call is cheap + fast (<1s on cluster); async suggestion; non-blocking UI |
| `coding`/`agentic` category routing uses unverified models (qwen3.5:27b) | Medium | Medium | Both primary models are from verified-tools tier; document qwen3.5:27b unproven tool-support caveat in routing doc |

## Related Documents

- [[proposals/approved/ai-task-category-taxonomy.md]] — source proposal
- [[plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md]] — completed prerequisite
- [[docs/policy-atom-model-routing.md]] — existing 4-category routing reference; extended in Step 1
- [[docs/policy-atom-hooks.md]] — `judgment_dispatch_hook` contract; Step 3 fulfills this interface
- [[docs/ai-inference-routing-research.md]] — prior Olla routing research

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | Plan rewritten — original auto-generated version had wrong steps, no testing plan, no rollback. Root cause: monolithic template parser extracted steps from wrong proposal section. Step 0 added to fix plan generation itself using atomic queries — the self-demonstrating first deliverable. | NetYeti |
