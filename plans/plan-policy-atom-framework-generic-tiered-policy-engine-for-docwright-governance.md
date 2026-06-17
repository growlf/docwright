---
title: Policy Atom Framework — Generic Tiered Policy Engine
status: approved
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
mode: autonomous
scenario_synthesis: Policy atom decomposition — build policy-atoms-core library in isolation, pilot with 2-3 live rules, migrate remaining governance checks, add manager/project isolation; no IDE-specific steps
assigned_to: NetYeti
proposal_source: proposals/policy-atom-framework.md
depends_on: []
related_to:
  - docs/profile-contribution-architecture.md
  - plans/plan-ui-polish-bundle-panels-tags-navigation-wikilinks-and-deferred-polish.md
  - plans/completed/enforce-lifecycle-compliance.md
tests_defined: true
tests_human_reviewed: false
total_steps: 5
completed_steps: 0
_path: plans/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
---
# Policy Atom Framework — Generic Tiered Policy Engine

## Overview

Decomposes DocWright's governance from a monolithic rule-set into small, standalone, individually-enforceable units ("atoms"). Each atom has three synchronized representations sized for different consumers. A generic `policy-atoms-core` library provides the index- builder, router, resolver, and sync-checker — reusable by any project DocWright manages, and by any AI surface (OpenCode, Claude, Gemini, local LLMs via Olla/LiteLLM).

Full design (atom schema, two-pass consumption model, `kind` split, three-tier enforcement resolution, open questions) is in \[\[docs/policy-atom-framework-concept.md\]\]. The design is considered done; this plan executes it. See **Design Decisions Required** for the five questions that must be answered before Step 1 begins.

**Naming note:** The atom type field is `kind` throughout this plan (matching the YAML schema examples). `kind` appears in some early notes and design decisions — treat it as a synonym; `kind` is canonical.

**RLM integration note (from [[research/rlm-recursive-language-models.md]]):** Multi-atom cross-reference analysis (the router querying across 20+ atoms) should use RLM-style decomposition: recursive index scan + targeted fetch, rather than loading all atom contexts into a single window. The atom frontmatter (`tags:`, `scope:`, `related:`) is the navigation index an RLM needs. This is not in scope for this plan (RLM pre-requisites: GPU fix + Python microservice); apply the pattern manually in prompts until then — scan the synopsis index first, fetch only relevant atom contexts. When RLM pre-requisites are met, create the deferred proposal: "RLM Python microservice for multi-document AI analysis."

**Execution mode interaction for judgment atoms:** When a plan is in `mode: mentor`, `evaluate_at_gate()` still fires but its output is advisory-only — the judgment result is surfaced as a suggestion, not a blocking gate. In `mode: guided`, results are staged for human review before becoming blocking. In `mode: autonomous`, results block as written. The Web UI write-intercept layer (per [[research/plan-execution-mode-enforcement.md]]) enforces this — judgment atom evaluation itself is mode-unaware; the caller's mode context determines how the result is treated.

## Problem

DocWright's current governance is a monolithic rule-set (`.opencode/rules/*`, pre-commit hooks, lifecycle-gate checks) that mixes deterministic checks (frontmatter validity, status-transition legality) with judgment-requiring checks (is this description specific enough) in a single undifferentiated layer. As governance rules grow — and especially as DocWright moves toward managing _other_ projects' policy sets — this shape creates three problems:

1.  **Context cost.** Any AI agent needs governance awareness must load the full rule-set, even for the 90% of cases where only one or two rules are relevant.
2.  **No atomic enforceability.** Rules aren't independently versioned, tested, or toggled. Changing one means re-reviewing the whole governance surface.
3.  **No tiered enforcement.** There is no clean mechanism for "this installation's preference" vs. "an organization's non-negotiable floor" vs. "general best-practice default" to coexist and resolve predictably — a gap that matters as DocWright becomes a manager-of-projects tool.

## Proposed Solution

Introduce a **Policy Atom Framework**: decompose governance rules into atoms, each with three synchronized representations:

