# SESSION-LOG.md — DocWright Session Log

Session log entries for the docwright project. Each session produces a detailed note
in `docs/session-notes/`; this file is a chronological index.

---

## Session: 2026-06-02 — Web UI SSE Live Reload

**Focus:** Wire SSE live reload for SvelteKit Web UI — file tree auto-refresh and
page auto-reload on file changes from any source (external editor, git, etc.)

**Completed:**
- [x] Created `/api/watch` SSE endpoint with `fs.watch` recursive
- [x] Created shared `fileChanged` Svelte writable store
- [x] Connected layout `EventSource`, pushes events into store
- [x] FileTree auto-refreshes on any file change (debounced 200ms)
- [x] Page auto-reloads content on matching file change (skips during edit mode)
- [x] Verified SSE emits `open` + `filechange` events via cURL
- [x] Clean production build

**Session note:** `docs/session-notes/session_note_202606020751.md`

---

## Session: 2026-06-03 — UI Panes refactor, all plans completed

**Focus:** Complete remaining plans, refactor sidebar and properties pane UX

**Completed:**
- [x] All 13 plans moved to `plans/completed/` — zero active plans
- [x] Sidebar: desktop inline flex layout + 32px collapsed strip with hover peek; mobile fixed overlay
- [x] Properties pane: desktop inline flex item; mobile fixed right-side overlay
- [x] Toggle state: desktop uses local state, mobile uses shared store — no double-toggle
- [x] Sidebar scrim only on mobile (CSS guard)
- [x] Removed fragile `padding-right` layout hack
- [x] Added home icon to sidebar and mobile top bar
- [x] Added gear icon for properties pane on mobile
- [x] Added close button for sidebar on mobile

**Session note:** `docs/session-notes/session_note_202606031342.md`

---

## Session: 2026-05-30 (session 3) — cspve2: 4 auto-install attempts

**Focus:** PVE 9.1 auto-install via CIFS-mounted ISO on cspve2

See separate SESSION-LOG for full entry (cross-repo session on bms-ai-cluster).

---

## Session: 2026-05-30 (session 2) — CS plan activation

**Focus:** Cascade STEAM proposal lifecycle, cspve2 PVE install planning

See separate SESSION-LOG for full entry (cross-repo session on bms-ai-cluster).

---

## Session: 2026-05-31 — Phase 0 spike + Web UI prototype

**Focus:** Validate `opencode serve` HTTP API, build SvelteKit Web UI prototype

**Completed:**
- [x] Confirmed `opencode serve` v1.15.13 HTTP API is stable
- [x] JS SDK works for session create, message send, stream
- [x] SPA embed via iframe in VSCodium WebView confirmed working (approach 1)
- [x] Approach 2 (fetch+inject DOM) and approach 3 (SDK-only) both failed
- [x] Decision recorded: go with iframe SPA embed
- [x] SvelteKit Web UI scaffolded with dark theme layout, collapsible file tree
- [x] Markdown rendering with markdown-it (TOC anchors, external link targets)
- [x] Wikilink parsing: `[[path.md]]`, `[[path.md#section]]`, `[[path.md|alias]]`
- [x] CRUD operations: create, edit, save, delete
- [x] API endpoints: GET/POST/DELETE for file operations
- [x] Web UI polish proposal created

**Session notes:** Commits c7d8b4c through 0733dcd

---

## Session: 2026-06-04 — Chat fix, lifecycle enforcement, proposal critiques

**Focus:** Chat debugging, lifecycle enforcement, proposal critique

**Completed:**
- [x] Chat panel hanging analyzed — fixes already in HEAD from prior session
- [x] Session shutdown automation proposal → plan (proper lifecycle this time)
- [x] Critiqued plan-test-certification proposal (7 findings)
- [x] Critiqued and revised plan-step-completion-enforcement (replaced emoji heuristic, eliminated Phase 3 deferral)

**Session note:** `docs/session-notes/session_note_202606040212.md`

---

