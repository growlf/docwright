# DocWright Roadmap

Authoritative sequencing of all open work. For project goals and architecture,
see [[PROJECT.md]]. This document owns the *when* and *why now*.

**Critical path:** Phase 3 close → Phase 4 → Phase 5 → Phase 6

Last reviewed: 2026-06-17 (v0.3.6)

---

## How to read this document

Work is ordered within each phase by **structural dependency** — earlier items
unlock later ones. "Phase-independent" items in previous versions of this
document were often incorrect; nearly everything has a dependency on something.
Items marked ⚡ are blockers: downstream work cannot start without them.

---

## Phase 3 — Vault Portability & Real-World Pilot (Current)

**Plan:** [[plans/phase-vault-portability-pilot.md]] · 8/11 steps done

**Gate:** Phase 3 closes when the **two real-world pilot vaults** succeed. The
contribution pipeline is independent and moves to Phase 4 — it does not gate
Phase 3.

| # | Work | Proposal | Status |
|---|------|---------|--------|
| 1 | Approve + execute MSP pilot vault | [[proposals/sub-plan-msp-pilot-vault.md]] | ⚡ Unapproved — **approve first** |
| 2 | Approve + execute Cascade STEAM early-access | [[proposals/sub-plan-cascade-steam-early-access.md]] | ⚡ Unapproved — **approve second** |

Both pilots must complete one full proposal→plan→completed cycle through DocWright
with no manual file edits. That is the Phase 3 acceptance bar.

**Note on contribution pipeline:** `sub-plan-contribution-pipeline` (the
`contribute_upstream` MCP tool) is in-progress but does **not** gate Phase 3.
It moves to Phase 4 as infrastructure work. It unblocks nobody in Phase 3.

---

## Phase 4 — Execution Enforcement, Profile Runtime & Governance Maturity

**Gate:** Phase 3 must close before Phase 4 begins.

Phase 4 has a strict internal ordering. Items marked ⚡ unlock the work below
them — do not start later work until its prerequisite is done.

### 4a — Execution Mode Enforcement ⚡ (must land first)

`plan-execution-mode-rename.md` (partial — linter done, migration done)

**Why first:** Execution mode enforcement (write intercept in the Web UI,
AI preamble injection per mode) is the foundation that ALL Phase 4 AI-assisted
work depends on. Judgment atom evaluation, research AI sessions, and ACL
gate prep all assume modes work. Without enforcement, `mode: autonomous` is
just a label.

Remaining work:
- Web UI mode badge (visible indicator in properties pane + document header)
- Write intercept layer (mentor → staging panel; guided → review queue; autonomous → direct write + `ai-last-action:` stamp)
- AI preamble injection per mode on plan open
- Update `AGENTS.md` and all profile templates

### 4b — Profile Engine Full Runtime ⚡ (unlocks 4c–4e)

Phase 4 plan, step 1.

**Why second:** Profile-aware features (deduplication check, per-profile AI
prompts, ACL enforcement) cannot work without the full profile engine runtime.
The override merge engine ships in Phase 3; full runtime (schema migration,
template resolution, UI switching) comes here.

### 4c — Lifecycle Gates Phase 2 ⚡ (moved up from Phase 5)

[[plans/bundle-lifecycle-gates-phase-2.md]]

**Why here, not Phase 5:** Its dependency (`lifecycle-gates-extension-bundle`)
is already completed. Cascade STEAM going live in Phase 5 *requires* proper
gate enforcement — AI-assisted gate prep, multi-reviewer quorum, and scheduled
triggers are governance maturity prerequisites for a production deployment.
Shipping Cascade STEAM without this is the governance equivalent of deploying
without auth.

Delivers: AI-assisted gate preparation, multi-reviewer quorum, retroactive
audit, time-based/scheduled triggers, governance audit JSONL log.

### 4d — Judgment Atom Mode Interaction (now unblocked)

[[proposals/deferred-judgment-atom-mode-interaction.md]]

**Why here:** Deferred because "MCP gate call sites don't exist yet." Lifecycle
Gates Phase 2 (4c) creates those call sites. This item moves from deferred to
Phase 4 once 4c lands — not Phase 5.

Makes `evaluateJudgmentAtom()` results advisory/staged/blocking based on plan
`mode:` value.

### 4e — Vault-Wide Wikilink Index

Phase 4 plan, step 2. Needed before contributor autocomplete, related-docs
UX improvements, and wikilink backref updating on rename.

### 4f — Forgejo ACL Integration

Phase 4 plan, step 3. Needs profile engine runtime (4b) for `author-role:`
field resolution against Forgejo team membership.

