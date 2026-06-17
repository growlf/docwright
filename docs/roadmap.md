# DocWright Roadmap

Authoritative sequencing of all open work. For project goals and architecture,
see [[PROJECT.md]]. This document owns the *when* and *why now*.

**Critical path:** Phase 3 close → Phase 4 → Phase 5 → Phase 6 → Phase 7

Last reviewed: 2026-06-17 (v0.3.6)

---

## How to read this document

Work is ordered within each phase by **structural dependency** — earlier items
unlock later ones. Items marked ⚡ are blockers: downstream work cannot start
without them. Items marked 🔀 run as **parallel tracks** independent of the
current phase gate.

---

## Phase 3 — Vault Portability & Real-World Pilot (Current)

**Plan:** [[plans/phase-vault-portability-pilot.md]] · 8/11 steps done

**Thesis:** DocWright can be adopted by a real organization on an existing vault
with no manual file edits required.

**Gate:** Phase 3 closes when **both pilot vaults** complete a full
proposal→plan→completed cycle unassisted, AND a dogfooding cycle surfaces and
captures any friction found.

### 3a — MSP Pilot Vault ⚡

[[proposals/sub-plan-msp-pilot-vault.md]] — **unapproved, approve first**

### 3b — Cascade STEAM Early-Access Pilot ⚡

[[proposals/sub-plan-cascade-steam-early-access.md]] — **unapproved, approve second**

Both pilots must complete one full proposal→plan→completed cycle through DocWright
with no manual file edits. That is the Phase 3 acceptance bar.

### 3c — Dogfooding Cycle

Use DocWright to manage DocWright's own Phase 3 closure work — specifically, use
the Web UI and MCP tools to close Phase 3 itself. Capture any friction encountered
via `log_friction()` and file proposals before Phase 4 starts. This is the only
reliable way to surface missing features before they become blockers for external
adopters.

---

### 🔀 Cascade STEAM Production Deployment (parallel track, starts when Phase 3 closes)

This is Cascade STEAM org work running in parallel with DocWright's Phase 4 — it
is not gated by Phase 4 completion. The one DocWright feature it waits for is ACL
integration (Phase 5, step 5c), which unlocks proper Forgejo team membership
enforcement.

Cascade STEAM production = Forgejo server, DNS/TLS, AI stack wired up, governance
loop running with real users. This is the reference implementation.

---

## Phase 4 — Governance Enforcement Foundations

**Gate:** Phase 3 must close before Phase 4 begins.

**Thesis:** All governance rules are mechanically enforced, not just documented.
After Phase 4, an AI agent operating on any vault is constrained by its plan's
`mode:`, knows which rules apply via profile scope routing, and cannot bypass
lifecycle gates.

Phase 4 has exactly **three items in strict order**. Each unlocks the next.

### 4a — Execution Mode Enforcement ⚡ (must land first)

`plan-execution-mode-rename.md` (partial — linter done, migration done)

**Why first:** Without write intercept in the Web UI, `mode: autonomous` is a
label with no enforcement. Everything in Phase 5 that involves AI doing work
assumes modes are real constraints, not suggestions.

Remaining work:
- Web UI mode badge (properties pane + document header)
- Write intercept layer: mentor → staging panel; guided → review queue; autonomous → direct write + `ai-last-action:` stamp
- AI preamble injection per mode on plan open
- Update `AGENTS.md` and all profile templates

### 4b — Profile Engine Full Runtime ⚡ (unlocks 4c, and all of Phase 5)

Phase 4 plan, step 1.

**Why second:** Profile-aware features — deduplication check, per-profile AI prompts,
ACL enforcement, research context injection — cannot work without the full profile
engine runtime. Schema migration, template resolution, and UI switching ship here.
The override merge engine was Phase 3; full runtime is here.

### 4c — Lifecycle Gates Phase 2 ⚡

[[plans/bundle-lifecycle-gates-phase-2.md]]

**Why third:** Its dependency (`lifecycle-gates-extension-bundle`) is already complete.
Cascade STEAM going production requires proper gate enforcement — AI-assisted gate prep,
multi-reviewer quorum, and scheduled compliance triggers are governance maturity
prerequisites, not polish. Shipping without this is the governance equivalent of
deploying without auth.