## Session: 2026-06-04 — Governance enforcement, testing standards, shutdown

**Focus:** AI governance boundaries, plan test certification, critique skill, versioning

**Completed:**
- [x] AI governance boundaries policy + hook enforcement (no self-completion, gate required)
- [x] `/critique-plan` skill shipped and run on all Phase 1 + Phase 2 plans (v0.1.2)
- [x] Plan step enforcement hook implemented — 12 tests passing (v0.1.3)
- [x] Automatic versioning: 0.MINOR.PATCH auto-bumped by hook on plan completion
- [x] Plan test certification: 4 design cycles → honest simplified design approved
- [x] Session shutdown automation plan created (Ultraplan refining)
- [x] Phase 1 UI Polish completed (v0.1.1), Phase 1 Critique Skill completed (v0.1.2)

**Session note:** `docs/session-notes/session_note_202606040300.md`

---

## Session: 2026-06-05 — Plan population + Tests section

**Focus:** Populate proposal-relationship-engine plan with implementation steps and tests

**Completed:**
- [x] Combined 3 overlapping proposals into one unified proposal
- [x] Deleted old raw proposals (doc-automations, hierarchy-position, making-plans-scans)
- [x] Populated plan with 12 implementation steps across 4 parts
- [x] Added Tests section with checkboxes grouped by component
- [x] Updated docwright-raw-proposal skill and CLAUDE.md skills reference

**Session note:** `docs/session-notes/session_note_202606051526.md`

---

## Session: 2026-06-05 — Split-agent governance critique and revision

**Focus:** Adversarial critique and full revision of split-agent-governance proposal

**Completed:**
- [x] Added org-ceiling model: `cloud_allowed_for` (opencode.json) + `cloud_accepted_for` (.docwright/config.json)
- [x] Secrets absolute override — no cloud path for secrets regardless of profile
- [x] Node trust classification: `internal|external` on Meshy nodes; untagged defaults external
- [x] AI critique role and review duality added to Human Augmentation Principles
- [x] Multi-user document-base established as baseline architectural assumption
- [x] Automation agent and secrets manager captured as deferred proposals
- [x] Full adversarial critique — 7 categories of findings identified
- [x] Proposal revised: Current State table, honest phase labels, 14 Phase 1 deliverables
- [x] All 3 outstanding critique findings annotated (OG2, AP4, SR3)
- [x] Proposal ready for NetYeti approval

**Session note:** `docs/session-notes/session_note_202606052300.md`

---

## Session: 2026-06-05 — Rename endsession skill

**Focus:** Skill rename: docwright-shutdown → endsession

**Completed:**
- [x] Renamed `.opencode/skills/docwright-shutdown/` → `.opencode/skills/endsession/`
- [x] Updated SKILL.md frontmatter name and triggers
- [x] Updated CLAUDE.md skills table

**Session note:** `docs/session-notes/session_note_202606052330.md`

---

## Session: 2026-06-05 — Raw proposal drafting

**Focus:** Detect and draft raw proposals via docwright-raw-proposal skill

**Completed:**
- [x] Scanned all 61 proposals for rawness — 2 found
- [x] Drafted `policies-should-be-a-button-on-the-leftmost-button-bar.md` with full structure
- [x] `misc.md` confirmed as intentional inbox — left for collation feature

**Session note:** `docs/session-notes/session_note_202606051928.md`

---

## Session: 2026-06-06 — Startup script overhaul + raw proposal scan

**Focus:** Fix Vite 404, rewrite DocWright launcher, scan raw proposals

**Completed:**
- [x] Diagnosed Vite 404 — root cause: running from repo root instead of `src/webui/`
- [x] Rewrote `~/.local/bin/DocWright` — background services, auto CORS, preflight checks, log files, session resume hints
- [x] Raw proposal scan (docwright-raw-proposal skill) — 57 proposals scanned, 1 genuinely raw found
- [x] Drafted `policies-should-be-a-button-on-the-leftmost-button-bar.md` for review

**Session note:** `docs/session-notes/session_note_202606060030.md`

