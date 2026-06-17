---
title: AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time
author: NetYeti
author-role: contributor
created: 2026-06-14
tags:
  - ai
  - governance
  - routing
  - llm
  - policy-atoms
  - litellm
  - olla
  - phase-4
complexity: medium
approved: true
priority: high
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
  - docs/ai-inference-routing-research.md
  - docs/policy-atom-model-routing.md
  - docs/profile-contribution-architecture.md
depends_on: []
blocks: []
_path: proposals/ai-task-category-taxonomy.md
consumed_by: plans/ai-task-category-taxonomy.md
---

## What Is Already Implemented

The policy atom framework plan (completed 2026-06-17) delivered:

- **`AiCategory` type** in `src/policy-atoms-core/schema.ts` — `'none' | 'classification' | 'generation' | 'reasoning'` (4 values, enforced by JSON Schema validator)
- **`ai_category` field** in every atom's `atom.yaml` — all 10 DocWright governance atoms are already categorised
- **`judgment_dispatch_hook(ai_category, payload)` interface** — frozen per Design Decision Q5 in `src/policy-atoms-core/resolver.ts`
- **`docs/policy-atom-model-routing.md`** — model routing reference for the 4 existing categories, grounded in validated hardware constraints (decisions-ledger F3/F6)

This proposal picks up where that work stopped. It does **not** re-implement those deliverables.

## Summary

Extend the `AiCategory` taxonomy from 4 to 6 values, establish a formal `categories.yaml` registry with display metadata, embed category labels in plan steps at authorship time, and wire the ai-stack capability registry to the `judgment_dispatch_hook`. DocWright emits the label; LiteLLM/Olla uses it to route each unit of work to the most capable and cost-effective model — without runtime inference.

## Problem Statement

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

## Proposed Solution

### 1. Extend the taxonomy from 4 to 6 categories — grounded in DocWright's actual task mix

The existing 4-category model (`none`, `classification`, `generation`, `reasoning`) is correct for governance atoms. The gap is **plan execution**: plan steps that generate code need a code-specialized model; plan execution orchestration needs large-context + tool-capable routing. Neither maps cleanly to `generation` or `reasoning`.

**DocWright task-type audit** — what we actually generate:

| Task | Example | Current category | Adequate? |
|------|---------|-----------------|-----------|
| Frontmatter validation | pre-commit check | `none` | ✅ |
| Commit format check | pre-commit hook | `none` | ✅ |
| Scope assignment | "is this plan or proposal?" | `classification` | ✅ |
| Category suggestion | "what ai_category for this step?" | `classification` | ✅ |
| Proposal writing | fill-proposal, improve | `generation` | ✅ |
| Plan step generation | create-plan content | `generation` | ✅ |
| Session note writing | endsession | `generation` | ✅ |
| Critique / gate review | critique-plan, gate-pre-review | `reasoning` | ✅ |
| Scope adequacy judgment | "is this step specific enough?" | `reasoning` | ✅ |
| Overlap detection | collation | `reasoning` | ✅ |
| **Code generation in plan steps** | install-hooks.sh fix, adopt-vault.ts | `generation` (wrong) | ❌ routes to general model, not code-specialist |
| **Plan execution orchestration** | BigPickle running 14-step plan | `reasoning` (wrong) | ❌ needs large context + tool use, not just reasoning depth |

Two new categories are warranted. The remaining LMSYS categories (`extraction`, `summarization`, `writing`, `creative`, `roleplay`, `math`) are either handled by existing categories or simply do not appear in DocWright's governance task mix.

**Extended 6-category taxonomy** (additions are additive — existing 4 unchanged):

| ID (immutable slug) | What it covers | Typical minimum model |
|---------------------|---------------|----------------------|
| `none` | Deterministic — runs as code, no LLM involved | — |
| `classification` | Scope assignment, category suggestion, field presence check | Any 7b |
| `generation` | Structured prose writing — proposals, plans, session notes, templates | 7b–14b |
| `reasoning` | Critique, evaluation, logical inference, adequacy judgment, overlap detection | 14b+ |
| **`coding`** *(new)* | Code generation, review, debugging, refactoring in plan steps | Specialized: Qwen2.5-Coder, DeepSeek-Coder |
| **`agentic`** *(new)* | Multi-step plan execution, tool use orchestration, executor coordination | Large context + tool-use capable (mistral-small3.2:24b or claude-sonnet) |

**Schema migration:** Adding `coding` and `agentic` to `AiCategory` requires updating `schema.ts` (union type + JSON Schema enum) and `docs/policy-atom-model-routing.md` (two new routing sections). Existing atoms using `none`/`classification`/`generation`/`reasoning` are unaffected — additive change only.

### 2. Category IDs are immutable; `categories.yaml` is additive metadata

The **primary contract** is the `AiCategory` TypeScript union type in `src/policy-atoms-core/schema.ts`. That type is what the atom YAML validator, the `judgment_dispatch_hook` interface, and `docs/policy-atom-model-routing.md` all reference. It is the source of truth.

`src/policy-atoms-core/categories.yaml` is additive metadata on top of the TypeScript type — display names, descriptions, and deprecation status for human-readable registries and future UI dropdowns. It does NOT define the valid values (the TypeScript type does). This distinction matters: the YAML file can be added later without blocking the TypeScript schema extension.