Delivers: AI-assisted gate preparation, multi-reviewer quorum, retroactive audit,
time-based/scheduled triggers, governance audit JSONL log.

---

## Phase 5 — Profile-Aware Features

**Gate:** Phase 4 (all three items) must close before Phase 5 begins.

**Thesis:** The enforcement infrastructure built in Phase 4 is used to deliver
features that know which profile they're operating in. These items have structural
dependencies on Phase 4 but are largely parallel to each other.

### 5a — Judgment Atom Mode Interaction

[[proposals/deferred-judgment-atom-mode-interaction.md]]

Depends on 4c (lifecycle gates Phase 2 creates the MCP gate call sites this needs).
Makes `evaluateJudgmentAtom()` results advisory/staged/blocking based on plan `mode:`.

### 5b — Vault-Wide Wikilink Index

Phase 5 plan, step 2. Required before contributor autocomplete, related-docs UX
improvements, and wikilink backref updating on rename.

### 5c — Forgejo ACL Integration

Phase 5 plan, step 3. Depends on 4b (profile engine) for `author-role:` field
resolution against Forgejo team membership. When this lands, the Cascade STEAM
production parallel track can fully close.

### 5d — Research AI Tooling + RLM Microservice

Phase 5 plan, steps 4–7. Depends on 4b (profile engine) for context injection.

- AI-assisted research sessions (question + findings injected into chat context)
- Research → proposal generation from concluded research docs
- Multi-perspective research (parallel model review)
- **RLM Python microservice** [[proposals/deferred-rlm-python-microservice.md]] —
  the correct implementation for all multi-document AI tasks (collation, policy atom
  cross-reference, knowledge-base ingest). ~50-line Python service wrapping `rlms`,
  OpenAI-compatible endpoint. **Pending ai-stack GPU fix** (external dependency:
  `qwen2.5-coder:14b` minimum; Phoenix Arc cannot run it; remote NVIDIA GPU currently
  broken). Ships in this step when that fix lands. Until then: apply the RLM pattern
  manually in prompts (scan index first, fetch targeted docs, then analyze).

### 5e — New Proposal UX & Structural Improvements

Depends on 4b (profile engine) to know which document types to scan:
- `new-proposals-should-check-before-actual-creation.md` — deduplication check before file creation
- `new-proposal-ux-description-priority-and-immediate-view.md` — description+priority first, AI generates title

### 5f — Contribution Pipeline

`sub-plan-contribution-pipeline.md`

`contribute_upstream()` MCP tool, `log_friction()`, `list_docwright_issues`. No
dependency on 5a–5e — can run in parallel with all of Phase 5. Moved from Phase 3
gate because it doesn't gate anything there.

### 5g — Graph View & Executor Panel Polish

- `plan-ui-lifecycle-graph-view.md` — lifecycle funnel view, D3.js dependency graph
- `formalize-step-counter-sync.md` — auto-sync step counter validation
- `phases-and-the-master-plan-are-mostly-invisible-to-the-user.md` — surface current phase in status page
- `executor-panel-live-feedback.md` — step name display + token count

### 🔀 Chat & Session Panel Phase 2 (parallel track)

[[plans/bundle-chat-session-panel.md]] — in progress, no phase dependency.

Completes when it's done. Does not gate Phase 5 start and is not gated by it.
Assign to Phase 6 close for planning purposes only.

---

## Phase 6 — Feature Bundles & UI Polish

**Gate:** Phase 5 must close; Cascade STEAM production must be live.

**Thesis:** The system works and is deployed. Now improve it based on real usage
feedback from non-developer governance users.

| Work | Plan/Proposal | Priority |
|------|-------------|---------|
| AI Capabilities Bundle | [[proposals/bundle-ai-capabilities.md]] | Medium |
| `org-operations` profile full implementation | Phase 6 plan | High |
| `knowledge-base` profile full implementation | Phase 6 plan | Medium |
| AI Task Category Taxonomy Steps 3–4 | [[plans/ai-task-category-taxonomy.md]] | Medium |
| Enterprise Tier Bundle | [[proposals/bundle-enterprise-tier.md]] | Medium |
| UI Polish cycle | [[proposals/plan-ui-polish-bundle-panels-tags-navigation-wikilinks-and-deferred-polish.md]] | Low — needs real user feedback first |