| Representation | Canonical? | Size | Consumer |
| --- | --- | --- | --- |
| **Synopsis** | — | 1–2 sentences | Synopsis index — loaded every session, always in context |
| **Context** | Judgment atoms | Full rule, rationale, examples | Loaded on-demand when the router routes a query to this atom |
| **Code** | Deterministic atoms | Executable check function | Run by MCP server or pre-commit hook with zero AI cost |

**The canonical source direction is not symmetric.** For `deterministic` atoms the code is the ground truth — the prose describes what the code does, and if they diverge the code wins. For `judgment` atoms there is no code — the context prose is the canonical source, and the synopsis must accurately summarize it. The sync-checker enforces the correct direction per `kind`, not a generic "all three must match" rule.

### Synopsis format and the `scope` field

Each synopsis index entry is compact YAML. The `scope` field is the router's primary routing signal — an agent committing code loads only `scope: [git-commit]` atoms; an agent reviewing a plan loads `scope: [plan]` atoms. No agent loads everything.

```yaml
atoms:
  - id: commit-format
    kind: deterministic
    scope: [git-commit]
    synopsis: "Commit messages must follow 'type: description' format."

  - id: no-self-approval
    kind: deterministic
    scope: [proposal, plan]
    synopsis: "AI cannot set approved:true or gate_status:approved on governance docs."

  - id: plan-scope-adequacy
    kind: judgment
    scope: [plan]
    synopsis: "Plan steps must be specific enough to be actionable without clarification."
```

**Scope expressions support inheritance.** A rule scoped to `plan` applies to all plans. A rule scoped to `plan.approved` applies only during the approval transition. A rule scoped to `plan.*` matches any plan sub-scope. This avoids atom explosion (one per edge case) and coarse over-loading (everything applies everywhere). Scope expression syntax is defined in the atom schema and enforced by the sync-checker.

### `kind` — the decision is permanent-ish

Classifying a rule as `deterministic` means committing to maintaining its code check in sync with its prose for the life of the rule. A `judgment` rule is cheaper to write but permanently dependent on a capable LLM. Get the classification right early.

**Expected split for DocWright's current rules (~80/20):**

| Kind | Examples | ~% of rules |
| --- | --- | --- |
| `deterministic` | field presence, regex, status-transition tables, file placement, required section headers, numeric ranges | ~80% |
| `judgment` | scope adequacy ("is this specific enough?"), conflict detection, quality thresholds ("is this testing plan meaningful?") | ~20% |

The deterministic majority is the core value: most governance enforcement runs as code with zero AI involvement and works identically on OpenCode, Claude, Gemini, and any local model.

### Sync-checker scope

The sync-checker validates **structure, not semantics**:

*   **Deterministic atoms:** synopsis exists; context has required sections; code check compiles and exports the correct function signature; code and synopsis describe the same field/pattern (light structural check — e.g., a `field_required` atom's synopsis must name the field the code checks).
*   **Judgment atoms:** synopsis exists and is under the length budget; context has required sections (rule statement, rationale, examples, scope); no code check present. Semantic equivalence between synopsis and context is a human review responsibility, not CI.

### `policy-atoms-core` library components

*   **Index-builder** — scans `policies/` and produces the synopsis index YAML
*   **Router** — pass-1: given an action context (commit, plan write, proposal approval), returns the list of atom IDs whose scope matches
*   **Resolver** — pass-2: loads full context for a given atom ID list only
*   **Sync-checker** — validates structure and canonical-source direction per `kind`
*   **Check-type library** — reusable deterministic check functions: `field_required`, `status_transition_allowed`, `regex_match`, `linked_artifact_exists`, `section_present`, `enum_value`

### Two-pass consumption model

*   **Pass 1 (cheap):** load synopsis index → router returns relevant atom IDs
*   **Pass 2 (on-demand):** resolver loads full context for only the relevant atoms

This model works across all AI surfaces because the synopsis index is the only thing that must always fit in context — Pass 2 is optional and pay-per-use.

### Three-tier enforcement resolution (lowest wins)

1.  Atom default — what the atom ships with
2.  Instance config — this installation's override (`.docwright/config.json`)
3.  Org-policy floor — optional signed override from an external org bundle

**Org-bundle tier:** scoped to a pluggable `org-source` hook interface only in this plan. Transport and trust-anchor are explicitly deferred until a real org-governance need exists.

### Future direction: LiteLLM as atom dispatch layer

Not in scope for this plan, but the natural next step: LiteLLM sits between DocWright's MCP server and AI backends. The atom router communicates `kind` to LiteLLM so it can route `deterministic` atoms to code execution (zero LLM), and `judgment` atoms to the cheapest capable model for the complexity. The org-source hook interface (Step 5) is the natural sibling to the LiteLLM routing hook — design the interface with this extension point in mind. Evaluation caching (keyed on `atom_id + document_hash + atom_version`) belongs at this layer too.

### Multi-AI surface compatibility

The synopsis-index → on-demand resolver model is the design's key portability guarantee. Context constraints differ significantly across surfaces:

| Surface | Practical context | Impact |
| --- | --- | --- |
| Local 8b model (Olla) | 4k–8k tokens | Synopsis index must fit in ~2k tokens to leave working room |
| Claude | 200k tokens | Synopsis always fits; temptation to load everything — resist it |
| Gemini | 1M+ tokens | More slack, but routing discipline still prevents token waste |
| OpenCode | Session-scoped | MCP tools are the natural router integration point |

The synopsis size budget (to be decided in **Design Decisions Required** Q1) must be set for the most constrained realistic surface and held there.

## Design Decisions Required

These five questions must be answered before Step 1 begins. Answers here become the specification inputs for the atom schema and `policy-atoms-core` architecture.

**Q1 — Synopsis index size budget** What is the maximum token count for the full synopsis index? This number constrains the total atom count and average synopsis length, and must be set for the most constrained realistic AI surface (local 8b model). The sync-checker enforces this limit on every commit to `policies/`. Hard limit: **1,500 tokens** (~30 atoms at an average 50-token synopsis), with a soft warning at 1,200. Rationale: a local 8b model at 4k context cannot spare more than ~1,500 tokens for the index and still have useful working context. 30 atoms is sufficient if scope expressions (`plan.*`) are used to avoid atom explosion.

> **Decision:** 1,500 token hard limit enforced by sync-checker; 1,200 token soft warning. Scope expressions are the primary tool for keeping atom count manageable.

**Q2 — Bootstrap: bundled default atoms or vault-starts-empty?** Does DocWright ship a default `policies/` directory that every new vault inherits (like the bundled profiles), or does each vault start empty and define its own atoms from scratch? The answer determines whether `docwright init` needs a policy-seeding step and whether DocWright's own governance atoms are a dependency of every managed project or just a reference example.

> **Decision:** Ship a bundled default `policies/` with DocWright, seeded by `docwright init` the same way profiles are seeded. DocWright's own governance atoms are the reference implementation and first thing any adopter sees. Vaults can override or extend; they do not start from nothing.

**Q3 — MCP router invocation pattern** The answer differs by `kind` — the two atom types have different invocation needs:

*   **`none` (deterministic) atoms** already run automatically today through pre-commit hooks and MCP validation logic. The migration for these atoms is _how_ they run (monolithic rule file → atom code check), not _when_. Auto-wiring into existing MCP tools (Option B) is correct here — low risk, fast checks, no circular dependency.
    
*   **`reasoning`/judgment atoms** must not fire automatically on every MCP mutation — the cost is too high and most mutations don't warrant a judgment evaluation. These fire at defined lifecycle gates (plan approval, proposal creation, gate transitions) via an explicit `evaluate_at_gate(gate_id, document_path)` call. This is Option A, but the tool is gate-scoped, not a generic query router.
    

With `ai_category` labels on every atom (from the AI Task Category Taxonomy proposal), the dispatcher reads the label rather than inferring the task type — so no general- purpose `route_governance_query` tool is needed at all.

> **Decision:** Split by kind. Deterministic (`ai_category: none`) atoms auto-wire into existing MCP tools (Option B pattern). Judgment atoms use explicit `evaluate_at_gate(gate_id, document_path)` at lifecycle gate points (scoped Option A). No generic `route_governance_query` tool — `ai_category` labels replace runtime inference. Architecture locked for Step 2.

**Q4 — Judgment atom cache key** When a judgment atom evaluation is cached (to avoid re-running LLM checks on unchanged documents), the cache key must include the model used — a judgment from `llama3.1:8b` and one from `claude-sonnet-4-6` are not the same judgment and must not share a cache slot. Without `model_id`, stale judgments from a weaker model are served to a stronger one (or vice versa) after a backend switch.

> **Decision:** Cache key is `(atom_id, document_hash, atom_version, model_id)`. `atom_version` invalidates on rule prose updates. `model_id` invalidates on model changes. All four components required; omitting any risks serving stale or wrong judgments.

**Q5 — LiteLLM integration depth in this plan** The LiteLLM dispatch layer is future scope, but the hook interface defined in Step 5 should make it a natural extension rather than requiring a later interface change. Step 5 defines two pluggable hooks in the resolver — both as stub implementations only, no routing logic built in this plan:

1.  `org_source_hook` — today's scope: pluggable org-policy floor (returns `null` when unconfigured)
2.  `judgment_dispatch_hook` — new addition: accepts `(ai_category: string, payload: string)` and returns `Promise<string>`; stub returns `null` (falls back to default model). Signature is specified now so the LiteLLM integration slots in without touching the resolver interface again.

The `ai_category` parameter is the concrete output of the AI Task Category Taxonomy proposal — the two proposals are explicitly coupled at this interface point.

> **Decision:** Step 5 defines both hooks as named, typed, stub interfaces. The `judgment_dispatch_hook` signature is `(ai_category: string, payload: string) => Promise<string | null>`. Actual LiteLLM routing implementation is a separate later plan that fulfills this interface. No routing logic built here.

> **Dependency note:** `ai_category` label values come from the AI Task Category Taxonomy proposal, which is explicitly coupled to this plan. If that proposal is not yet approved when Step 1 begins, define a minimal inline taxonomy (e.g., `none`, `classification`, `generation`, `reasoning`) sufficient to type the hook interface. The full taxonomy can extend these values later without breaking the interface — the hook signature is `string`, not an enum.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | **Spike** — build `policy-atoms-core` in complete isolation | Define atom YAML schema and JSON Schema validator. **Freeze the scope expression grammar** (`plan`, `plan.*`, `plan.approved`, `proposal`, `git-commit`) as a named deliverable — grammar must be defined before any atoms are written. Implement index-builder, router, resolver, and sync-checker as a standalone TypeScript package under `src/policy-atoms-core/`. Include the deterministic check-type library: `field_required`, `status_transition_allowed`, `regex_match`, `linked_artifact_exists`. **Add CI isolation check:** a `depcheck` or import-scan script that fails if any `src/policy-atoms-core/` file imports from outside the package — run as a pre-commit gate and a CI step. No DocWright integration — pure library. Full unit test coverage before moving to Step 2. | ✅ Done |
| 2 | **Pilot** — decompose 3 named rules into atoms + seed `policies/` | Pilot candidates (pre-selected): (1) `commit-format` — deterministic, scope `[git-commit]`, `regex_match` check; (2) `frontmatter-validate` — deterministic, scope `[proposal, plan]`, `field_required` checks; (3) `no-work-before-approval` — deterministic, scope `[plan]`, `status_transition_allowed` check. Express each as a policy atom under `policies/`. Wire DocWright's MCP server to consult the atom router for those three rules **alongside** (not replacing) existing checks — both paths run; output compared before any retirement. Add atom-specific tests. **Run side-by-side equivalence test:** for each pilot atom, feed the same document to the old-path check and the atom check; assert identical pass/fail decision. **Seed `policies/` in `docwright init` and `adopt-vault.ts`:** once pilot atoms pass, add `policies/` directory + pilot atom files to the `init.ts` and `adopt-vault.ts` file-creation lists and update their manifests. | ✅ Done |
| 3 | **Migration** — replace old enforcement paths with coexistence shim | Migrate remaining `.opencode/rules/*` and pre-commit deterministic checks into atoms. **Coexistence mechanism:** add `DOCWRIGHT_ATOM_ROUTING=1` env var; when set, MCP tools run BOTH old-path and atom check, log divergences. Retire old-path only after: atom passes full suite, equivalence test passes, flag enabled in CI for one full run. See [[docs/policy-atom-scope-routing.md]] for which MCP tools wire to which atoms. **Migration audit table** (fill in as rules migrate — do not start Step 3 without completing this table): | ⏳ Pending |

**Step 3 migration audit table:**

| Rule file | Atom ID | Kind | MCP tool(s) wired | Scope | Equiv tested | Old-path retired |
|-----------|---------|------|------------------|-------|-------------|-----------------|
| `commit-format.md` | `commit-format` | deterministic | hook only | `git-commit` | ✅ Step 2 | ⏳ |
| `frontmatter-validate.md` | `frontmatter-validate` | deterministic | `write_plan`, `set_plan_field`, hook | `proposal`, `plan` | ✅ Step 2 | ⏳ |
| `no-work-before-approval.md` | `no-work-before-approval` | deterministic | `update_plan_status`, `transition_to_approved` | `plan.approved` | ✅ Step 2 | ⏳ |
| `governance-writes.md` | `governance-writes` | judgment | `write_plan`, `set_plan_field` | `plan`, `proposal` | ⏳ | ⏳ |
| `lifecycle-gate.md` | `lifecycle-gate` | deterministic | `transition_to_approved`, `transition_to_completed` | `plan.approved`, `plan.completing` | ⏳ | ⏳ |
| `no-plaintext-creds.md` | `no-plaintext-creds` | deterministic | hook only | `git-commit` | ⏳ | ⏳ |
| `no-secrets.md` | `no-secrets` | deterministic | hook only | `git-commit` | ⏳ | ⏳ |
| `hook-failure-feedback.md` | `hook-failure-feedback` | judgment | preamble only — no MCP wiring | `git-commit` | ⏳ | ⏳ |
| `one-off-formalization.md` | `one-off-formalization` | judgment | AI preamble | `plan`, `proposal` | ⏳ | ⏳ |
| `ci-watch-on-tag-push.md` | `ci-watch-on-tag-push` | deterministic | hook only | `git-commit` | ⏳ | ⏳ |
| 4 | **Manager/project separation** — independent atom sets | Add `<managed-project>/policies/` support: independent atom set per managed project, same engine, no cross-contamination with DocWright's own `policies/`. MCP router must scope queries to the active project's atom set. Verify with a real secondary vault (bms-ai-cluster or DAFO). | ⏳ Pending |
| 5 | **Org-bundle tier** — pluggable interface only | Implement the resolver's two pluggable hooks as named, typed, stub interfaces: (1) `org_source_hook(atom_id: string) => Promise<AtomOverride | null>` — returns `null` when unconfigured; (2) `judgment_dispatch_hook(ai_category: string, payload: string) => Promise<string | null>` — returns `null` to fall back to default model. Document hook location, contract, and extension path for LiteLLM integration. Do NOT build transport or trust-anchor. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: `policy-atoms-core` unit tests pass in complete isolation (`npm test` from `src/policy-atoms-core/`)
- [ ] Step 1: `depcheck`/import-scan CI gate confirms zero DocWright-specific imports; gate runs in pre-commit and CI
- [ ] Step 1: Scope expression grammar frozen and documented; parser tests cover `plan`, `plan.*`, `plan.approved`, `git-commit`, `proposal`
- [ ] Step 1: Synopsis index size enforced by sync-checker; hard limit 1,500 tokens, soft warning at 1,200
- [ ] Step 2: Three pilot atoms (`commit-format`, `frontmatter-validate`, `no-work-before-approval`) enforce correctly
- [ ] Step 2: Side-by-side equivalence test — atom check and old-path check produce identical pass/fail for same documents; assert in test suite
- [ ] Step 2: All existing pre-commit and MCP tests still pass with both paths running
- [ ] Step 2: `policies/` directory seeded in `docwright init` and `adopt-vault.ts`; manifest updated
- [ ] Step 3: `DOCWRIGHT_ATOM_ROUTING=1` flag routes all governance checks through atom router; full test suite passes
- [ ] Step 3: Migration audit table complete — every rule has: atom ID, equivalence tested, old-path retired
- [ ] Step 3: No governance rules unintentionally dropped (audit table review)
- [ ] Step 4: Secondary vault uses independent atom set; no bleed from DocWright's own `policies/`
- [ ] Step 5: `org_source_hook` and `judgment_dispatch_hook` present, typed, documented, return `null` gracefully when not configured
- [ ] Step 5: `judgment_dispatch_hook` signature matches Q5 decision: `(ai_category: string, payload: string) => Promise<string | null>`

### Integration & Regression

- [ ] Existing tests pass without modification at every step (`npm test`)
- [ ] TypeScript compiles cleanly at every step (`npm run typecheck`)
- [ ] Atom-backed deterministic rules produce identical decisions to old-path checks for all known inputs (enforced by Step 2 side-by-side test; regression check at Step 3)
- [ ] Synopsis index stays under 1,500-token hard limit throughout Steps 2–5 (sync-checker enforces)
- [ ] `npm run init` seeds `policies/` correctly after Step 2; `npm run adopt` seeds it in adopted vaults
- [ ] Judgment atom `evaluate_at_gate()` output is advisory-only in `mode: mentor`, staged in `mode: guided`, blocking in `mode: autonomous` (per [[research/plan-execution-mode-enforcement.md]])

### Gate Criteria

- [ ] Human reviewer has verified step outcomes above
- [ ] No governance rules unintentionally dropped — Step 3 migration audit table complete with every rule accounted for
- [ ] `policy-atoms-core` has zero DocWright-specific imports — CI isolation gate added in Step 1 and still passing
- [ ] `judgment_dispatch_hook` signature matches Q5 decision: `(ai_category: string, payload: string) => Promise<string | null>`
- [ ] Scope expression grammar frozen in Step 1 and not modified in Steps 2–5 (grammar changes require a new plan revision)

## Risk Assessment

*   **Migration disruption (Step 3):** Atom checks run alongside old checks before any old-path is retired. No hard cutover. Low risk.
*   **Scope creep (org-bundle tier):** Explicitly scoped to interface-only. Transport and trust-anchor are deferred.
*   **Synopsis index size creep:** If the index grows beyond the budget it defeats the whole design for small-context models. Sync-checker enforces the budget from Step 1. Budget is set in Design Decision Q1.
*   **Judgment atom quality regression:** When judgment atoms replace old rule prose, the LLM may interpret them differently across model families. Pilot (Step 2) catches this with side-by-side comparison — run the old check and the atom check on the same document, compare outcomes before retiring the old path.
*   **Canonical source drift:** If deterministic atom prose diverges from its code check silently, governance is misrepresented to agents. The sync-checker's direction-aware validation (code canonical for deterministic, prose canonical for judgment) prevents this — but only if it runs in CI. Enforce as a pre-commit gate from Step 1.
*   **Scope expression complexity:** Hierarchical scope expressions (`plan.*`, `plan.approved`) add expressiveness but also parser complexity. Define and freeze the scope expression grammar in Step 1 before any atoms are written — retrofitting grammar changes is expensive.

## Rollback Procedures

*   **Steps 1–2:** Pure additions — no production impact. Remove `policies/` and the MCP router wiring.
*   **Step 3:** Old-path checks retired incrementally. Revert by re-enabling `.opencode/rules/*` files from git history.
*   **Steps 4–5:** Additive. Remove `<managed-project>/policies/` or the org-source hook stub without affecting core function.

## Expected Outcomes

*   Existing governance rules (commit-format, frontmatter-validate, lifecycle-gate, no-secrets, etc.) decomposed into atoms — most becoming pure-code `deterministic` checks with zero AI involvement.
*   A reusable check-type library covering the bulk of current rules.
*   Synopsis index small enough that any AI agent session (regardless of context size) can always see "what governance categories might apply here" cheaply.
*   Foundation for manager/project separation: DocWright's own `policies/` vs. a managed project's `policies/`, same engine.
*   Enforcement resolution (default/instance/org) implemented with org-bundle transport left as a documented, pluggable interface.

## Resources Required

*   New `src/policy-atoms-core/` package (TypeScript) — design, implement, test in isolation first.
*   Migration pass over `.opencode/rules/*`, `pre-commit.sh`, and lifecycle-gate logic to map each check to an atom `kind`.
*   New `policies/` top-level directory + 2–3 initial atoms as pilot before full migration.
*   No new external dependencies for the deterministic check library; judgment atoms reuse existing OpenCode/AI session plumbing.

## Model Routing Reference

See [[docs/policy-atom-model-routing.md]] for the full per-category model table,
fallback chain, offline stack, and special settings. Summary:

| `ai_category` | Primary | Fallback | Settings |
|---------------|---------|---------|---------|
| `none` | — (code only) | — | no LLM |
| `classification` | `cluster-nvidia/qwen2.5:14b` | `opencode/big-pickle` | temp=0, max_tokens=100 |
| `generation` | `cluster-nvidia/mistral-small3.2:24b` | `anthropic/claude-sonnet-4-6` | temp=0.2, max_tokens=2000 |
| `reasoning` | `cluster-nvidia/mistral-small3.2:24b` | `anthropic/claude-sonnet-4-6` | temp=0.5, max_tokens=800 |

`qwen3.5:27b` is available for pure-text reasoning (no tool calls) but tool support is unproven — do not use for gate evaluations that call MCP tools. `llama3.1:8b` cannot handle DocWright's instruction payload (decisions-ledger F3). Do not run 14b+ models directly on Phoenix Arc (F6).

## Related Documents

*   \[\[docs/policy-atom-framework-concept.md\]\] — full design reference (schema, two-pass model, enforcement tiers, open questions)
*   \[\[plans/completed/enforce-lifecycle-compliance.md\]\] — predecessor that defined the monolithic enforcement baseline this framework decomposes and replaces (Step 3). Not a dependency — the atom framework can begin regardless of whether enforce-lifecycle-compliance's code tasks were implemented; it supersedes them.
*   \[\[docs/profile-contribution-architecture.md\]\] — profile/module contribution design that benefits from per-project atom sets
*   \[\[PROJECT.md\]\] §8 Profile System, §14 Phase 4 — manager/ACL context this framework supports

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-14 | Design decisions filled — Q1 budget 1.5k tokens, Q2 bundled default, Q3 split by kind, Q4 four-component cache key, Q5 dual hook stubs; coupled to AI Task Category Taxonomy proposal | NetYeti |
| 2026-06-14 | Design expanded — canonical source direction, synopsis format, scope inheritance, sync-checker scope, LiteLLM future direction, multi-AI surface table, Design Decisions Required section | NetYeti |
| 2026-06-14 | Plan rewritten — steps from Notes section, duplicates removed, frontmatter corrected | NetYeti |
| 2026-06-12 | Initial draft created | NetYeti |
| 2026-06-17 | Critique + improvement pass: `automated:full`→`mode:autonomous`; `check_kind`→`kind` (canonical); RLM integration note added; execution mode interaction for judgment atoms defined; scope grammar made Step 1 deliverable; AI category taxonomy dependency noted; pilot candidates pre-selected (commit-format, frontmatter-validate, no-work-before-approval); CI isolation mechanism specified (depcheck/import-scan); coexistence flag (`DOCWRIGHT_ATOM_ROUTING`) added to Step 3; `policies/` seeding added to Step 2; side-by-side equivalence test moved from Risk into testing plan; testing section deduplicated and updated. Model Routing Reference section added (→ docs/policy-atom-model-routing.md). `depends_on: enforce-lifecycle-compliance` corrected to `related_to` — relationship is predecessor/superseded, not blocking dependency. | NetYeti |