Category IDs (slugs) are immutable once committed. Renaming requires a codebase-wide refactor of every atom YAML, plan step table, and proposal frontmatter that references the old ID. New categories are additive — append to the TypeScript union and the YAML registry simultaneously.

**Deprecation policy:** A deprecated category ID remains valid indefinitely in existing atoms and plan files. New atoms may not use a deprecated ID. No forced migration — the cost of migration exceeds the cost of keeping stale IDs valid.

### 3. Embed the label at authorship time — not dispatch time

Every unit of work that DocWright creates gets a category label at the moment it
is written:

**Governance atoms:** `ai_category` field in the atom YAML schema. Replaces the
need for a separate `check_kind` field — `check_kind: deterministic` becomes
`ai_category: none`; `check_kind: judgment` becomes `ai_category: reasoning` (or
whichever category the judgment requires).

```yaml
# policies/commit-format.yaml
id: commit-format
ai_category: none          # runs as code, zero LLM cost
scope: [git-commit]
synopsis: "Commit messages must follow 'type: description' format."
```

```yaml
# policies/plan-scope-adequacy.yaml
id: plan-scope-adequacy
ai_category: reasoning     # requires nuanced evaluation
scope: [plan]
synopsis: "Plan steps must be specific enough to execute without clarification."
```

**Plan steps:** an optional `ai_category` column in the Implementation Steps table.
DocWright's create-plan endpoint suggests a category for each step at creation time
using the cheapest capable model (`classification` task — fast, local, cheap). The
author confirms or overrides via the UI.

```markdown
| Step | Action | Details | AI Category | Status |
|------|--------|---------|-------------|--------|
| 1 | Define atom YAML schema | ... | `none` | ⏳ Pending |
| 2 | Implement index-builder | ... | `coding` | ⏳ Pending |
| 3 | Critique pilot atom set | ... | `reasoning` | ⏳ Pending |
```

**Scope note — breaking change for existing plan files:** Adding an `ai_category` column requires updates to: the plan step parser (`src/policy-atoms-core/` or `src/dispatch/`), the `create-plan` Web UI endpoint, and the step editor UI. Existing plan files without the column continue to work — the column is optional. A migration script should be provided to suggest categories for existing steps (one `classification` call per step). This is a Phase 4 / 5 Web UI deliverable, not blocking for the registry and schema extension.

**Proposals:** a `ai_category` frontmatter field on the proposal itself (the
primary task type the proposal represents). This gives the executor a default
category when a proposal is being processed without individual step-level labels.

### 4. DocWright emits the label; ai-stack owns the routing table

DocWright's responsibility ends at the label. The ai-stack project maintains a
capability registry that maps `(ai_category, complexity_hint)` to
`(model, endpoint, node)`:

```yaml
# ai-stack: capability-registry.yaml (lives in ai-stack project)
routing:
  none:
    handler: code          # never hits a model
  extraction:
    default: { model: qwen2.5:1.5b, endpoint: olla-phoenix, max_tokens: 2048 }
  classification:
    default: { model: qwen2.5:1.5b, endpoint: olla-phoenix, max_tokens: 1024 }
  summarization:
    default: { model: llama3.1:8b, endpoint: olla-phoenix, max_tokens: 4096 }
  writing:
    default: { model: llama3.1:8b, endpoint: olla-phoenix, max_tokens: 8192 }
  creative:
    default: { model: mistral:7b, endpoint: olla-phoenix, max_tokens: 8192 }
  reasoning:
    default: { model: qwen2.5:14b, endpoint: olla-phoenix, max_tokens: 8192 }
    fallback: { model: claude-sonnet-4-6, endpoint: anthropic-api }
  coding:
    default: { model: qwen2.5-coder:14b, endpoint: olla-phoenix, max_tokens: 16384 }
  agentic:
    default: { model: llama3.1:8b, endpoint: olla-phoenix, max_tokens: 32768 }
    fallback: { model: claude-sonnet-4-6, endpoint: anthropic-api }
```

LiteLLM reads this registry. DocWright's MCP server passes the `ai_category` label
through its `judgment_dispatch_hook` (defined in the policy atom framework plan,
Step 5). LiteLLM selects the model and routes the request.

### 5. Creation-time category suggestion via the create-plan and improve flows

When a plan step or proposal is created in the Web UI:

1. The step text is passed to a `classification` task (cheapest, local model)
2. The model returns a suggested `ai_category` from the 11-category list
3. The UI displays the suggestion with a dropdown to override
4. The confirmed category is written into the step table or frontmatter

This is a single fast local call at authorship — the category travels with the
document for its entire lifecycle. Every downstream dispatcher reads the label
rather than inferring it.

## Alternatives Considered

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

## Expected Outcomes

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

## Resources Required

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

## Notes for Plan Generation

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

## Related Documents

- [[plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md]] — completed prerequisite; atom schema and dispatch hook already implemented
- [[docs/policy-atom-model-routing.md]] — existing routing reference for 4 categories; will be extended in phase 1
- [[docs/policy-atom-hooks.md]] — `judgment_dispatch_hook` contract and LiteLLM extension path
- [[docs/ai-inference-routing-research.md]] — prior routing research and Olla stack context
- [[docs/profile-contribution-architecture.md]] — profile/module design that benefits from per-profile category defaults


*(AI improvement timeout — showing original body)*

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | AI-improved via Improve | NetYeti |