### 4g — Research AI Tooling

Phase 4 plan, steps 4–7. Needs profile engine (4b) for context injection and
research → proposal generation.

- AI-assisted research sessions (question + findings injected into chat context)
- Research → proposal generation from concluded research docs
- Multi-perspective research (parallel model review)
- ✨ Improve button for research documents

### 4h — New Proposal UX & Structural Improvements

These need profile engine runtime (4b) to know which document types to scan:

- `new-proposals-should-check-before-actual-creation.md` — deduplication check before file creation
- `new-proposal-ux-description-priority-and-immediate-view.md` — description+priority first, AI generates title

### 4i — Contribution Pipeline

`sub-plan-contribution-pipeline.md` (moved from Phase 3 gate)

`contribute_upstream()` MCP tool, `log_friction()`, `list_docwright_issues`.
No phase dependency — can run in parallel with 4a–4h. Moved here because it
doesn't gate Phase 3 and doesn't depend on anything else in Phase 4.

### 4j — Graph View, UI Polish

- `plan-ui-lifecycle-graph-view.md` — lifecycle funnel view, D3.js dependency graph
- `formalize-step-counter-sync.md` — auto-sync step counter validation
- `phases-and-the-master-plan-are-mostly-invisible-to-the-user.md` — surface current phase in status page
- `executor-panel-live-feedback.md` — Fixes 2+3: step name display + token count (heartbeat already shipped)

---

## Phase 5 — Cascade STEAM Production & Feature Bundles

**Gate:** Phase 4 must close before Phase 5 begins. Cascade STEAM going live
on the public internet requires mode enforcement (4a), lifecycle gates (4c),
and ACL integration (4f) all complete.

| Work | Plan/Proposal | Priority |
|------|-------------|---------|
| Phase 5 plan execution | [[plans/phase-5-cascade-steam.md]] | High |
| Chat & Session Panel Phase 2 | [[plans/bundle-chat-session-panel.md]] | High (in-progress) |
| AI Capabilities Bundle | [[proposals/bundle-ai-capabilities.md]] | Medium |
| `org-operations` profile full implementation | Phase 5 plan | High |
| `knowledge-base` profile full implementation | Phase 5 plan | Medium |
| AI Task Category Taxonomy Steps 3–4 | [[plans/ai-task-category-taxonomy.md]] | Medium |
| Enterprise Tier Bundle | [[proposals/bundle-enterprise-tier.md]] | Medium |
| UI Polish Bundle (Phase 4 polish) | [[proposals/plan-ui-polish-bundle-panels-tags-navigation-wikilinks-and-deferred-polish.md]] | Low |

**Note on `plan-steps-structured-frontmatter.md`:** YAML steps as source of
truth is a structural change that affects every plan. This must be carefully
timed — either early Phase 4 (before anything builds on current step format)
or explicitly deferred to Phase 5. Do not start it mid-phase.

---

## Phase 6 — Enterprise, Distribution & Public Release

| Work | Notes |
|------|-------|
| Kubernetes/Helm deployment | Docker compose sufficient until scale demands it |
| Remote registry sync | Privacy/trust design complexity; post-v1 |
| VSCodium extension | After Web UI validated by real users in Phase 5 |
| Distribution, documentation site, demo GIFs | After alpha validated |
| Second maintainer onboarded | Required gate before public release |
| Windows + macOS CI validation | After alpha |

---

## Post-Alpha (Deliberately Deferred)

These are well-scoped and genuinely useful but do not start until the Web UI
has been validated by non-developer governance users in production.

| Work | Why deferred |
|------|-------------|
| `offline-pwa-support.md` | Edit conflict resolution with git is non-trivial |
| `gantt-view-dependencies.md` | Awaiting wider `depends_on` + `estimated_effort` adoption |
| `mobile-wysiwyg-editing.md` | iOS contenteditable reliability |
| `kubernetes-deployment.md` | Docker compose sufficient until scale demands it |
| `ui-white-label-brand-settings.md` | Needs settings panel architecture first |
| `remote-registry-sync.md` | Privacy/trust design complexity |
| Phase B — Shared Team Daemon | After Phase 6 |
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
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6
                                          │
                           4a (mode enforcement)
                                │
                           4b (profile engine)
                                │
                     ┌──────────┤
                     │          │
                  4c (lifecycle  4e (wikilink index)
                   gates Ph2)        │
                     │          4f (ACL)
                  4d (judgment       │
                   atom mode)   4g (research AI)
```

Small fixes and contribution pipeline (4i) have no phase dependencies.