---

## Session: 2026-06-06 — Phase 1 closure, Docker, CI fix, Phase 2 planning

**Focus:** Phase 1 close-out, containerization, v0.1.3, plan bundle proposals

**Completed:**
- [x] Closed phase-1-containerization — Dockerfile, compose, health endpoint, CI job, live tested
- [x] Closed phase-1-plan-step-enforcement — all 21 steps verified, gate waived
- [x] Fixed Node 22 CI failure — ts-node/register → tsx/cjs for dispatch tests
- [x] Tagged v0.1.3 and pushed; CI passed, Docker image on ghcr.io
- [x] DocWright launcher: added --docker mode, reads .env automatically
- [x] .env.example committed; .env.* added to .gitignore pattern
- [x] dw-mcp wired into Claude Code via .mcp.json
- [x] Surveyed 45 unapproved proposals; identified 3 plan bundles
- [x] Drafted and committed Phase 2 UI Polish Bundle proposal (7 deliverables)
- [x] Proposal approved by NetYeti; plan file auto-generated (untracked)

**Session note:** `docs/session-notes/session_note_202606061400.md`

---

## Session: 2026-06-06 — Phase 2 UI Polish + Lifecycle UX Overhaul

**Focus:** UI polish bundle shipped, theming fixed, lifecycle UX made fully Web UI-operable

**Completed:**
- [x] Phase 2 UI Polish Bundle — 7 deliverables shipped (search, policies, phase card, tags, panels, shortcuts, theme)
- [x] Full SCSS migration across all components + `_tokens.scss` design token system
- [x] Theming root cause found: `brand/theme.css` had `!important` blocking all cascade work
- [x] CSS variables moved to `app.html`; `:global()` pattern established for component overrides
- [x] Web UI commits now carry `HUMAN_APPROVED=1` — shell no longer required for lifecycle
- [x] `Certify tests` button added — saves immediately like Approve
- [x] `Complete` button now fully archives plan + generates doc + redirects to /status
- [x] `Run Tests` gates the Complete button — must pass before Complete appears
- [x] Step changes reset `tests_defined: false` automatically (MCP + Web UI)
- [x] lifecycle-gates-extension-bundle: tests written, all 90 passing
- [x] automated-test-lifecycle proposal captured
- [x] v0.2.1 tagged and pushed

**Session note:** `docs/session-notes/session_note_202606062200.md`

---

## Session: 2026-06-06 — Cross-Tool Compat, Proposals, One-Off Policy

**Focus:** Cross-tool AI compatibility, raw proposal drafting, one-off formalization meta-policy

**Completed:**
- [x] Cross-tool compatibility plan — skills sync, agent roles spec, 10 compat tests, CI-gated
- [x] `scripts/sync-claude-skills.ts` + `npm run sync:skills` — CLAUDE.md table auto-generated
- [x] `docs/specs/skill-format.md` + `docs/specs/agent-roles.md` — canonical specs
- [x] `.opencode/rules/governance-writes.md` + `one-off-formalization.md` — OpenCode rules
- [x] One-off formalization policy wired into CLAUDE.md and opencode.json
- [x] Fix: Web UI proposal approval auto-triggers move to proposals/approved/
- [x] Fix: transition-completed now injects completed_date into archived plan
- [x] Batch-move 17 stale approved proposals to proposals/approved/ (git mv)
- [x] Raw proposals drafted: new-proposal-ux-description-priority, policies-button
- [x] Proposals captured: one-off-formalization, mcp-tool-batch-fix-stale-approvals

**Session note:** `docs/session-notes/session_note_202606062330.md`

---

## Session: 2026-06-06 — MemGraphRAG paper evaluation

**Focus:** Research — arxiv paper relevance to DocWright/Meshy

**Completed:**
- [x] Evaluated MemGraphRAG (arxiv 2606.00610v1) — three-layer memory, conflict detection agents, 10x faster than HippoRAG
- [x] Assessed relevance: knowledge-base profile + collation system (Phase 3+ bookmark); not relevant to Meshy

