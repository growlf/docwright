# SESSION-LOG.md — DocWright Session Log

Session log entries for the docwright project. Each session produces a detailed note
in `docs/session-notes/`; this file is a chronological index.

---

## Session: 2026-06-29 — gemini devdw persistent session setup

**Focus:** Persistent mosh+tmux+claude session on gemini dev server

**Completed:**
- [x] Created `~/.local/bin/devdw` script — mosh-preferred, SSH fallback, named tmux session
- [x] Fixed gemini locale: uncommented `en_US.UTF-8` in `/etc/locale.gen`, regenerated
- [x] Installed Claude Code on gemini via npm, symlinked to `/usr/local/bin/claude`
- [x] Fixed work directory typo (DocWrite → DocWright)
- [x] Verified `devdw` connects, attaches, and starts claude in ~/Projects/DocWright

**Session note:** `docs/session-notes/session_note_202606291619.md`

---

## Session: 2026-06-29 — Plan Close-outs, PR Merge, Branch Strategy Correction

**Focus:** Close multiuser-auth + forcegraph plans; merge PR #58 into develop

**Completed:**
- [x] `multiuser-auth-concurrent-sessions` marked completed, moved to plans/completed/ (15/15 steps)
- [x] `forcegraph-client-nav-sizing` marked completed, moved to plans/completed/ (3/3 steps)
- [x] docs/ stubs generated for both completed plans
- [x] PR #58 (`feat/typed-proposals` → `develop`) merged and branch deleted
- [x] Branching strategy clarified: `feat/*` → `develop` always; `main` only via `release/*` or `hotfix/*`
- [x] Memory updated: Forgejo is aspirational/recommendation, not current infrastructure; GitHub is the remote

**Session note:** `docs/session-notes/session_note_202606291600.md`

---

## Session: 2026-06-29 — ForceGraph Bug Root Cause & Lifecycle Transition

**Focus:** ForceGraph connector pile-up — real root cause diagnosed and fixed

**Completed:**
- [x] Resumed in-flight lifecycle transition for `forcegraph-client-nav-sizing` after dropped connection
- [x] Discovered graph bug survived the v0.4.1 fix — lines still piling at center
- [x] Root cause: Svelte `$state` deep proxy on `rawEdges` — d3's `forceLink` mutations triggered reactive cascade killing the simulation
- [x] Fixed: `KnowledgeGraph.svelte` — shallow-copy edges to plain objects before ForceGraph
- [x] Fixed: `fix-stale-approvals` tests — unset `DOCWRIGHT_VAULT_ROOT` in spawned process env
- [x] Plan created and filled in: `plans/forcegraph-client-nav-sizing.md` (active, all steps done)
- [x] All tests passing: webui 68/68, dispatch 291/291

**Session note:** `docs/session-notes/session_note_202606291400.md`

---

## Session: 2026-06-29 — Chat Write-back Fixed, Two Plans Closed

**Focus:** OpenCode permission.asked was blocking tools; fixed via opencode.json config

**Completed:**
- [x] Root cause found: OpenCode fires permission.asked before bash/edit/write — ChatPanel never responded
- [x] Fixed: `~/.config/opencode/opencode.json` — `bash/edit/write: "allow"`
- [x] Chat write-back verified: AI successfully wrote to Document History ✅
- [x] `chat-architecture-document-scoped-sessions` plan closed and archived
- [x] `unify-ai-via-opencode` plan closed and archived
- [x] Session note on collaboration: failure is as valuable as success; stop after 2 failed attempts

**Session note:** `docs/session-notes/session_note_202606290700.md`

---

## Session: 2026-06-29 — Chat Write-back Debugging

**Focus:** AI reads file and uses tools — but edit tool fails on large files

**Status:** INCOMPLETE — resume from session_note_202606290500.md

**Root cause found:** `edit` tool uses exact string matching (str_replace), fails silently on 196-line files. AI correctly reads file, identifies redundancy, calls edit — but string mismatch causes no-op. Fix: instruct AI to use `write` tool (full file rewrite) instead of `edit`.

**Session note:** `docs/session-notes/session_note_202606290500.md`

---

## Session: 2026-06-29 — Chat Architecture: Document-Scoped Sessions + Specialist AI Roles

**Focus:** Full chat architecture plan (6 steps) — per-doc sessions, ai-roles, aiSpecialist bridge

**Completed:**
- [x] ChatPanel: `Map<filePath, sessionId>` in localStorage (20-entry LRU cap)
- [x] Stale session recovery — 404 → silent recreate, network errors → preserve
- [x] Session indicator (📄 filename) + ↺ new-chat button in header
- [x] `ai-roles.ts` — 4 typed specialist roles; plan-review + apply-review wired up
- [x] `/api/ai-specialist` endpoint + `bridge.aiSpecialist()` / `aiSpecialistStream()` / `aiRoles`
- [x] `docs/plugins.md` updated with Specialist AI roles section
- [x] `npm run test:chat-sessions` e2e suite written (needs live server to run)
- [x] Cancelled superseded chat-context and write-back partial plans
- [x] Reverted naive document content dump from chat messages

**Session note:** `docs/session-notes/session_note_202606290300.md`

---

## Session: 2026-06-28/29 — Unify AI via OpenCode, Chat Context + Write-back

**Focus:** All AI routes through OpenCode; chat active-doc context + write-back system prompt

**Completed:**
- [x] `unify-ai-via-opencode` plan: 8 steps, OLLA routes replaced with `opencodeComplete()`, `/api/config` added
- [x] Launcher sources `src/webui/.env` so ANTHROPIC_API_KEY reaches OpenCode on restart
- [x] Chat context fix: `currentDocPath`/`currentDocContent` injected into first chat message
- [x] Chat write-back: DocWright system prompt injected at session creation
- [x] Two new proposals captured: AI model indicator (medium), chat context (high), chat write-back (high)
- [x] Approved and planned: chat-active-document-context, chat-document-write-back

**Session note:** `docs/session-notes/session_note_202606290130.md`

---

## Session: 2026-06-28 — Plugin System Close-out, Bug Fixes, Claude API

**Focus:** Plugin system verified and closed, apply-review bugs fixed, Claude wired as AI backend

**Completed:**
- [x] Formally verified plugin-system plan — 21/21 Playwright e2e checks, all 14 steps confirmed
- [x] Fixed `scanPlugins()` symlink traversal bug (`Dirent.isDirectory()` → `fs.statSync().isDirectory()`)
- [x] Fixed 5 apply-review / SSE watch bugs: status demotion, `_path` drop, unquoted YAML, AI notes in plan files, silent edit-mode reload suppression
- [x] Wrote 9 implementation steps for governance-engine-view-container plan
- [x] Wrote 15 implementation steps (5 phases) for multiuser-auth-concurrent-sessions plan
- [x] Captured critical proposal: plan-lifecycle-enforcement-gaps (6-layer fix for governance trail failures)
- [x] Wired Anthropic Claude API as inference backend (OLLA_API_KEY in src/webui/.env)
- [x] plugin-system plan archived to plans/completed/, v0.4.3 released to main
- [x] develop reset to main via branch protection API (removed stuck merge commit)
- [x] Lifecycle enforcement proposal approved, plan scaffolded

