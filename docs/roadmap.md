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

## Phase 3 — Vault Write API, Portability & Real-World Pilots (Current)

**Plan:** [[plans/phase-vault-portability-pilot.md]] · 8/11 steps done

**Thesis:** DocWright can be adopted by a real organization on an existing vault
with no manual file edits, no stale references, and no one-off repair scripts.

**Gate:** Phase 3 closes when the vault write API is complete, both pilot vaults
complete a full proposal→plan→completed cycle with no broken `_path:` fields or
stale wikilinks, and a dogfooding cycle captures any remaining friction.

### 3a — Vault Write API ⚡ (must land before pilots run)

**Why first and why now:** Every lifecycle transition that moves a file —
approving a proposal, completing a plan, renaming a document — currently leaves
stale `_path:` frontmatter and broken wikilinks. `fix-stale-approvals.ts` and
`backfill-proposal-source.ts` exist because this API does not. The pilots will
produce broken data without it. This is the right phase because the problem is
already present.

Deliverables:
- `moveDocument(src, dest)` — move file, update `_path:` frontmatter, update all
  wikilink references across the vault pointing to the old path
- `renameDocument(path, newName)` — rename in-place with the same backlink integrity
- `setField(path, field, value)` — promoted to THE canonical frontmatter write path;
  all MCP tools and Web UI routes call this, no direct `fs.writeFile` on doc paths
- `scripts/backfill-proposal-source.ts` is the last one-off repair script; all
  future operations use the API

**Implementation note:** backlink update at move time does a targeted grep scan
across the vault — O(n) but infrequent. Does not require a prebuilt index. The
full wikilink index (Phase 5) improves performance; correctness works without it.

### 3b — MSP Pilot Vault ⚡

[[proposals/sub-plan-msp-pilot-vault.md]] — **unapproved, approve first**

### 3c — Cascade STEAM Early-Access Pilot ⚡

[[proposals/sub-plan-cascade-steam-early-access.md]] — **unapproved, approve second**

Both pilots must complete one full proposal→plan→completed cycle through DocWright
with no manual file edits and no stale `_path:` fields. The vault write API (3a)
makes that bar achievable.

### 3d — Dogfooding Cycle

Use DocWright to manage DocWright's own Phase 3 closure work via Web UI and MCP
tools. Capture friction via `log_friction()` and file proposals before Phase 4
starts. This is the only reliable way to surface missing features before they
become blockers for external adopters.

---

### 🔀 Cascade STEAM Production Deployment (parallel track, starts when Phase 3 closes)

Cascade STEAM org work: Forgejo server, DNS/TLS, AI stack, governance loop with
real users. Not gated by Phase 4 or 5; the one DocWright prerequisite is ACL
integration (Phase 5, step 5c), which enables Forgejo team membership enforcement.
This is the reference implementation.

---

## Phase 4 — Query Foundation, Perception & Governance Enforcement

**Gate:** Phase 3 must close before Phase 4 begins.

**Thesis:** After Phase 4 you can *see* the structure of your vault (knowledge
graph), *query* it efficiently (document index), and *trust* that all governance
rules are mechanically enforced. Perception and enforcement arrive together.

Phase 4 has **two parallel chains** that converge at the phase gate. Chain A
(query + graph) moves fast — days not weeks. Chain B (governance enforcement)
is the larger work.

### Chain A — Query Foundation & Knowledge Graph

#### 4a — Vault Query API ⚡ (Chain A, step 1)

In-memory document index built from frontmatter on startup and refreshed by SSE
file-change events. No external database — git is still the canonical store.

Delivers:
- Index keyed by path, type, status, phase, tags, `related_to`, `proposal_source`,
  `depends_on`, `consumed_by`
- Query methods: `byType`, `byStatus`, `byPhase`, `byTags`, `getEdges(path)`
- `/api/graph` endpoint — nodes + edges for the knowledge graph
- Deduplication query at proposal creation (replaces raw file scan in 5e)

#### 4b — Basic Knowledge Graph (Chain A, step 2)

[[proposals/knowledge-graph-cross-document-idea-linkage.md]] Part C (basic)