**Session note:** `docs/session-notes/session_note_202606062345.md`

---

## Session: 2026-06-07 — Governance cleanup, AI features, phase recalibration

**Focus:** Lifecycle flow fixes, AI review/improve, status page, PROJECT.md v0.9

**Completed:**
- [x] Fixed relationship engine — block-style YAML tags were silently dropped; collation now works
- [x] Repaired plan/proposal lifecycle flow gaps (Approve button, View Plan link, consumed_by, 409 handling)
- [x] Implemented AI Review (⚡) — adversarial critique on draft/approved plans via OpenCode
- [x] Implemented AI Improve (✨) — fillProposal/critiqueDocument, ImprovementPanel, on-save trigger
- [x] Fixed OpenCode API calls — correct v1.16 session create + message send format
- [x] Status page: priority sorting (critical→high→medium→low), dependency display, deferred table
- [x] PROJECT.md v0.9 — phases recalibrated to actual build order; Research stage added to hierarchy
- [x] Bulk cleanup: 36 orphaned approved proposals linked to completed plans; deferred list audited
- [x] Approved-pending status bug fixed (path normalization + consumed_by check)
- [x] DocWright launcher: OPENCODE_URL + DOCWRIGHT_ROOT exported before Vite
- [x] Plan action buttons: loading state + error toasts
- [x] New proposals: research-stage-methodology (critical), research-plan-execution-modes (high)
- [x] plan-bugs-features-and-thoughts: restored after accidental overwrite, properly filled (7 steps)
- [x] 126 dispatch tests passing

**Session note:** `docs/session-notes/session_note_202606071347.md`

---

## Session: 2026-06-07 — CI/CD build monitoring, tag policy, Web UI watch

**Focus:** Fix CI failures, enforce v0.x.x tag policy, automate build monitoring

**Completed:**
- [x] Fixed CI build failure — `__dirname` → `fileURLToPath(import.meta.url)` in cross-tool compat test
- [x] CI workflow narrowed to `push: tags: v0.*.*` and `workflow_dispatch` only
- [x] `v0.*.*` policy enforced at API layer (`/api/git/tag`), CI trigger, and watch scripts
- [x] `versioning.md` updated — CI trigger listed as required update in any major milestone release plan
- [x] Claude Code `PostToolUse` hook: `scripts/claude-tag-push-watch.sh` auto-watches CI after tag push
- [x] OpenCode behavioral rule: `.opencode/rules/ci-watch-on-tag-push.md`
- [x] `npm run release:tag` / `scripts/release-tag.sh` — code-enforced cross-tool path
- [x] Web UI: `/api/git/ci-watch` SSE endpoint streams live GitHub Actions status
- [x] `GitPanel.svelte` shows CI watch panel after tag push (waiting → running → green/red)
- [x] "release" bump type removed from GitPanel (would produce policy-violating v1.0.0)
- [x] Pre-existing TS2339 bug fixed in `watch/+server.ts`

**Session note:** `docs/session-notes/session_note_202606072100.md`

---

## Session: 2026-06-07 — Review button SSE streaming fix

**Focus:** Fix Review button tab switch and SSE streaming

**Completed:**
- [x] Root cause found: SSE parser checked `data.type` instead of `event:` field — all events silently dropped
- [x] Fixed tab switch: added `showReviewTab` store-signal + `$effect` watcher (matches `showImproveTab` pattern)
- [x] SSE streaming: server emits `event: status`/`event: token`/`event: done`; client parses by event name
- [x] 80-char chunks with 15ms inter-chunk delay for visible progressive streaming
- [x] AI prompt redesigned: produces `=== CHANGES ===` (numbered edits) and `=== IMPROVED PLAN ===` sections
- [x] PlanReviewPanel: streaming loading state (status + monospace text + blinking cursor + auto-scroll)
- [x] Accept rewrites plan file via `/api/write` with preserved frontmatter
- [x] Removed unused `onreview` prop from PropertiesPane binding
- [x] All 136 tests pass

