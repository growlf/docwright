---
title: "AI Task Category Taxonomy — Route Atoms and Plan Steps to the Right Model at Authorship Time"
author: NetYeti
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
category:
  - ai
  - governance
complexity: medium
approved: false
priority: high
created_by: "NetYeti@phoenix"
assigned_to: []
related_to:
  - plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
  - docs/ai-inference-routing-research.md
  - docs/profile-contribution-architecture.md
depends_on:
  - plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
blocks: []
---

## Summary

Establish a stable, community-grounded taxonomy of AI task categories and embed
category labels directly into governance atoms, plan steps, and proposals at the
moment of authorship. DocWright emits the label; the ai-stack project and
LiteLLM/Olla use it to route each unit of work to the most capable and
cost-effective local or cloud model — without runtime inference about what kind
of task it is.

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

### 1. Adopt a community-standard AI task category taxonomy

Ground the taxonomy in the categories empirically validated by LMSYS MT-Bench and
corroborated by Portkey, OpenRouter, and the LLM routing research literature —
not invented from scratch. These 11 categories cover the full space of tasks
DocWright generates:

| ID (immutable slug) | What it covers | Typical minimum model |
|---------------------|---------------|----------------------|
| `none` | Deterministic — runs as code, no LLM involved | — |
| `extraction` | Pull structured data from text; parse tables, fields, frontmatter | Any 1b–7b |
| `classification` | Is this a proposal? What scope? What type? | Any 1b–7b |
| `summarization` | Condense, distill, TL;DR a document or section | 7b+ |
| `writing` | Functional writing — documents, emails, plans, structured prose | 7b–14b |
| `creative` | Expressive/stylistic writing, humor, voice, persona, tone | 7b–14b (Mistral excels) |
| `roleplay` | Character embodiment, persona-sustained dialogue | 7b–14b (Mistral/Mixtral excel) |
| `coding` | Code generation, review, debugging, refactoring | Specialized: Qwen2.5-Coder, DeepSeek-Coder |
| `math` | Computation, numeric reasoning, proofs | Specialized: Qwen-Math, DeepSeek-Math |
| `reasoning` | Critique, evaluation, cross-reference, logical inference, adequacy judgment | 14b+ or reasoning-specialized |
| `agentic` | Multi-step orchestration, tool use, planning loops, executor coordination | Large context + tool-use capable |

The `knowledge` category from LMSYS (factual domain recall) is intentionally
omitted — DocWright does not generate tasks whose primary value is knowing facts;
it generates tasks about governance and structure where `reasoning` or `extraction`
is the right label.

**Note on `creative`:** This is the natural home for tasks like "add a concise,
engaging summary header" or "write this policy in plain language with a light tone"
— the category where Mistral models specifically outperform. It is kept distinct
from `writing` (functional/structured) because routing to different model families
is the whole point.

### 2. Make category IDs immutable; everything else mutable

Category IDs (the slugs above) are baked into atom YAML files, plan step metadata,
and proposal frontmatter. They must never be renamed — that would require a
refactor of every data file that references the old ID.

Everything else is stored in a **category registry** (`src/policy-atoms-core/categories.yaml`
in DocWright, mirrored in the ai-stack capability registry):

- **Display name** — mutable, what UIs and agents see
- **Description** — mutable, expands on what the category covers
- **Status** — `active` or `deprecated` (deprecated: existing atoms keep working;
  no new atoms may use this ID)

New categories can be added at any time by appending to the registry. The cost of
adding is near-zero. The cost of renaming is a codebase-wide refactor — so names
are chosen to be stable, not perfect.

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

**DocWright:**
- `src/policy-atoms-core/categories.yaml` — category registry (IDs, display names,
  descriptions, status)
- Atom YAML schema: add `ai_category` field, derive `check_kind` from it
- `create-plan` endpoint: add classification call for step-level category suggestion
- Web UI: add `ai_category` dropdown to plan step editor and proposal frontmatter form
- `judgment_dispatch_hook` interface (Step 5 of policy atom plan): specify as
  `(ai_category: string, payload: string) => Promise<string>`

**ai-stack project:**
- `capability-registry.yaml` — maps `(ai_category)` to `(model, endpoint, node)`
  per node in the fleet
- LiteLLM routing config wired to read from registry
- Documentation: which models handle which categories, with benchmark references

**Shared:**
- Decision on category deprecation policy (how long deprecated IDs remain valid
  before data migration is required — suggest: indefinitely valid, never forced
  migration)

## Notes for Plan Generation

This proposal has two largely independent workstreams that can proceed in parallel
once the category registry is defined:

1. **DocWright integration** — add `ai_category` to atom schema, create-plan
   endpoint, plan step editor, proposal frontmatter. No ai-stack dependency except
   the registry definition.

2. **ai-stack integration** — capability registry, LiteLLM routing config, node
   capability documentation. No DocWright code dependency except the registry
   definition and hook interface.

The registry definition (the `categories.yaml` file with the 11 IDs) is the
single blocking dependency for both workstreams and should be the first deliverable.

Suggest phasing as:
1. Define and commit `categories.yaml` (DocWright) — the shared contract
2. Add `ai_category` to atom YAML schema and sync-checker (DocWright)
3. Wire `judgment_dispatch_hook` interface with `ai_category` parameter (DocWright)
4. Build capability registry and LiteLLM routing (ai-stack, parallel to step 3)
5. Add creation-time category suggestion to create-plan and UI (DocWright)

## Related Documents

- [[plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md]] — the atom schema and dispatch hook this proposal extends
- [[docs/ai-inference-routing-research.md]] — prior routing research and Olla stack context
- [[docs/profile-contribution-architecture.md]] — profile/module design that benefits from per-profile category defaults