**Session note:** `docs/session-notes/session_note_202606282330.md`

---

## Session: 2026-06-28 — PR Merges + Branch Cleanup

**Focus:** Merge auth + ForceGraph PRs, clean up worktrees and branches

**Completed:**
- [x] Rebased `feat/multiuser-auth` onto develop, resolved SESSION-LOG.md conflict, merged PR #39
- [x] Rebased `feat/knowledge-graph` in DocWright-kg worktree onto develop, merged PR #40
- [x] Deleted merged branches: `feat/multiuser-auth`, `feat/knowledge-graph`, `feat/ui-layout-refactor`, `feat/plugin-system`, `dependabot/…multi-…`
- [x] Removed worktree directories: `DocWright-kg`, `DocWright-plugin`
- [x] One worktree remaining: `DocWright/` on develop

**Session note:** `docs/session-notes/session_note_202606281800.md`

---

## Session: 2026-06-28 — Multi-User Auth + OCC

**Focus:** Multi-user auth, Forgejo OAuth, OCC conflict dialog

**Completed:**
- [x] Drafted 12 implementation steps for `multiuser-auth-concurrent-sessions` plan
- [x] Delivered all 12 steps: hooks.server.ts, session store, Forgejo OAuth client, local auth fallback, login/callback/logout routes, UserBadge in toolbar, +layout.server.ts, per-user git attribution, ETag on /api/read, OCC check on /api/write, .env.example auth vars, 11 unit tests
- [x] Follow-up: client-side OCC conflict dialog — two-pane diff, Cancel/Take-server/Overwrite-mine
- [x] Verified: API-layer (6 fetch checks, all pass) + Playwright UI (dialog renders and resolves correctly)

**Session note:** `docs/session-notes/session_note_202606281600.md`

---

## Session: 2026-06-28 — UI Layout Refactor Complete, Governance Engine Vision

**Focus:** UI layout refactor (18/18 steps), governance engine architecture, branch structure

**Completed:**
- [x] Steps 2-18 of ui-layout-view-container-refactor — shell is pure chrome, zero view-specific layout imports
- [x] Governance Engine VC live as primary view (🏛) with 5 sub-views
- [x] Activity bar registry-driven from CORE_VCS map + activePlugins
- [x] External plugins lazy-load on first click (startup preload removed)
- [x] 33/33 Playwright e2e checks pass — full regression suite added
- [x] docs/plugins.md — complete plugin developer guide
- [x] PR #37 merged to develop — plan lifecycle completed
- [x] Two proposals approved and plans created: governance-engine-vc (high) + multiuser-auth (critical)
- [x] Branch structure: feat/shell-core, feat/governance-plugin, feat/files-plugin, feat/git-plugin, feat/tags-plugin, feat/search-plugin, feat/multiuser-auth — all from develop
- [x] ForceGraph client-nav sizing bug fixed in feat/knowledge-graph (afterNavigate + remove fallback dimensions)

**Session note:** `docs/session-notes/session_note_202606280000.md`

---

## Session: 2026-06-25 — Phase 3 & AI Routing Closed, Worktree Setup

**Focus:** Phase 3 transition, ai-model-routing closure, worktrees, hook fix

**Completed:**
- [x] Phase 3 transitioned to completed — v0.4.0 tagged and pushed
- [x] ai-model-routing closed — DocWright-side done, steps 3+4 delegated
- [x] Two proposals filed: phase-close Web UI, MCP stale dist detection
- [x] Three worktrees set up: develop / DocWright-plugin / DocWright-kg
- [x] install-hooks.sh js-yaml quoting bug fixed (worktree hook installs)
- [ ] DocWright-plugin staged files — hook reinstall needed, resolve next session

**Session note:** `docs/session-notes/session_note_202606251200.md`

---

## Session: 2026-06-25 — Phase 3 Closure Prep, Stale Dist Bug

**Focus:** Phase 3 closure prep, stale dist bug discovery

**Completed:**
- [x] Checked off all Phase 3 Testing Plan items (Steps 2+10 noted as delegated)
- [x] Closed dogfooding Phase Gate (ongoing through 1.0 by design)
- [x] Fixed MCP tool corruption to frontmatter (total_steps, completed_steps, tests_defined)
- [x] Created `feat/knowledge-graph` branch from develop for ongoing KG tuning
- [x] Rebuilt `dist/` via `npm run compile` (stale since Jun 22, broke 6-column step counting)
- [x] Phase 3 transition ready — blocked only by running MCP server needing restart

**Session note:** `docs/session-notes/session_note_202606250720.md`

---

## Session: 2026-06-24 — Housekeeping, Plan Renames, Phase 3 Pilots

**Focus:** PR/stash cleanup, naming coherence, Phase 3 pilot validation