**Session note:** `docs/session-notes/session_note_202606071558.md`

---

## Session: 2026-06-07 — Phase Gate Review System

**Focus:** Phase gate review UX, phase card display fixes, review button gating

**Completed:**
- [x] Phase gate review system: amber banner on status page when phase gated + plans unreviewed
- [x] 3-step review guide: open plan → mark reviewed → activate (or "already active ✓")
- [x] `/api/lifecycle/phase-review` POST endpoint — sets `phase_review_date` frontmatter
- [x] Fix: `currentPhase` now uses in-progress/approved phase overview plan (not max across all plans)
- [x] Fix: `phasePlans` filter uses `path.basename()` — excludes non-overview plans like `bundle-lifecycle-gates-phase-2.md`
- [x] "Done reviewing" button gated on `activeWorkCount === 0` (all open work in that phase must complete first)
- [x] Research Stage MVP: full 8-step implementation (linter, hook tests, integration tests, profiles, dispatch, UI, status page)

**Session note:** `docs/session-notes/session_note_202606072205.md`

---

## Session: 2026-06-08 — Improve SSE streaming, progress bar, FOSS files

**Focus:** Fix Improve button streaming, 4-stage progress meter, document history, FOSS hygiene

**Completed:**
- [x] Fixed `onimprove` undefined ReferenceError (missing `$props()` destructuring)
- [x] Fixed parallel OpenCode session hang — sequential improve/critique with 120s timeout
- [x] Rewrote Improve endpoint to SSE streaming with progressive 80-char token reveal
- [x] Built 4-stage progress meter (Improve → Stream → Critique → Complete) with checkmarks and pulsing dots
- [x] Added `appendDocHistory()` to write Document History entry on Accept
- [x] Created `/api/git/config` endpoint for user identity resolution
- [x] Added missing `$amber-bg` SCSS token (pre-existing build break)
- [x] Created `.github/CODEOWNERS` and `.github/dependabot.yml` (FOSS hygiene D6)
- [x] Updated phase-2-foundation.md: D6 done, gate checked, critical review resolved

**Session note:** `docs/session-notes/session_note_202606080403.md`

---

## Session: 2026-06-08 — Plan filling, review fix, approval UX

**Focus:** Fill bare template plans, fix Review button, improve approval→plan flow

**Completed:**
- [x] Fixed ⚡ Review button silent failure — wrong OpenCode endpoint `/prompt` → `/message`
- [x] PlanReviewPanel: show `Error:` text instead of "No review yet." on failure
- [x] Approval→plan UX: `?from=proposal` signal triggers auto-improve after plan loads
- [x] Filled bare template plans: bundle-chat-session-panel (17 steps), sub-plan-parent-tracking (9 steps), research-plan-execution-modes (5 steps)
- [x] Improved bundle-chat-session-panel: dispatch/opencode.ts adapter step, API shapes, Connection type, localStorage key, debounce values
- [x] Improved sub-plan-parent-tracking: data model section, 8-point regex algorithm, PropertiesPane "Part of" link, named test functions

**Session note:** `docs/session-notes/session_note_202606082310.md`

---

## Session: 2026-06-08 — Phase assignment, AI model picker, research steps 1-2

**Focus:** Plan phase assignment, AI model picker, Ollama cleanup, research stage

**Completed:**
- [x] Removed custom Ollama picker — OpenCode model selector covers this natively
- [x] AI model picker in toolbar: reads OpenCode /api/model (112 models), writes opencode.json
- [x] Fixed auto-improve: triggerImprovePending store pattern replaces broken SSE-as-JSON fetch
- [x] handleCreatePlan now navigates with ?from=proposal for auto-improve on new plans
- [x] CollationPanel scan UX: spinner, subtitle, clearer Create Plan CTA with bundle count
- [x] Plan phase assignment: dropdown, auto-assign on creation, linter warn, status page grouping
- [x] Backfilled phase: on all 8 unassigned plans
- [x] Research steps 1+2 (tool survey + naming): recommends mode: mentor | guided | autonomous
- [x] AbortSignal on all AI fetch calls — no more stuck review/improve UI
- [x] Version bumped to 0.2.4, tagged v0.2.4 pushed