Depends on 4a. KG Parts A+B already done — data quality sufficient for a useful
graph today.

Edges from frontmatter: `proposal_source`, `related_to`, `depends_on`,
`consumed_by`, `linked_proposals`. Force-directed D3.js graph as the 4th status
tab (alongside List, Funnel, Audit).

Gap detection overlays visible immediately:
- Orphaned plans (no `proposal_source:`)
- Concluded research with no follow-through (`linked_proposals: []`)
- Approved proposals with no investigation
- Dependency roadblocks (depends_on a canceled/deferred plan)
- Phase orphans (active plans with no `phase:`)

**Note:** wikilink body-text edges are added in Phase 5 (step 5a) when the full
wikilink index ships. The basic graph is useful without them.

---

### Chain B — Governance Enforcement

#### 4c — Execution Mode Enforcement ⚡ (Chain B, step 1)

`plan-execution-mode-rename.md` (partial — linter done, migration done)

Now sits cleanly on top of the vault write API (3a): the write intercept layer
intercepts calls to `setField`/`moveDocument`/`renameDocument` and routes them
based on the active plan's `mode:`. Without 3a, enforcement would be patchy
(Web UI only). With 3a, it applies to every surface.

Remaining work:
- Web UI mode badge (properties pane + document header)
- Write intercept: mentor → staging panel; guided → review queue; autonomous →
  direct write + `ai-last-action:` stamp
- AI preamble injection per mode on plan open
- Update `AGENTS.md` and all profile templates

#### 4d — Profile Engine Full Runtime ⚡ (Chain B, step 2)

Depends on 4c. Schema migration, template resolution, UI profile switching.
Unlocks 4e and all profile-aware Phase 5 features.

#### 4e — Lifecycle Gates Phase 2 ⚡ (Chain B, step 3)

[[plans/bundle-lifecycle-gates-phase-2.md]]

Depends on 4d. AI-assisted gate preparation, multi-reviewer quorum, retroactive
audit, time-based/scheduled triggers, governance audit JSONL log. Cascade STEAM
going production requires this — shipping without it is the governance equivalent
of deploying without auth.

---

## Phase 5 — Full Wikilink Index & Profile-Aware Features

**Gate:** Phase 4 (all of Chain A + Chain B) must close before Phase 5 begins.

**Thesis:** The vault query layer gets its richest data source (body text
wikilinks), and the features that depend on profile-aware queries ship. The
knowledge graph becomes significantly more revealing when wikilink edges land.

### 5a — Full Wikilink Index ⚡ (enriches everything downstream)

Body text `[[wikilinks]]` indexed as graph edges. Makes the knowledge graph (4b)
reveal organic idea connections that frontmatter alone cannot. Enables backlink
panels, autocomplete, and safe rename-with-backlink-update validation.

Previously called "Vault-Wide Wikilink Index." The vault write API (3a) already
handles correctness at move time; this index adds performance and completeness.

### 5b — Judgment Atom Mode Interaction

[[proposals/deferred-judgment-atom-mode-interaction.md]]

Depends on 4e (lifecycle gates Phase 2 creates the MCP gate call sites). Makes
`evaluateJudgmentAtom()` results advisory/staged/blocking based on plan `mode:`.

### 5c — Forgejo ACL Integration

Depends on 4d (profile engine) for `author-role:` resolution against Forgejo team
membership. When this lands, the Cascade STEAM production parallel track can
fully close.

### 5d — Research AI Tooling + RLM Microservice

Depends on 4d (profile engine) for context injection.

- AI-assisted research sessions
- Research → proposal generation
- Multi-perspective research (parallel model review)
- **RLM Python microservice** [[proposals/deferred-rlm-python-microservice.md]] —
  ~50-line Python wrapper around `rlms`, OpenAI-compatible endpoint.
  **Pending ai-stack GPU fix** (`qwen2.5-coder:14b` minimum; remote NVIDIA GPU
  currently broken). Ships when that fix lands. Until then: apply the RLM pattern
  manually (scan index first, fetch targeted docs, then analyze).

### 5e — New Proposal UX & Deduplication