**Decision required before Phase 6 starts — `plan-steps-structured-frontmatter.md`:**
YAML steps as source of truth rewrites every plan file and is a breaking structural
change. Either land it early Phase 5 (before anything builds on current step format)
or defer it explicitly to Phase 6. **This must be a decision, not a note.**

---

## Phase 7 — Public Release

| Work | Notes |
|------|-------|
| VSCodium extension | After Web UI validated by real users in Phase 6 |
| Distribution, documentation site, demo GIFs | After alpha validated |
| Second maintainer onboarded | Required gate before public release |
| Windows + macOS CI validation | After alpha |
| Kubernetes/Helm deployment | Docker compose sufficient until scale demands it |

---

## Post-Alpha (Deliberately Deferred)

Well-scoped and genuinely useful but do not start until the Web UI has been validated
by non-developer governance users in production.

| Work | Why deferred |
|------|-------------|
| `offline-pwa-support.md` | Edit conflict resolution with git is non-trivial |
| `gantt-view-dependencies.md` | Awaiting wider `depends_on` + `estimated_effort` adoption |
| `mobile-wysiwyg-editing.md` | iOS contenteditable reliability |
| `kubernetes-deployment.md` | Docker compose sufficient until scale demands it |
| `ui-white-label-brand-settings.md` | Needs settings panel architecture first |
| `remote-registry-sync.md` | Privacy/trust design complexity |
| Phase B — Shared Team Daemon | After Phase 7 |
| Phase C — Live Co-Editing | Aspirational; Y.js CRDT; revisit after Phase B |

---

## Small Fixes (Do Whenever — No Phase Gate)

| Work | Effort | What it fixes |
|------|--------|--------------|
| `deferred-frontmatter-validate-assigned-to-strictness.md` | XS | False positive on `assigned_to: ""` for unapproved proposals |
| `deferred-watcher-presence-indicator.md` | S | Show watcher presence badge during AI sessions |
| `enforce-release-tag-script.md` | S | Pre-commit hook to block manual `git tag`, enforce `npm run release:tag` |

---

## What Is Complete

| Work | Version | Notes |
|------|---------|-------|
| Phase 0 — Spike | v0.1.x | `opencode serve` HTTP API validated |
| Phase 1 — Web UI Prototype | v0.2.x | Full lifecycle, AI integration, containerization |
| Phase 2 — Foundation | v0.3.x | TS MCP, research stage, policy atoms, adoption tooling, mode migration |
| Policy Atom Framework (5 steps) | v0.3.3 | Moved forward from Phase 4 |
| Plan Completion Gate Bug (4 gaps) | v0.3.3 | `checkCompletionGate` fixed, client-side blocker |
| Phase 3 partial (8/11 steps) | v0.3.x | Vault portability, init, adopt, profile merge, migration |

---

## Dependency Graph

```
Phase 3 (pilots + dogfooding)
    │
    ├──→ 🔀 Cascade STEAM production (parallel — waits for 5c ACL to fully close)
    │
Phase 4 (enforcement foundations — strictly ordered)
    4a (mode enforcement) → 4b (profile engine) → 4c (lifecycle gates)
    │
Phase 5 (profile-aware features — largely parallel after Phase 4)
    ├── 5a (judgment atom mode)    [needs 4c]
    ├── 5b (wikilink index)        [needs 4b]
    ├── 5c (Forgejo ACL)           [needs 4b] → closes Cascade STEAM production track
    ├── 5d (research AI + RLM*)    [needs 4b + ai-stack GPU fix]
    ├── 5e (proposal UX)           [needs 4b]
    ├── 5f (contribution pipeline) [truly independent]
    └── 5g (graph view + polish)   [needs 4b]
    │
    🔀 Chat & Session Panel Ph2    [no phase dependency — closes here]
    │
Phase 6 (feature bundles — needs real user feedback)
    │
Phase 7 (public release)

* RLM microservice: [[proposals/deferred-rlm-python-microservice.md]]
  Pending ai-stack GPU fix. Policy atom pre-condition already met (v0.3.x).
```

Small fixes and 5f (contribution pipeline) have no phase dependencies.