**Completed:**
- [x] Merged PR #30 (research subfolder structure + orphan fixes)
- [x] Cleared both stash entries — extracted .envrc + .gitignore adopt-vault entries (PR #31)
- [x] Renamed 8 active plans for consistency + full cross-ref cascade across 47 files (PR #32)
- [x] Archived canceled ui-polish-bundle plan to plans/completed/ (PR #33)
- [x] Approved sub-plan-msp-pilot-vault + sub-plan-cascade-steam-early-access (HUMAN_APPROVED)
- [x] Marked Phase 3 Steps 8+9 ✅ Done — bms-ai-cluster + csdocs validated as real-world pilots (PR #34)
- [x] Phase 3 now 12/14 steps complete; formal closure deferred to next session

**Session note:** `docs/session-notes/session_note_202606241400.md`

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

---

## Session: 2026-06-17 — Policy Atom Framework + Completion Gate + AI Taxonomy

**Focus:** Complete policy-atom-framework (Steps 1–5), AI task category taxonomy (Steps 0–2), completion gate enforcement bug, executor UX

**Completed:**
- [x] Policy Atom Framework plan — all 5 steps done, 27/27 checkboxes, certified, moved to completed/
- [x] Plan Completion Gate Enforcement Bug — 4 gaps closed (heading normalization, tests_human_reviewed gate, client-side button blocker, terminology); plan completed
- [x] AiCategory extended to 6 values: `coding` + `agentic` with routing tables and categories.yaml
- [x] Atomic plan generator (`approve-proposal/plan-generator.ts`) — polling-based, replaces naive template parser
- [x] Executor panel heartbeat — 5s tick during BigPickle session, no more silent Execute panel
- [x] AI task category taxonomy Steps 0–2 done; Steps 3–5 deferred (ai-stack + UI sprint)

**Session note:** `docs/session-notes/session_note_202606172200.md`

---

## Session: 2026-06-17 (cont.) — Taxonomy Cleanup, Overlap Audit, Linter Fix

**Focus:** AI taxonomy plan cleanup, open plan audit, execution mode linter

**Completed:**
- [x] AI Task Category Taxonomy plan rewritten — removed AI-generated mess, Steps 1+2 marked done, Steps 3+4 deferred correctly
- [x] Open plan overlap audit — 17 plans + 24 proposals scanned, no critical duplications
- [x] Stale duplicate taxonomy plan deleted
- [x] run-tests endpoint: added test:atoms + atoms:isolation; guarded broken MCP Python test
- [x] Linter + pre-commit: accept mode: mentor|guided|autonomous; warn on deprecated automated:
- [x] 3 new linter tests

**Session note:** `docs/session-notes/session_note_202606172300.md`

---

## Session: 2026-06-17 — TS MCP Migration & Roadmap Enforcement

**Focus:** TS MCP Migration Finalization & Roadmap Enforcement

**Completed:**
- [x] Finalized TypeScript MCP Server Migration — resolved registration bug, signed off gate, moved to completed/
- [x] Repaired `opencode.jsonc` — removed deprecated keys, modernized schema, updated to Node.js MCP server
- [x] Drafted Roadmap Sequencing Enforcement proposal — identified tooling-gap, defined mechanical enforcement strategy

**Session note:** `docs/session-notes/session_note_202606171605.md`

---

## Session: 2026-06-17 — Roadmap Restructure, Vault Foundation, UI Fixes

**Focus:** Roadmap restructure, vault write API & KG foundation, UI cleanup, bug fixes

**Completed:**
- [x] Roadmap restructured: vault write API (3a), vault document index (3b), knowledge graph (3c) all moved to Phase 3 — perception and referential integrity before pilots
- [x] Phase 4 simplified to 3 serial items; Phase 5 renumbered around the new Phase 3 foundations
- [x] KG foundation Parts A+B: `proposal_source:` linter warn + `related_to:` linter warn + data fixes
- [x] 3 new Phase 3 proposals created: vault write API, vault document index, knowledge graph
- [x] All proposals/plans re-audited and realigned to new roadmap (10 files fixed)
- [x] Status page cleanup: audit moved to `/audit` route with matching header/navigation
- [x] fix: walkDeps must not follow `related_to` — 9 docs repaired from spurious `consumed_by`
- [x] fix: improve API strips AI code-fence wrappers before writing to disk
- [x] feat: executor presence indicator — toolbar pill (amber/blue/green) with pulsing animation
- [x] Phase 3 plan updated: title, total_steps 11→14, deliverables 11-13, phase gate

**Session note:** `docs/session-notes/session_note_202606172350.md`

---

## Session: 2026-06-18 — Phase 3 Foundation Complete + Knowledge Graph

**Focus:** Phase 3 deliverables #11–13, knowledge graph, vault hygiene

**Completed:**
- [x] Vault Write API (Phase 3 #11) — moveDocument/renameDocument/setDocumentField; rollback, wikilink cascade, cross-ref update, audit log; all file-move endpoints wired; 13 new tests
- [x] Vault Document Index (Phase 3 #12) — VaultEntry gains edges[]+contentHash; /api/graph + /api/vault/query live; SSE-triggered rebuild; 24 new tests (205 total)
- [x] Knowledge Graph (Phase 3 #13) — D3 force-directed 4th status tab; 6 gap-detection categories; filter sidebar with count badges; zoom/fit controls; consumed proposals hidden by default
- [x] New Proposal UX plan — all 6 steps; description dialog, AI improve on creation, Approve triggers related check, AI Review button, pre-creation duplicate check
- [x] POST /api/overlap/preview — keyword-coverage engine for pre-creation duplicate detection
- [x] Graph-surfaced vault hygiene: 4 stale plans closed out (New Proposal UX, new-proposals-check, vault migration system, vault-document-index approval); stale _path and proposal_source .md fixes
- [x] Various bug fixes: duplicate <style> block, esbuild bump, Find Related explicit refs

**Session note:** `docs/session-notes/session_note_202606180200.md`

---

## Session: 2026-06-19 — Session start skill + vault index certification

**Focus:** Claude Code session-start skill, vault index sub-plan certification

**Completed:**
- [x] Added `.claude/skills/docwright-session-start.md` — Claude Code-native skill using vault-status.js + git + TaskCreate (no MCP dependency)
- [x] Updated CLAUDE.md — instructs Claude Code to check `.claude/skills/` before OpenCode skill table
- [x] Certified `sub-plan-vault-document-index` — all 13 testing plan checkboxes verified, tests_human_reviewed: true

**Session note:** `docs/session-notes/session_note_202606190000.md`

---

## Session: 2026-06-21 — Launcher Portability, MCP Vault Fix, Security Patches

**Focus:** Launcher vault-awareness, OpenCode MCP wiring, Dependabot fixes

**Completed:**
- [x] `DocWright` launcher — uses `$PWD` as vault root; exports `DOCWRIGHT_VAULT_ROOT` so OpenCode MCP targets correct vault
- [x] Removed hardcoded CascadeSTEAM path from global OpenCode config; removed stale `dw-mcp` SSE entry
- [x] Idempotent adopt/upgrade on every launcher startup (manifest hash baseline)
- [x] Launcher moved to `scripts/DocWright` in repo; symlinked from `~/.local/bin`
- [x] All managed vaults upgraded and pushed: csdocs, bms-ai-cluster, DAFO
- [x] Dependabot vulnerabilities resolved via npm overrides (0 remaining locally); v0.3.7 tagged and pushed

**Session note:** `docs/session-notes/session_note_202606212300.md`

---

## Session: 2026-06-22 — Asset Discovery & SSH Config Rules

**Focus:** Asset discovery toolset, BMS hardware audit, SSH config fixes

**Completed:**
- [x] Created `docs/SOPs/asset-discovery.md` — layered validation framework
- [x] Created unified Ansible playbook `gather-device-inventory.yml` (bms-ai-cluster)
- [x] Created `sync-device-from-discovery.py` with drift detection + ARP cross-ref
- [x] Created `docwright-discovery` skill + web UI notification store
- [x] Created `asset-management` profile (external plugin prototype)
- [x] Added live methodology capture to `one-off-formalization.md`
- [x] Created rule `ssh-config-only.md` — all SSH via ~/.ssh/config aliases
- [x] Created rule `password-manager-first.md` — update BW before continuing after cred changes
- [x] Fixed SSH aliases for `frank`, `crash`, `router.bms`
- [x] Physical discovery: pve1 (HP DL360p Gen8), pve2 (Dell R630), crash (HP DL360 Gen9), frank (custom)
- [x] Identified router access loss — BW password stale, needs recovery from BMS

**Session note:** `docs/session-notes/session_note_202606221500.md`
**Discovery data:** `docs/session-notes/BMS_DISCOVERY_DATA.md`

---

## Session: 2026-06-24 — PRs, Plans, Orphans, Research Restructure

**Focus:** PR cleanup, plan consolidation, critical path work, vault graph orphan fixes

**Completed:**
- [x] Cleared PRs #17–#29: Vite 8 upgrade, branch scheme docs, step-issue tooling, branch policy CI gate
- [x] Branch policy enforced: feat|fix|chore/* → develop; release/v* → main; CI gate required
- [x] Consolidated active plans: 74 → 34 pending items; 2 canceled, 1 completed, 4 steps corrected done
- [x] Master Stack artifact: full portfolio analysis, 4 layers, critical path identified
- [x] Phase 3 governance closures: Deliverables 11, 12, 13 marked ✅ Done (code already existed)
- [x] Knowledge Graph proposal approved (user committed with HUMAN_APPROVED=1)
- [x] promote.ts implemented — Phase 4 apex, 5 functions, 15 tests, wires gates.ts + audit.ts
- [x] Fixed 141 broken cross-references (83+ graph orphans resolved)
- [x] research/INDEX.md → research/index.md (lowercase, wikilinks, graph edges)
- [x] research/execution-mode/ subfolder — 4 docs moved, cluster index created
- [x] Graph gap detection: deferred proposals excluded from orphan/thematic detection
- [x] PR #30 open (research subfolder + orphan fixes) — CI pending at session end

**Open:** PR #30 (`chore/research-subfolder-structure` → develop) needs merge. Vault renaming work (active plans still use mixed naming) to continue next session.

**Session note:** `docs/session-notes/session_note_202606240000.md`

---

## Session: 2026-06-25 — KG Launch Setup, Graph Views, Scanner Refactor

**Focus:** DocWright-kg environment, KG graph UI, bms-ai-cluster scanner architecture

**Completed:**
- [x] DocWright-kg symlink + launcher `--vault` flag — all three repos; eliminates stale env var footgun
- [x] `adopt-vault.ts` self-stomp fix — `.claude/settings.json` not overwritten when vault = installation
- [x] Playwright e2e suite committed — `npm run test:e2e` mandatory before reporting UI changes
- [x] erpnext/technitium MCP entries removed from all three DocWright repo configs
- [x] `BaseView.svelte` — docwright.views surfaced as tabs (Nexus Graph, Container Hierarchy, Network Flow)
- [x] `ForceGraph.svelte` — shared D3 engine; KnowledgeGraph + GraphView refactored to thin wrappers
- [x] Graph pane height fixed (base-mode flex chain; root cause was `.page-wrap align-items: flex-start`)
- [x] `enrich-uplinks.py` — bridge table + LLDP → uplink_host for all YetiCraft devices
- [x] `DeviceRegistry` gather→resolve→write pipeline — eliminates scan-order relationship bugs
- [x] `uplink_host` as first-class field: ref_fields, extra_fields, YAML sources, survives syncs
- [x] Scanner: MAC dedup, IP conflict guard, placeholder marking, `--audit` mode
- [x] Full sync: 56 YAML + 138 DHCP = 61 canonical devices; 28 aliases merged; 2 new devices found; ✓ all reach router

**Open:**
- Proxmox credentials needed for container topology
- 14 MAC duplicates + 8 placeholders need human review/merge
- `espressif` + `sterling` on YetiCraft network — unidentified
- BMS sync deferred (router unreachable this session)

**Session note:** `docs/session-notes/session_note_202606251800.md`

---

## Session: 2026-06-26 — UI Layout Refactor Plan + Steps 1–2

**Focus:** UI plugin architecture plan overhaul, bridge unification, error boundary

**Completed:**
- [x] Overhauled `ui-layout-view-container-refactor.md` plan: 14→18 steps, Phase 0 API contract, unified bridge, lifecycle callbacks, priority right panel, mobile VC strip, TypeScript types, lazy loading
- [x] Step 1: `window.__docwright` unified bridge (replaces dual `__dw_plugins`+`__docwright_host` globals), backward-compat shim, `plugin-api.d.ts` ambient type declarations
- [x] Step 2 (partial): `ViewContainerMount.svelte` error boundary — mount/unmount lifecycle, try/catch isolation, old mountSidebar() backward-compat fallback

**Open:**
- Step 2 layout wiring: import ViewContainerMount, remove old mountSidebar $effect, replace plugin div, add mobile VC strip CSS — see session note for exact edits

**Session note:** `docs/session-notes/session_note_202606262000.md`

---

## Session: 2026-06-28 — csdocs Policy Reorganization + DocWright Fixes

**Focus:** csdocs vault restructure, atoms_dir config, base view cross-folder fix

**Completed:**
- [x] Split `policies/infrastructure/` into `technology/`, `operations/`, `governance/`
- [x] Added README index to every policies/ subfolder, atoms/, and docs/reference/
- [x] Updated Policy List.base to exclude README files and cover all new folders
- [x] Added `atoms_dir` config field to DocWright — vaults can now store atoms outside policies/
- [x] csdocs now uses `atoms_dir: "atoms"` — atoms live cleanly in `atoms/` at vault root
- [x] Fixed DocWright-ui /api/base to scan file.inFolder() paths instead of only the .base file's own folder
- [x] Fixed BaseView.svelte evalCond to implement file.inFolder(), file.name, file.ext, and nested OR/AND filters

**Session note:** `docs/session-notes/session_note_202606281200.md`

---

## Session: 2026-06-28 — Plugin System Complete

**Focus:** Plugin system — all 14 steps

**Completed:**
- [x] Error boundary: console scoping, unhandled rejection handler, teardown (step 8)
- [x] Manifest validation tests: 13 new tests, 60 total passing (step 9)
- [x] Plugin hot-reload: SSE `pluginchange` events, activity bar auto-refresh (step 10)
- [x] JS bridge fix: layout owns `window.__docwright`, `/api/config` for vaultRoot (step 11)
- [x] cs-erp-images bridge updated to `registerView`/`claimRightPanel` contract (step 12)
- [x] cs-erp-images Deployment UI: SSH site manager, command generator, SSE runner (step 13)
- [x] Plugin contribution guide: `docs/plugins.md` with server.js, SSE, hot-reload sections (step 14)
- [x] Bug fix: asset-management profile missing research doc type (3 integration tests restored)
- [x] Merged feature/plugin-system → develop, pushed to origin

**Session note:** `docs/session-notes/session_note_202606282300.md`

---

## Session: 2026-06-29 — Chat Session Panel Tier 2 Complete

**Focus:** Tier 2 diff panel, plan close-out, git workflow fix

**Completed:**
- [x] Step 10: `diffAnnotate()` in dispatch/linter.ts, `/api/diff-annotate` endpoint, governance badge row in SessionDiffPanel.svelte
- [x] Step 11: Per-file Accept/Reject checkboxes, staging footer, `/api/git/restore`, selective `/api/git/stage`
- [x] Step 12: 9 diffAnnotate() unit tests + 7 staging integration tests; fixed path injection bug (path.join vs path.resolve)
- [x] Tiers 3 & 4 formally deferred — two deferred proposals created
- [x] Plan completed and moved to plans/completed/
- [x] Phase Gate section added to all three plan templates
- [x] GitFlow lesson: feat/* → develop, release/* → main (CI-enforced)
- [x] Released as v0.4.6 via release/v0.4.6 → main (PR #54)

**Session note:** `docs/session-notes/session_note_202606291200.md`

---

## Session: 2026-06-29 — Apply Review Fix, ForceGraph Plan Close-Out

**Focus:** Apply Review silent bug, apostrophe syntax fix, ForceGraph lifecycle

**Completed:**
- [x] Fixed Apply Review button silently doing nothing on well-written all-done plans — toasts added for no-improvements path and silent write failure
- [x] Fixed apostrophe syntax error in proposal dialog placeholders (introduced in typed-proposals feat commit)
- [x] ForceGraph pile-up root cause fully identified: $state proxy on rawEdges + d3 forceLink mutations; fixed in KnowledgeGraph.svelte
- [x] ForceGraph plan created (plans/forcegraph-client-nav-sizing.md, status: active, all steps done)
- [x] Lifecycle docs: proposal moved to proposals/approved/, plan created

**Open:**
- plans/forcegraph-client-nav-sizing.md needs close-out (status: active → completed)
- multiuser-auth-concurrent-sessions.md (priority: critical, status: approved) — not started
- governance-engine-view-container.md (priority: high, status: approved) — not started
- 74a3e09 unpushed on feat/typed-proposals

**Session note:** `docs/session-notes/session_note_202606291339.md`

---

## Session: 2026-06-30 — version tooling, launcher daemon, endsession-as-code

**Focus:** version tooling, launcher daemon, endsession-as-code

**Completed:**
- [x] feat: automate endsession via scripts/end-session.ts
- [x] fix: reconcile version files to 0.4.5
- [x] feat: add start/stop/status/restart/logs subcommands to DocWright launcher
- [x] fix: retire scripts/version.js and correct versioning docs
- [x] feat: propose fixing or retiring scripts/version.js
- [x] fix: ForceGraph connector pile-up on client-side navigation — lifecycle transition
- [x] fix: unescaped apostrophes in proposal dialog placeholder strings
- [x] fix: Apply Review button silently did nothing on well-written plans
- [x] feat: typed proposal intake — feature/bug/thought categories, AI title generation
- [x] feat: lifecycle graph funnel view — filter controls, close plan

**Session note:** `docs/session-notes/session_note_202606300328.md`

---

## Session: 2026-06-30 — dogfooding pivot: 6 PRs merged, 4 bugs found, guardrails recalibrated

**Focus:** dogfooding pivot: 6 PRs merged, 4 bugs found, guardrails recalibrated

**Completed:**
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check reads stale COMMIT_EDITMSG
- [x] On develop: wip: cascade-steam UI approval (next session)
- [x] index on develop: 94380f0 feat: propose fixing or retiring scripts/version.js
- [x] untracked files on develop: 94380f0 feat: propose fixing or retiring scripts/version.js
- [x] feat: propose fixing or retiring scripts/version.js
- [x] chore: approve fix-or-retire-version-js proposal
- [x] docs: complete governance-engine-view-container + capture dogfooding bug findings
- [x] docs: capture dogfooding bug findings (WYSIWYG corruption, Complete-action defects)
- [x] docs: complete governance-engine-view-container plan
- [x] fix: profile-config endpoint returns name/version/documentTypes (completes governance Step 7)

**Session note:** `docs/session-notes/session_note_202606302058.md`

---

## Session: 2026-06-30 — Process redesign + trunk migration

**Focus:** Process redesign + trunk migration

**Completed:**
- [x] docs: flesh out the beta-channel lifecycle and gate (§5)
- [x] docs: cross-link proposal to discussion issue #68
- [x] docs: propose dev-tracking split, milestones, and beta channel (urgent)
- [x] chore: migrate to trunk-based branching (retire develop)
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check is broken
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check reads stale COMMIT_EDITMSG
- [x] On develop: wip: cascade-steam UI approval (next session)
- [x] index on develop: 94380f0 feat: propose fixing or retiring scripts/version.js
- [x] untracked files on develop: 94380f0 feat: propose fixing or retiring scripts/version.js
- [x] feat: propose fixing or retiring scripts/version.js

**Session note:** `docs/session-notes/session_note_202606302339.md`

---

## Session: 2026-07-01 — Pre-commit approval gate fix

**Focus:** Pre-commit approval gate fix

**Completed:**
- [x] fix: repair HUMAN-APPROVED approval gate (assert in commit-msg, not pre-commit)
- [x] docs: capture two hook-deployment bugs found fixing the approval gate
- [x] fix: repair HUMAN-APPROVED gate — assert marker in commit-msg, not pre-commit
- [x] docs: flesh out the beta-channel lifecycle and gate (§5)
- [x] docs: cross-link proposal to discussion issue #68
- [x] docs: propose dev-tracking split, milestones, and beta channel (urgent)
- [x] chore: migrate to trunk-based branching (retire develop)
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check is broken
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check reads stale COMMIT_EDITMSG
- [x] On develop: wip: cascade-steam UI approval (next session)

**Session note:** `docs/session-notes/session_note_202607010019.md`

---

## Session: 2026-06-30 — devdw SSH connectivity fix

**Focus:** devdw SSH connectivity fix

**Completed:**
- [x] fix: repair HUMAN-APPROVED approval gate (assert in commit-msg, not pre-commit)
- [x] docs: capture two hook-deployment bugs found fixing the approval gate
- [x] fix: repair HUMAN-APPROVED gate — assert marker in commit-msg, not pre-commit
- [x] docs: flesh out the beta-channel lifecycle and gate (§5)
- [x] docs: cross-link proposal to discussion issue #68
- [x] docs: propose dev-tracking split, milestones, and beta channel (urgent)
- [x] chore: migrate to trunk-based branching (retire develop)
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check is broken
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check reads stale COMMIT_EDITMSG
- [x] feat: propose fixing or retiring scripts/version.js

**Session note:** `docs/session-notes/session_note_202606301925.md`

---

## Session: 2026-06-30 — urgent-issue visibility gap + #68 kickoff

**Focus:** urgent-issue visibility gap + #68 kickoff

**Completed:**
- [x] docs: land base process-flow proposal on trunk (#68)
- [x] fix: repair HUMAN-APPROVED approval gate (assert in commit-msg, not pre-commit)
- [x] docs: capture two hook-deployment bugs found fixing the approval gate
- [x] fix: repair HUMAN-APPROVED gate — assert marker in commit-msg, not pre-commit
- [x] docs: flesh out the beta-channel lifecycle and gate (§5)
- [x] docs: cross-link proposal to discussion issue #68
- [x] docs: propose dev-tracking split, milestones, and beta channel (urgent)
- [x] chore: migrate to trunk-based branching (retire develop)
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check is broken
- [x] docs: capture bug — pre-commit HUMAN-APPROVED check reads stale COMMIT_EDITMSG

**Session note:** `docs/session-notes/session_note_202606301940.md`

---

## Session: 2026-07-01 — Process-flow unblock + cleanup

**Focus:** Process-flow unblock + cleanup

**Completed:**
- [x] fix: resolve MCP vault root when DOCWRIGHT_VAULT_ROOT is unset/unexpanded
- [x] fix: resolve MCP vault root when DOCWRIGHT_VAULT_ROOT is unset/unexpanded
- [x] fix: sort status lists by priority across all schemes; empty sinks last
- [x] fix: sort status lists by priority across all schemes; empty sinks last
- [x] fix: surface parked (unmerged-branch) work at session start
- [x] docs: capture bug — session:end pushes directly to protected main
- [x] docs: capture bug — session-start blind to unmerged branches + open issues
- [x] docs: land base process-flow proposal on trunk (#68)
- [x] docs: capture bug — session-start blind to unmerged branches + open issues
- [x] fix: repair HUMAN-APPROVED approval gate (assert in commit-msg, not pre-commit)

**Session note:** `docs/session-notes/session_note_202607010339.md`

---

## Session: 2026-07-02 — Post-merge review, collaboration model, dogfood deploy

**Focus:** Post-merge review, collaboration model, dogfood deploy

**Completed:**
- [x] docs: approve collaboration-issue-model-and-roadmap-sync (proposal → plan)
- [x] fix: auto-commit Web UI approve→plan so it isn't left uncommitted; guard behind auth (#110)
- [x] fix: approve→plan generator no longer dumps the proposal or mints an approved plan (#108)
- [x] docs: collaboration model — execution lifecycle, source of truth, scope-freeze
- [x] docs: refine collaboration model — issues track plans (1-to-many), not proposals
- [x] docs: link collaboration proposal to its tracking issue #104
- [x] fix: gitignore MCP fixture audit logs so tests stop polluting git (#95)
- [x] fix: bridge — suggest-style two-phase dedup, harvest context, never auto-reject (#92)
- [x] fix: gate + auth-guard beta→stable channel promotion (#91)
- [x] docs: add multi-agent and multi-session collaboration guidelines

**Session note:** `docs/session-notes/session_note_202607022004.md`

---

## Session: 2026-07-03 — Post-merge sync and task hunt

**Focus:** Post-merge sync and task hunt

**Completed:**
- [x] feat: interactive status tiles and approval flow fixes
- [x] docs: BMS dev-cloud three-deployment architecture (design draft)
- [x] feat: consolidate Tags into Search VC and implement reactive navigation routing
- [x] refactor: centralize the duplicated frontmatter parser (Issue #94)
- [x] fix: relabel 'Pending Approval' stat and add tooltips in Governance panel
- [x] chore: bump version to 0.4.6 webui and lockfiles
- [x] refactor: decouple plan generation logic into reusable modules and integrate automated section generation via OpenCode API
- [x] feat: improve executor-panel-live-feedback and status navigation
- [x] docs: approve executor-panel-live-feedback (proposal → plan)
- [x] Fix/complete plan reactivity

**Session note:** `docs/session-notes/session_note_202607032132.md`

---

## Session: 2026-07-03 — watch endpoint crash fix

**Focus:** watch endpoint crash fix

**Completed:**
- [x] fix: watch endpoint no longer crashes the server on .git watcher races
- [x] fix: watch endpoint no longer crashes the server on .git watcher races
- [x] feat: env-driven vite allowedHosts for reverse-proxied deployments
- [x] docs: propose three-instance deployment — dogfood, csdocs, cs-erp-images
- [x] feat: interactive status tiles and approval flow fixes
- [x] docs: BMS dev-cloud three-deployment architecture (design draft)
- [x] feat: consolidate Tags into Search VC and implement reactive navigation routing
- [x] refactor: centralize the duplicated frontmatter parser (Issue #94)
- [x] fix: relabel 'Pending Approval' stat and add tooltips in Governance panel
- [x] chore: bump version to 0.4.6 webui and lockfiles

**Session note:** `docs/session-notes/session_note_202607032246.md`

---

## Session: 2026-07-04 — resolve stale Phase 2 banner on status dashboard

**Focus:** resolve stale Phase 2 banner on status dashboard

**Completed:**
- [x] fix: resolve stale Phase 2 banner on status dashboard
- [x] fix: watch endpoint no longer crashes the server on .git watcher races
- [x] fix: watch endpoint no longer crashes the server on .git watcher races
- [x] fix: watch endpoint no longer crashes the server on .git watcher races
- [x] feat: env-driven vite allowedHosts for reverse-proxied deployments
- [x] docs: propose three-instance deployment — dogfood, csdocs, cs-erp-images
- [x] feat: interactive status tiles and approval flow fixes
- [x] docs: BMS dev-cloud three-deployment architecture (design draft)
- [x] feat: consolidate Tags into Search VC and implement reactive navigation routing
- [x] refactor: centralize the duplicated frontmatter parser (Issue #94)

**Session note:** `docs/session-notes/session_note_202607040048.md`

---

## Session: 2026-07-04 — remove redundant phase gate review banner from sta

**Focus:** remove redundant phase gate review banner from sta

**Completed:**
- [x] feat: remove redundant phase gate review banner from status list view
- [x] fix: resolve stale Phase 2 banner on status dashboard
- [x] fix: watch endpoint no longer crashes the server on .git watcher races

**Session note:** `docs/session-notes/session_note_202607040052.md`

---

## Session: 2026-07-04 — default status sections to collapsed in list view

**Focus:** default status sections to collapsed in list view

**Completed:**
- [x] feat: default status sections to collapsed in list view
- [x] feat: remove redundant phase gate review banner from status list view
- [x] fix: resolve stale Phase 2 banner on status dashboard
- [x] fix: watch endpoint no longer crashes the server on .git watcher races

**Session note:** `docs/session-notes/session_note_202607040055.md`

---

## Session: 2026-07-04 — resolve plugin navigation regression and route def

**Focus:** resolve plugin navigation regression and route def

**Completed:**
- [x] fix: resolve plugin navigation regression and route defaults
- [x] fix: resolve plugin navigation regression and route defaults
- [x] chore: integrate origin/dogfood (allowedHosts) with local main-merge
- [x] docs: propose three-instance deployment — dogfood, csdocs, cs-erp-images
- [x] fix: set default landing page for files view container to roadmap
- [x] feat: default status sections to collapsed in list view
- [x] feat: remove redundant phase gate review banner from status list view
- [x] fix: resolve stale Phase 2 banner on status dashboard
- [x] chore: merge main into dogfood — watch crash fix (#121) + session note
- [x] fix: watch endpoint no longer crashes the server on .git watcher races

**Session note:** `docs/session-notes/session_note_202607040121.md`

---

## Session: 2026-07-04 — release-tag.sh repo slug kept .git suffix, breakin

**Focus:** release-tag.sh repo slug kept .git suffix, breakin

**Completed:**
- [x] fix: release-tag.sh repo slug kept .git suffix, breaking CI watch
- [x] chore: bump version to 0.4.7 — allowedHosts + watch crash fix
- [x] feat: env-driven vite allowedHosts for reverse-proxied deployments
- [x] docs: log UI consume/process gap; merge sub-plans manually pending it
- [x] docs: retire dogfood-branch deployment draft — superseded by proposal
- [x] docs: enrich deployment proposal — add msp-pilot (4th) instance, consume Phase-3 sub-plans
- [x] fix: resolve plugin navigation regression and route defaults
- [x] fix: resolve plugin navigation regression and route defaults
- [x] chore: integrate origin/dogfood (allowedHosts) with local main-merge
- [x] docs: propose three-instance deployment — dogfood, csdocs, cs-erp-images

**Session note:** `docs/session-notes/session_note_202607041723.md`

---

## Session: 2026-07-04 — Heatmap and dedup pipeline

**Focus:** Heatmap and dedup pipeline

**Completed:**
- [x] feat: complete heatmap and dedup pipeline — cross-source dedup, capture_bug_report MCP tool, heatmap UI, promote-to-GH, time-weighted demand
- [x] feat: add issue workflow MCP tools — preflight, sync, branch, complete
- [x] feat: add issue workflow MCP tools — preflight, sync, branch, complete
- [x] fix: detect and prevent duplicate plan creation from two paths
- [x] fix: detect and prevent duplicate plan creation from two paths
- [x] fix: after approve, land on plan Properties tab with success toast
- [x] fix: after approve, land on plan Properties tab with success toast
- [x] fix: release-tag.sh repo slug kept .git suffix, breaking CI watch
- [x] chore: bump version to 0.4.7 — allowedHosts + watch crash fix
- [x] feat: env-driven vite allowedHosts for reverse-proxied deployments

**Session note:** `docs/session-notes/session_note_202607041950.md`

---

## Session: 2026-07-04 — cross-tool parity + branch hygiene

**Focus:** cross-tool parity + branch hygiene

**Completed:**
- [x] fix: CI dangling-branch guard checks outcome, not admin-only setting
- [x] feat: branch hygiene — auto-delete merged heads, prune locals, flag stranded main commits
- [x] chore: bump version to 0.4.8 — openssh-client + plugin-loader fix
- [x] chore: archive completed plan separate-dev-tracking-milestones-and-beta-channel
- [x] fix: install openssh-client in image so SSH remotes / deploy keys work
- [x] fix: step-table parsers split on escaped \| inside cells
- [x] docs: enrich deployment proposal — 4th (msp-pilot) instance + consume Phase-3 sub-plans
- [x] docs: refresh CLAUDE.md phase sections — phases 0–3 complete, phase 4 current
- [x] feat: complete heatmap and dedup pipeline — cross-source dedup, capture_bug_report MCP tool, heatmap UI, promote-to-GH, time-weighted demand
- [x] fix: plugin loader falls back to DOCWRIGHT_ROOT so plugins load in the container

**Session note:** `docs/session-notes/session_note_202607042227.md`

---

## Session: 2026-07-05 — BMS dev-cloud build-out (4 DocWright instances)

**Focus:** Stand up the full four-instance DocWright dev-cloud on BMS — releases, reverse-proxy/DNS, deploy-key push, governing proposal.

**Completed:**
- [x] Stand up 4 instances: dogfood-dev (:5173), csdocs (:5274), erp-images+plugin (:5275), msp-pilot (:5276); retire the old :5273 dogfood
- [x] Wire NPMPlus proxy hosts + Technitium DNS (`*.bms.local` → VIP) via idempotent Ansible playbook (BMS-0091)
- [x] Deploy-key git-push for #2/#3/#4 (per-repo write keys, backed into VaultWarden CS-org DocWright collection)
- [x] Cut v0.4.7 (allowedHosts + watch fix) and v0.4.8 (openssh-client + plugin-loader fix); instances 2–4 pinned to v0.4.8
- [x] docs: enrich + merge deployment proposal — 4th (msp-pilot) instance + consume Phase-3 sub-plans (#123)
- [x] fix: env-driven vite allowedHosts (#124)
- [x] fix: release-tag.sh repo slug kept .git suffix (#125)
- [x] fix: plugin loader falls back to DOCWRIGHT_ROOT (#131)
- [x] fix: install openssh-client in image (#134)
- [x] chore: leap-frog dogfood from main; restart #1 on synced code
- [x] bms-ai-cluster: configure-docwright-dev-cloud playbook + 3 findings issues
- [x] fix: /api/plugins 500 on dangling plugin symlink; dropped committed dev-home symlink (#163)
- [x] Corrected NPMPlus topology — repointed *.bms.local to swarm CNAME (off flaky legacy LXC); decommissioned it (pct stop 104, BMS-0092)
- [x] Verified all 4 instances load in a headless browser (0 console errors / failed requests)
- [x] docs: CHANGELOG 0.4.6–0.4.8, session-note continuation, operational runbook (deployment-bms-devcloud)

**Session note:** `docs/session-notes/session_note_202607050615.md`

---

## Session: 2026-07-05 — Issue-store reconciliation + contribution pipeline

**Focus:** Issue-store reconciliation + contribution pipeline

**Completed:**
- [x] chore: first real friction-loop cycle — log entry, file #166, triage with upstream link
- [x] docs: close doc gaps — CHANGELOG 0.4.6-0.4.8, session-note continuation, deploy runbook
- [x] chore: first real friction-loop cycle — log entry, file #166, triage with upstream link
- [x] docs: contribution-pipeline verification gaps closed; #145 resolved in issue store
- [x] fix: research-smoke treats research as opt-in per profile; add contribute_upstream token-path tests (#145)
- [x] chore: leap-frog dogfood from main — /api/plugins dangling-symlink fix
- [x] fix: /api/plugins 500 on dangling plugin symlink; drop committed dev-home symlink
- [x] chore: issue store sync — #159 resolved, #160 filed
- [x] feat: plan completion gated on recorded green test run + fully-checked Testing Plan (#159)
- [x] docs: contribution-pipeline Testing Plan reconciled with evidence

**Session note:** `docs/session-notes/session_note_202607050230.md`

---

## Session: 2026-07-05 — agent-roles proposal + parallel branch

**Focus:** agent-roles proposal + parallel branch

**Completed:**
- [x] docs: webui-write-integrity Step 1 → done; #94 resolved in issue store
- [x] docs: propose scoped agent roles with per-role model routing (ai-stack bridge)
- [x] docs: webui-write-integrity Step 1 → done; #94 resolved in issue store
- [x] chore: leap-frog dogfood from main — branch-list shell fix
- [x] refactor: centralize frontmatter parsing in dispatch; delete 6 parseFm copies (#94)
- [x] fix: branch list returned empty — shell mangled the %(refname:short) format
- [x] docs: propose scoped agent roles with per-role model routing (ai-stack bridge)
- [x] refactor: centralize frontmatter parsing in dispatch; delete 6 parseFm copies
- [x] chore: leap-frog dogfood from main — git-panel branch switcher
- [x] feat: git-panel branch switcher (/api/git/branch + dropdown)

**Session note:** `docs/session-notes/session_note_202607051413.md`

---

## Session: 2026-07-05 — Plan completion + write-integrity Step 1

**Focus:** Plan completion + write-integrity Step 1

**Completed:**
- [x] chore: capture #191 via bug-report bridge — endsession strands commits on protected main
- [x] chore: capture #191 via bug-report bridge — endsession strands commits on protected main
- [x] docs: webui-write-integrity Step 1 → done; #94 resolved in issue store
- [x] docs: propose scoped agent roles with per-role model routing (ai-stack bridge)
- [x] chore: leap-frog dogfood from main — branch-list shell fix
- [x] refactor: centralize frontmatter parsing in dispatch; delete 6 parseFm copies (#94)
- [x] fix: branch list returned empty — shell mangled the %(refname:short) format
- [x] chore: leap-frog dogfood from main — git-panel branch switcher
- [x] feat: git-panel branch switcher (/api/git/branch + dropdown)
- [x] docs: propose git-panel branch switcher (approved: false)

**Session note:** `docs/session-notes/session_note_202607051433.md`

---

## Session: 2026-07-05 — write-integrity Step 2 shared gate

**Focus:** write-integrity Step 2 shared gate

**Completed:**
- [x] docs: webui-write-integrity Step 2 → done; #172 resolved in issue store
- [x] docs: webui-write-integrity Step 2 → done; #172 resolved in issue store
- [x] fix: share the completion gate across surfaces — webui Complete now enforces it (#172)
- [x] fix: share the completion gate across surfaces — webui Complete now enforces it
- [x] chore: leap-frog dogfood from main — opencode.jsonc untrack/ignore
- [x] fix: stop committing runtime-generated opencode.jsonc (perpetual clone churn)
- [x] chore: capture #191 via bug-report bridge — endsession strands commits on protected main
- [x] docs: webui-write-integrity Step 1 → done; #94 resolved in issue store
- [x] docs: propose scoped agent roles with per-role model routing (ai-stack bridge)
- [x] chore: leap-frog dogfood from main — branch-list shell fix

**Session note:** `docs/session-notes/session_note_202607051631.md`

---

## Session: 2026-07-05 — write-integrity Step 3 auto-commit

**Focus:** write-integrity Step 3 auto-commit

**Completed:**
- [x] docs: log bug — runtime writes derived fields back into tracked plan files
- [x] docs: webui-write-integrity Step 3 → done; #147 and #142 resolved in issue store
- [x] docs: log bug — runtime writes derived fields back into tracked plan files
- [x] docs: webui-write-integrity Step 3 → done; #147 and #142 resolved in issue store
- [x] fix: auto-commit every Web UI lifecycle write; share the completion doc generator (#147, #142)
- [x] fix: auto-commit every Web UI lifecycle write; share the completion doc generator (#147, #142)
- [x] docs: approve git-panel-branch-switcher (proposal → plan)
- [x] docs: propose guard against committing machine-specific absolute paths (approved: false)
- [x] docs: propose guard against committing machine-specific absolute paths (approved: false)
- [x] docs: webui-write-integrity Step 2 → done; #172 resolved in issue store

**Session note:** `docs/session-notes/session_note_202607051732.md`

---

## Session: 2026-07-06 — Plan _path fix + milestone taxonomy

**Focus:** Plan _path fix + milestone taxonomy

**Completed:**
- [x] chore: version-based milestone taxonomy + drop Phase from roadmap + tag proposals
- [x] chore: version-based milestone taxonomy + drop Phase from roadmap + tag proposals
- [x] docs: webui-write-integrity Step 4 → done; #148 resolved in issue store
- [x] fix: syncTestCriteria only on step-table change; sweep phantom Testing Plan duplicates (#148)
- [x] chore: leap-frog dogfood from main — v0.4.9 (gate parity + auto-commit UI writes)
- [x] chore: bump version to 0.4.9 — write-integrity gate + auto-commit UI writes
- [x] fix: Web UI approve→plan generator emits _path (kills out-of-band backfill churn)
- [x] fix: Web UI approve→plan generator emits _path (kills out-of-band backfill churn)
- [x] chore: bump version to 0.4.9 — write-integrity gate + auto-commit UI writes
- [x] chore: capture #205 via bug-report bridge — release bump never lands on main (VERSION drift)

**Session note:** `docs/session-notes/session_note_202607060130.md`

---

## Session: 2026-07-06 — merge origin/main with step 6 completed and new is

**Focus:** merge origin/main with step 6 completed and new is

**Completed:**
- [x] docs: merge origin/main with step 6 completed and new issues migrated
- [x] fix: approve idempotency self-heal — clear stale consumed_by pointers
- [x] chore: capture #220 via bug-report bridge — Certify Tests unreachable with out-of-band test evidence
- [x] chore: capture #218 — pane save demotes tests_defined on unchanged body; restore field
- [x] docs: assign phase 4 and v0.6.0 milestone to collaboration-issue-model-and-roadmap-sync plan
- [x] feat: sync issue workflow validation to scripts/pre-commit.sh
- [x] docs: migrate issues to new schema with explicit triage and scope-check
- [x] docs: add explicit issue schema with triage and scope-check stages
- [x] docs: webui-write-integrity Step 6 → done; all Testing Plan boxes evidence-checked; #141 resolved
- [x] docs: promote Wave C (report/intake UX) to v0.5.0 — full scope linked

**Session note:** `docs/session-notes/session_note_202607060821.md`

---

## Session: 2026-07-06 — v0.4.9 release + plan completed

**Focus:** v0.4.9 release + plan completed

**Completed:**
- [x] docs: complete webui-write-integrity (plan → completed)
- [x] docs: complete webui-write-integrity (plan → completed)
- [x] fix: approve idempotency self-heal — clear stale consumed_by pointers (#141)
- [x] chore: capture #224; land BDFL certification + restore tests_defined
- [x] chore: capture #224 (test/certify button state machine UX); land BDFL certification + restore tests_defined
- [x] docs: edit plans/webui-write-integrity.md (web ui save)
- [x] docs: edit plans/webui-write-integrity.md (web ui save)
- [x] docs: edit plans/webui-write-integrity.md (web ui save)
- [x] docs: edit plans/webui-write-integrity.md (web ui save)
- [x] chore: merge origin/main into feature branch

**Session note:** `docs/session-notes/session_note_202607060140.md`

---

## Session: 2026-07-06 — webui-write-integrity completion + collaboration model

**Focus:** webui-write-integrity completion + collaboration model

**Completed:**
- [x] docs: generate 7 tracked issues for collaboration-issue-model plan
- [x] docs: generate 7 tracked issues for collaboration-issue-model plan
- [x] docs: scaffold collaboration-issue-model plan with critical gaps and implementation steps
- [x] docs: scaffold collaboration-issue-model plan with critical gaps and implementation steps
- [x] docs: propose git-native multi-session work claiming (approved: false)
- [x] docs: mark #220 as resolved by PR #230
- [x] docs: mark #220 as resolved by PR #230
- [x] fix: show Certify Tests affordance for out-of-band test verification (#220)
- [x] fix: show Certify Tests affordance for out-of-band test verification
- [x] docs: mark #218 as resolved by PR #227

**Session note:** `docs/session-notes/session_note_202607062042.md`
