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

## Phase 3 — Vault Foundation, Perception & Real-World Pilots (Current)

**Plan:** [[plans/phase-3-vault-foundation.md]] · 8/11 steps done

**Thesis:** DocWright can be adopted by a real organization on an existing vault
with accurate references, no repair scripts, and a graph that shows you what you
cannot yet see.

**Gate:** Phase 3 closes when the vault write API and document index are complete,
the knowledge graph is live and accurate, both pilot vaults complete a full
proposal→plan→completed cycle with no broken `_path:` fields, and the dogfooding
cycle captures any remaining friction.

### 3a — Vault Write API ⚡ (must land first)

**Why first and why now:** Every lifecycle transition that moves a file —
approving a proposal, completing a plan, renaming a document — currently leaves
stale `_path:` frontmatter and broken wikilinks. `fix-stale-approvals.ts` and
`backfill-proposal-source.ts` exist because this API does not. The pilots will
produce broken data without it.

Deliverables:
- `moveDocument(src, dest)` — move file, update `_path:` frontmatter, update all
  wikilink references across the vault pointing to the old path
- `renameDocument(path, newName)` — rename in-place with the same backlink integrity
- `setField(path, field, value)` — promoted to THE canonical frontmatter write path;
  all MCP tools and Web UI routes call this, no direct `fs.writeFile` on doc paths
- `scripts/backfill-proposal-source.ts` is the last one-off repair script; all
  future operations use the API

### 3b — Vault Document Index ⚡ (must land before knowledge graph)

**Why unified and why here:** Frontmatter relationships and body-text wikilinks are
not two separate concerns — they are both edges in the same graph. Splitting them
(frontmatter now, wikilinks later as "enrichment") would produce a graph that
reflects how carefully frontmatter was filled in, not how you actually think.
The index is built once and accurate from day one.

Deliverables:
- In-memory index built from full document scan on startup, refreshed via SSE
  file-change events. No external database — git is still the canonical store.
- **Frontmatter edges:** `proposal_source`, `related_to`, `depends_on`,
  `consumed_by`, `linked_proposals` — indexed from frontmatter
- **Wikilink edges:** `[[path]]` references in document bodies — parsed via the
  existing `src/dispatch/wikilinks.ts` and added to the same edge set
- Query API: `byType`, `byStatus`, `byPhase`, `byTags`, `getEdges(path)`
- `/api/graph` endpoint returning `{ nodes, edges }` for the knowledge graph
- `/api/vault/query` endpoint for deduplication and profile-aware searches

### 3c — Knowledge Graph ⚡ (must land before pilots run)

[[proposals/approved/knowledge-graph-cross-document-idea-linkage.md]] Part C

**Why here:** The knowledge graph is an oversight and direction tool, not a
feature. It shows structural failures before they compound — orphaned plans,
dead-end research, blocked dependency chains, missed connections between ideas
in the same thematic cluster. Running the pilots without it means navigating
blind. Running it without wikilink edges (as a "basic preview") means trusting
frontmatter hygiene over actual thinking. Neither is acceptable.

Depends on 3b. KG Parts A+B already done — data quality is sufficient.

Delivers:
- Force-directed D3.js graph as the 4th status tab (alongside List, Funnel, Audit)
- Nodes: proposals, plans, research docs, policy atoms — colour by type, size by
  urgency (approved-not-started = prominent)
- Edges: all types from 3b index — frontmatter AND wikilink edges together
- Gap detection overlays:
  - Orphaned plans (no `proposal_source:`)
  - Concluded research with no follow-through
  - Approved proposals with no investigation
  - Dependency roadblocks (depends_on a canceled/deferred plan)
  - Phase orphans (active plans with no `phase:`)
  - Thematic orphans (shared tags, no link)
- Click to navigate; hover for frontmatter summary

### 3d — MSP Pilot Vault ⚡

[[proposals/sub-plan-msp-pilot-vault.md]] — **unapproved, approve first**

### 3e — Cascade STEAM Early-Access Pilot ⚡

[[proposals/sub-plan-cascade-steam-early-access.md]] — **unapproved, approve second**

Both pilots must complete one full proposal→plan→completed cycle with no manual
file edits and no stale `_path:` fields. The write API (3a) makes that bar
achievable. The knowledge graph (3c) makes the pilot work visible in real time.

### 3f — Dogfooding Cycle

Use DocWright to manage DocWright's own Phase 3 closure work via Web UI and MCP
tools. Capture friction via `log_friction()` and file proposals before Phase 4
starts.

---

### 🔀 Cascade STEAM Production Deployment (parallel track, starts when Phase 3 closes)

Cascade STEAM org work: Forgejo server, DNS/TLS, AI stack, governance loop with
real users. Not gated by Phase 4; the one DocWright prerequisite is ACL
integration (Phase 5, step 5c). This is the reference implementation.

---

## Phase 4 — Governance Enforcement

**Gate:** Phase 3 must close before Phase 4 begins.

**Thesis:** After Phase 4, all governance rules are mechanically enforced. AI
agents are mode-constrained, profiles are fully runtime, and lifecycle gates
enforce multi-reviewer quorum and scheduled triggers. The vault already has
referential integrity (Phase 3) and perception (Phase 3); Phase 4 adds control.

Phase 4 has a strict serial order — each item unlocks the next.

### 4a — Execution Mode Enforcement ⚡

`plan-execution-mode-rename.md` (partial — linter done, migration done)

