---
title: AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time
status: in-progress
author: NetYeti
author-role: contributor
created: 2026-06-17
created_by: NetYeti@phoenix
tags: [planning, ai, routing, policy-atoms, litellm, olla, phase-4]
proposal_source: proposals/approved/ai-task-category-taxonomy.md
priority: high
phase: 4
mode: guided
assigned_to: NetYeti
scenario_synthesis: Extend AiCategory TypeScript union and JSON Schema to 6 values, create categories.yaml registry, add routing docs for coding and agentic; no VS Code API, no database; ai-stack integration is an independent workstream
tests_defined: true
tests_human_reviewed: false
_path: plans/ai-model-routing.md
github_epic: null
---

# AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time

## Overview

Extends the `AiCategory` taxonomy from 4 to 6 values (`coding` + `agentic`), establishes
a formal `categories.yaml` registry, and documents the routing tables so LiteLLM/Olla can
route each unit of work to the right model without runtime inference. DocWright emits the
label at authorship time; the ai-stack project owns the capability registry.

**Already implemented (do not re-implement):**
- `AiCategory` union type (4 values) in `schema.ts`
- `ai_category` field in all 10 governance atoms
- `judgment_dispatch_hook(ai_category, payload)` interface — Step 5 of atom plan
- `docs/policy-atom-model-routing.md` — routing reference for 4 existing categories

**DocWright-side work added by this plan (Steps 1–2 done, Step 3 ai-stack):**
- Extended to 6 values (`coding`, `agentic`) with routing tables
- `src/policy-atoms-core/categories.yaml` registry with display metadata
- `src/policy-atoms-core/categories.ts` — `loadCategoryRegistry()` + `validateCategoryId()`

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | Extend `AiCategory` schema | Added `'coding'` and `'agentic'` to TypeScript union in `schema.ts`, updated JSON Schema enum, updated validator, added 2 new tests. Updated `docs/policy-atom-model-routing.md` with routing tables for both new categories. | ✅ Done | — | — |
| 2 | `categories.yaml` registry | Created `src/policy-atoms-core/categories.yaml` with display names, descriptions, status, min_model, routing_notes for all 6 categories. Exported `loadCategoryRegistry()` and `validateCategoryId()` from `categories.ts`. | ✅ Done | — | — |
| 3 | ai-stack capability registry | **Independent workstream — ai-stack project.** Create `capability-registry.yaml` mapping `(ai_category)` to `(model, endpoint, node)` per fleet node. Wire LiteLLM routing config to read from registry. Provide `judgment_dispatch_hook` implementation. See [[docs/policy-atom-model-routing.md]] for the routing reference DocWright has already established. | ⏳ Pending (ai-stack) | — | — |
| 4 | Creation-time category suggestion | `create-plan` endpoint: classification call per step to suggest `ai_category`. Web UI: `ai_category` dropdown in plan step editor (optional column). Phase 4/5 UI sprint — not blocking Steps 1–3. | ⏳ Pending (Phase 4/5 UI) | — | — |

## Parallelism Map

Steps that share no overlapping files can be worked simultaneously on separate `feat/` branches.
Fill in Depends On and Parallel With based on reviewing the step details above.

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | — | |
| 2 | — | — | |
| 3 | — | — | |
| 4 | — | — | |

## Testing Plan

### Step Verification

- [x] Step 1: `AiCategory` union extended to 6 values — `schema.ts` and JSON Schema enum both updated; `npm run typecheck` clean
- [x] Step 1: `validateAtomFrontmatter` accepts `coding` and `agentic` for judgment atoms — 2 new tests added, 169 total passing
- [x] Step 1: `npm run atoms:isolation` confirms zero external imports still hold
- [x] Step 1: Routing tables for `coding` (→ `qwen2.5-coder:14b`) and `agentic` (→ `mistral-small3.2:24b`) added to `docs/policy-atom-model-routing.md`
- [x] Step 2: `categories.yaml` exists at `src/policy-atoms-core/categories.yaml` with all 6 categories
- [x] Step 2: `loadCategoryRegistry()` returns all 6 entries with required fields
- [x] Step 2: Existing atoms using `none/classification/generation/reasoning` are unaffected — additive change only
- [ ] Step 3: `capability-registry.yaml` in ai-stack maps all 6 `ai_category` values to models/endpoints
- [ ] Step 3: LiteLLM routes `classification` to cheap local model; `reasoning` to 14b+ or cloud fallback
- [ ] Step 4: `create-plan` suggests `ai_category` per step; Web UI dropdown works; existing plans without column unaffected

### Integration & Regression

- [x] `npm run typecheck` — clean after AiCategory extension
- [x] `npm run test:atoms` — 169 passing including new `coding`/`agentic` tests
- [x] `npm run atoms:isolation` — zero external imports
- [x] All existing atoms still valid after additive schema change
- [ ] ai-stack LiteLLM integration tested end-to-end

### Gate Criteria

- [x] DocWright-side deliverables (Steps 1–2) complete and tested
- [x] `AiCategory` extension is additive — no existing atom files modified
- [ ] ai-stack capability registry (Step 3) delivered and documented — **deferred to ai-stack workstream**
- [ ] Human reviewer has verified step outcomes above

## Rollback Procedures

| Scenario | Rollback |
|----------|---------|
| `AiCategory` extension breaks callers checking 4-value enum | Revert union in `schema.ts` + enum in JSON Schema; existing atoms unaffected (additive change) |
| `categories.yaml` causes confusion when it drifts from TypeScript type | Delete file; `loadCategoryRegistry()` returns null gracefully; TypeScript type remains the contract |
| ai-stack LiteLLM routing breaks existing dispatch | Remove capability-registry.yaml from LiteLLM config; falls back to manual model selection |
| Creation-time suggestion (Step 4) breaks plan editor | Remove dropdown; `ai_category` reverts to manual frontmatter entry |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `AiCategory` union and `categories.yaml` drift apart | Medium | Medium | TypeScript type is the contract; YAML is display metadata only — drift is low-stakes |
| ai-stack Step 3 slips indefinitely | High | Low | DocWright-side is complete; ai-stack integration is explicitly parallel and non-blocking |
| `coding`/`agentic` routing uses unverified models | Medium | Medium | Both primary models are from verified-tools tier; caveats documented in routing doc |
| Step 4 creation-time suggestion adds latency to plan creation | Medium | Low | Classification call is fast + cheap; async suggestion; non-blocking UI |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | Created from approved proposal | NetYeti |
| 2026-06-17 | Steps 1+2 implemented. AI-generated plan was a mess (tripled testing plan, leaked review sections, wrong step statuses). Full rewrite to reflect actual implementation state. Step 3 explicitly scoped to ai-stack workstream. | NetYeti |