**Session note:** `docs/session-notes/session_note_202606082345.md`

---

## Session: 2026-06-12 — Completed sub-plans and v0.3.1 bump

**Focus:** Completed sub-plans, TS MCP cut-over, plan review overhaul, v0.3.1 bump

**Completed:**
- [x] Completed and archived 7 sub-plans (TS MCP server, profile override merge, session start, phase close-out, next-action, sub-plan approval, plan-from-body)
- [x] Full cut-over from Python to TypeScript MCP server
- [x] Plan review UI: streaming micro-calls (step-review, section-review, overview) replacing single-prompt
- [x] Sub-plan auto-approval from parent plan PropertiesPane
- [x] Profile engine: vault-override merging with +prefix array append
- [x] Session start/end automation skills
- [x] Phase close-out procedure and script
- [x] Fixed unquoted colon YAML parsing bug in pre-commit hook
- [x] Bumped version to 0.3.1, committed and pushed

**Session note:** `docs/session-notes/session_note_202606121455.md`

---

## Session: 2026-06-12 — AI bundle complete, Olla GPU investigation

**Focus:** Steps 9-12 of AI Capabilities Bundle, Olla GPU debugging

**Completed:**
- [x] Step 9 — auto-certify + human-first-review gate
- [x] Step 10 — Perspective Synthesis panel and API endpoint
- [x] Step 11 — wire Perspective Synthesis into multi-review workflow
- [x] Step 12 — Model Voting aggregate summary (bundle complete, 12/12)
- [x] Modular AI Review complete (3/3, Olla-backed micro-calls)
- [x] Drafted Policy Atom Framework proposal and plan

**BLOCKER:** Olla Intel Arc GPU reports 0 VRAM — plan-review hangs. Inference requests to Docker ollama time out.

**Session note:** `docs/session-notes/session_note_202606130024.md`

---

## Session: 2026-06-13 — Plan review holistic path + step generation

**Focus:** Holistic plan review for no-steps plans

**Completed:**
- [x] Holistic review path in `/api/plan-review` when no Implementation Steps exist (analyze goal, suggest steps, gaps, preconditions)
- [x] Step generation in `/api/apply-review` from holistic analysis (inserts markdown table)
- [x] Review tab stays active after Apply when steps were generated (generatedSteps flag)
- [x] Touchscreen mode badge click handling fix (X/Y coords check)
- [x] Clean production build

**Session note:** `docs/session-notes/session_note_202606131435.md`

---

## Session: 2026-06-14 — Olla GPU routing fix

**Focus:** Olla GPU routing fix

**Completed:**
- [x] Identified Intel Arc crash root cause: 0 dedicated VRAM, 14B models swap → CPU fallback → thermal event
- [x] Fixed Olla routing: `least-connections` → `priority` load balancer, remote Nvidia priority 90, local Arc 70
- [x] Reduced local ollama Docker mem_limit from 32g to 8g
- [x] Updated opencode.jsonc to route through Olla (`openai/llama3.1:8b` at `http://100.123.141.125:40114/olla/ollama/v1`)
- [x] Created `docs/ai-inference-routing-research.md` with full findings
- [x] Updated `intel_nuc_skullcanyon_ollama_with_gpu` repo: tool-calling, memory optimization, Olla routing docs
- [x] Confirmed remote Nvidia inference: 0.6-1.2s vs local Arc 22-27s for llama3.1:8b

**Session note:** `docs/session-notes/session_note_202606141344.md`

---

## Session: 2026-06-14 — Phoenix Arc GPU acceleration

**Focus:** Phoenix Arc GPU acceleration + local AI reliability