Sits on top of the vault write API (3a): the write intercept layer routes calls
to `setField`/`moveDocument`/`renameDocument` based on the active plan's `mode:`.
Enforcement applies to every surface, not just the Web UI.

Remaining work:
- Web UI mode badge (properties pane + document header)
- Write intercept: mentor → staging panel; guided → review queue; autonomous →
  direct write + `ai-last-action:` stamp
- AI preamble injection per mode on plan open
- Update `AGENTS.md` and all profile templates

### 4b — Profile Engine Full Runtime ⚡

Depends on 4a. Schema migration, template resolution, UI profile switching.
Unlocks 4c and all profile-aware Phase 5 features.

### 4c — Lifecycle Gates Phase 2 ⚡

[[plans/lifecycle-gates.md]]

Depends on 4b. AI-assisted gate preparation, multi-reviewer quorum, retroactive
audit, time-based/scheduled triggers, governance audit JSONL log. Required before
Cascade STEAM goes production.

---

## Phase 5 — Profile-Aware Features

**Gate:** Phase 4 must close before Phase 5 begins.

**Thesis:** Features that depend on profile-aware queries and governance
enforcement ship. The knowledge graph gains additional polish and filter
improvements as real usage reveals what matters.

### 5a — Judgment Atom Mode Interaction

[[proposals/deferred-judgment-atom-mode-interaction.md]]

Depends on 4c (lifecycle gates Phase 2 creates the MCP gate call sites). Makes
`evaluateJudgmentAtom()` results advisory/staged/blocking based on plan `mode:`.

### 5b — Forgejo ACL Integration

Depends on 4b (profile engine) for `author-role:` resolution against Forgejo team
membership. When this lands, the Cascade STEAM production parallel track can
fully close.

### 5c — Research AI Tooling + RLM Microservice

Depends on 4b (profile engine) for context injection.

- AI-assisted research sessions
- Research → proposal generation
- Multi-perspective research (parallel model review)
- **RLM Python microservice** [[proposals/deferred-rlm-python-microservice.md]] —
  ~50-line Python wrapper around `rlms`, OpenAI-compatible endpoint.
  **Pending ai-stack GPU fix** (`qwen2.5-coder:14b` minimum; remote NVIDIA GPU
  currently broken). Ships when that fix lands. Until then: apply the RLM pattern
  manually (scan index first, fetch targeted docs, then analyze).

### 5d — New Proposal UX & Deduplication

- `new-proposals-should-check-before-actual-creation.md` — dedup query uses the
  vault document index (3b, in place by Phase 4); profile engine (4b) needed for
  full type-aware scan
- `new-proposal-ux-description-priority-and-immediate-view.md` — description +
  priority first, AI generates title

### 5e — Contribution Pipeline

`contribution-pipeline.md` — `contribute_upstream()` MCP tool,
`log_friction()`, `list_docwright_issues`. No phase dependency — runs in parallel
with all of Phase 5.

### 5f — Graph Polish & Executor Panel

- Knowledge graph filter improvements and additional overlays driven by real usage
  observations from Phase 3 onward
- `lifecycle-graph.md` — lifecycle funnel/swimlane view; shares D3
  install with knowledge graph
- `formalize-step-counter-sync.md` — auto-sync step counter validation
- `phases-and-the-master-plan-are-mostly-invisible-to-the-user.md` — surface
  current phase in status page
- `executor-panel-live-feedback.md` — step name display + token count

### 🔀 Chat & Session Panel Phase 2 (parallel track)

[[plans/chat-session-panel.md]] — in progress, no phase dependency.
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
| AI Task Category Taxonomy Steps 3–4 | [[plans/ai-model-routing.md]] | Medium |
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
| `deferred-watcher-presence-indicator.md` | S | **Elevated from Small Fix** — show watcher/executor presence badge; recurring user confusion when executor runs silently |
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
Phase 3 (foundation + perception + pilots)
  3a (vault write API)
    ──→ 3b (vault document index — frontmatter + wikilink edges, unified)
          ──→ 3c (knowledge graph — accurate from day one)
  3a, 3b, 3c ──→ 3d (MSP pilot) ──→ 3e (STEAM pilot) ──→ 3f (dogfooding)
  │
  ├──→ 🔀 Cascade STEAM production [waits for Phase 5 step 5b ACL]

Phase 4 (governance enforcement — serial)
  4a (mode enforcement) ──→ 4b (profile engine) ──→ 4c (lifecycle gates)

Phase 5 (profile-aware features — largely parallel after Phase 4)
  ├── 5a (judgment atom mode)    [needs 4c]
  ├── 5b (Forgejo ACL)           [needs 4b] ──→ closes STEAM production track
  ├── 5c (research AI + RLM*)    [needs 4b + ai-stack GPU fix]
  ├── 5d (proposal UX + dedup)   [needs 3b ✓, 4b for full features]
  ├── 5e (contribution pipeline) [independent]
  └── 5f (graph polish)          [driven by real usage of 3c]
  │
  🔀 Chat & Session Panel Ph2    [no phase dependency — closes here]

Phase 6 (feature bundles — real user feedback required)
Phase 7 (public release)

* RLM: [[proposals/deferred-rlm-python-microservice.md]]
  Pending ai-stack GPU fix. Policy atom pre-condition met (v0.3.x).
```

Small fixes and 5e (contribution pipeline) have no phase dependencies.