- `new-proposals-should-check-before-actual-creation.md` — dedup query now uses
  vault query API (4a, already done); profile engine (4d) needed for type-aware scan
- `new-proposal-ux-description-priority-and-immediate-view.md` — description +
  priority first, AI generates title

### 5f — Contribution Pipeline

`sub-plan-contribution-pipeline.md` — `contribute_upstream()` MCP tool,
`log_friction()`, `list_docwright_issues`. No phase dependency — runs in parallel
with all of Phase 5.

### 5g — Graph Views & Executor Panel Polish

- Knowledge graph enriched with wikilink edges (from 5a)
- `plan-ui-lifecycle-graph-view.md` — lifecycle funnel/swimlane view; shares D3
  install with knowledge graph
- `formalize-step-counter-sync.md` — auto-sync step counter validation
- `phases-and-the-master-plan-are-mostly-invisible-to-the-user.md` — surface
  current phase in status page
- `executor-panel-live-feedback.md` — step name display + token count

### 🔀 Chat & Session Panel Phase 2 (parallel track)

[[plans/bundle-chat-session-panel.md]] — in progress, no phase dependency.
Closes before Phase 6 gate.

---

## Phase 6 — Feature Bundles & UI Polish

**Gate:** Phase 5 must close; Cascade STEAM production must be live.

**Thesis:** The system is deployed and validated by real users. Features are
driven by observed friction, not speculation.

| Work | Plan/Proposal | Priority |
|------|-------------|---------|
| AI Capabilities Bundle | [[proposals/bundle-ai-capabilities.md]] | Medium |
| `org-operations` profile full implementation | Phase 6 plan | High |
| `knowledge-base` profile full implementation | Phase 6 plan | Medium |
| AI Task Category Taxonomy Steps 3–4 | [[plans/ai-task-category-taxonomy.md]] | Medium |
| Enterprise Tier Bundle | [[proposals/bundle-enterprise-tier.md]] | Medium |
| UI Polish cycle | [[proposals/plan-ui-polish-bundle-panels-tags-navigation-wikilinks-and-deferred-polish.md]] | Low — needs real user feedback first |

**Decision required before Phase 6 starts — `plan-steps-structured-frontmatter.md`:**
YAML steps as source of truth is a breaking structural change affecting every plan.
Decide: land in Phase 5 (before anything builds on current step format) or defer
to Phase 6. **A decision, not a note.**

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
| KG Foundation Part A ✅ | XS | `proposal_source:` linter warn on active plans missing the field |
| KG Foundation Part B ✅ | XS | `related_to:` linter warn on approved proposals with empty links |

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
Phase 3
  3a (vault write API) ──→ 3b (MSP pilot) ──→ 3c (STEAM pilot) ──→ 3d (dogfooding)
  │
  ├──→ 🔀 Cascade STEAM production [waits for Phase 5 step 5c ACL]
  │
Phase 4 — two parallel chains, both must close before Phase 5
  │
  Chain A (fast):
  4a (vault query API) ──→ 4b (basic knowledge graph)
  │
  Chain B (governance enforcement):
  4c (mode enforcement) ──→ 4d (profile engine) ──→ 4e (lifecycle gates)
  │
Phase 5 — largely parallel after Phase 4
  ├── 5a (full wikilink index) ──→ enriches 4b graph in 5g
  ├── 5b (judgment atom mode)    [needs 4e]
  ├── 5c (Forgejo ACL)           [needs 4d] ──→ closes STEAM production track
  ├── 5d (research AI + RLM*)    [needs 4d + ai-stack GPU fix]
  ├── 5e (proposal UX + dedup)   [needs 4a ✓, 4d for full features]
  ├── 5f (contribution pipeline) [independent]
  └── 5g (graph polish)          [needs 5a]
  │
  🔀 Chat & Session Panel Ph2    [no phase dependency — closes here]
  │
Phase 6 (feature bundles — real user feedback required)
  │
Phase 7 (public release)

* RLM: [[proposals/deferred-rlm-python-microservice.md]]
  Pending ai-stack GPU fix. Policy atom pre-condition met (v0.3.x).
```

Small fixes and 5f (contribution pipeline) have no phase dependencies.