**Completed:**
- [x] Verified SYCL dead-end on Meteor Lake Arc UMA (0 VRAM)
- [x] Tested native Ollama v0.30.7 + Vulkan on port 11435 — GPU detected with 23 GiB
- [x] qwen2.5:0.5b 25/25 layers on GPU, qwen2.5-coder:14b 26/49 layers on GPU
- [x] Installed permanent systemd service with OLLAMA_VULKAN=1 + OLLAMA_IGPU_ENABLE=1
- [x] Removed Docker ollama from docker-compose.arc.yml
- [x] Updated ai-stack docs and intel_nuc AGENT_ORCHESTRATION.md with Vulkan/iGPU path

**Session note:** `docs/session-notes/session_note_202606141900.md`

---

## Session: 2026-06-15 — Research infrastructure + RLM/TRM evaluation

**Focus:** Research infrastructure, RLM evaluation, architecture decisions

**Completed:**
- [x] Added `OllamaEngine` to route AI inference to remote NVIDIA via Meshy (carry-over from prior context)
- [x] Evaluated RLMs (arxiv MIT OASYS) — not a paradigm shift; Python microservice integration path identified
- [x] Evaluated TRM/Mamba-2 SSM (arxiv 2602.12078) — primarily ai-stack/Meshy relevance, not DocWright
- [x] Created `research/INDEX.md` and wired into `opencode.jsonc` instructions
- [x] Created `research/rlm-recursive-language-models.md` with full analysis + Related Work
- [x] Fixed pre-commit hook: `research/INDEX.md` excluded from research frontmatter validation
- [x] Added Emerging Architecture Watch to ai-stack `docs/models.md`
- [x] New rule: always read local docs first — never assume project state

**Session note:** `docs/session-notes/session_note_202606151500.md`

---

## Session: 2026-06-14 — Codebase quality sweep

**Focus:** Systematic improvement of code quality, correctness, and maintainability

**Completed:**
- [x] Broken compat test fixed — `sync:skills` run, `docwright-session-start` added to CLAUDE.md table
- [x] Hardcoded private IP (100.123.141.125) removed from 3 API routes; `OLLA_BASE`, `OLLA_MODEL`, `OPENCODE_URL` added to `.env` and documented in `.env.example`
- [x] Canonical frontmatter module (`src/dispatch/frontmatter.ts`) — 7 local parser copies replaced with single js-yaml-backed source of truth; MCP lib re-exports from dispatch
- [x] Test-criteria auto-sync (`src/dispatch/test-criteria.ts`) — new plans get Testing Plan section on creation; write route keeps criteria current on every save
- [x] Executor checkpoint/lock paths fixed — `DOCWRIGHT_ROOT` resolved correctly (was landing in `src/webui/.docwright/` instead of vault root)
- [x] Dead files removed: `opencode.json`, `opencode.jsonc.bak`, `opencode_test.jsonc`, `scripts/mcp-server.py`; `opencode-config` route updated to target `opencode.jsonc` and correct JS server path
- [x] `proposals/Check our path forward.md` (spaces, no frontmatter) moved to `docs/profile-contribution-architecture.md`
- [x] Pre-commit hook: deleted-file guard added to prevent word-split crash on spaced filenames
- [x] 9 existing plans backfilled with test criteria via `syncTestCriteria`; all now have `tests_defined: true`
- [x] `opencode.jsonc` model field removed — model configured via `opencode providers` CLI, not hardcoded

**Session note:** *(no separate note — work captured in commit bf7ceea)*

---

## Session: 2026-06-15 — Session setup, next-session context, AI shutdown

**Focus:** Project state review, next-session handoff, AI services shutdown

**Completed:**
- [x] Reviewed project state — no active plans, 21 pending proposals
- [x] Answered questions about last Claude and OpenCode sessions
- [x] Set next-session focus: Policy Atom Framework Step 1 + RLM follow-up
- [x] Shut down all local LLM/AI services (ollama-native, Docker AI containers)
- [x] Documented next-session start commands

**Session note:** `docs/session-notes/session_note_202606152209.md`
