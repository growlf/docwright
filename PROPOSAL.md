# docwright — Structured Markdown Workbench

> **Status:** Draft v0.6 — 2026-05-22
> **Repository:** `github.com/growlf/docwright`
> **License:** MIT
> **Canonical home:** The GitHub repo above. Drive folder is a sharing mirror only.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Proposed Solution](#2-proposed-solution)
3. [Quick Start](#3-quick-start)
4. [Why VSCodium](#4-why-vscodium)
5. [Differentiation from Existing Extensions](#5-differentiation-from-existing-extensions)
6. [Key Design Decisions](#6-key-design-decisions)
7. [Architecture](#7-architecture)
8. [Profile System](#8-profile-system)
9. [What We Borrow](#9-what-we-borrow)
10. [What We Build](#10-what-we-build)
11. [Command Registry](#11-command-registry)
12. [Configuration & Generality](#12-configuration--generality)
13. [Prerequisites & Installation Requirements](#13-prerequisites--installation-requirements)
14. [Phased Delivery](#14-phased-delivery)
15. [Testing Strategy](#15-testing-strategy)
16. [CI/CD & Release](#16-cicd--release)
17. [Licensing, Attribution & Governance](#17-licensing-attribution--governance)
18. [Comparison with Alternatives](#18-comparison-with-alternatives)
19. [Risk Assessment](#19-risk-assessment)
20. [Naming](#20-naming)
21. [Document History](#21-document-history)

---

## 1. Problem Statement

### The Friction

Documentation workflows — proposals, plans, SOPs, specs, structured markdown with
frontmatter — are poorly served by existing tools. The pain is not tool selection.
It is the friction of the actual workflow:

**Without this tool:**

1. Manually copy a template file (or write frontmatter from memory)
2. Open a terminal to discover validation failures at pre-commit time
3. Switch to a browser to ask an AI agent about the content
4. Switch back to the editor
5. Run `git add`, `git commit`, manually track which docs are in which state
6. Repeat — with no at-a-glance view of what is pending, blocked, or done

**With this tool:**

1. `Ctrl+Shift+P` → "New Proposal" — file created with valid frontmatter, auto-staged
2. Ask OpenCode anything from the same window
3. `Ctrl+Alt+Up` → "Promote" when ready — frontmatter updated, file renamed, all
   inbound links updated, commit message pre-filled, staged — in one command

This is what *automating best practices* means: **the right thing becomes the easy
thing.** Frontmatter validation prevents bad commits. The state machine prevents
ad-hoc status tracking. Auto-staging prevents forgotten git adds. The Promote command
makes state transitions atomic and traceable. None of this requires the user to learn
a new convention — the tool enforces the convention on their behalf.

The same friction applies to any domain where structured markdown tracks real-world
entities — infrastructure nodes, services, devices — moving through defined states.

### Tool Gap Analysis

| Tool | Problem |
|------|---------|
| **Obsidian** | Proprietary, no native git, sandboxed plugin API, AI embedding blocked |
| **Terminal + vim/nvim** | No markdown preview, no git diff UI, no file tree |
| **VS Code / VSCodium (vanilla)** | No lifecycle awareness, no structured templates, no AI workflow |
| **Foam** | PKM-focused, no lifecycle state machine, no AI agent, no frontmatter enforcement |
| **Dendron** | Hierarchical notes, no lifecycle workflow, no AI, development stalled |
| **Docusaurus / MkDocs** | Write-only publishing, no agent integration, no lifecycle |

---

## 2. Proposed Solution

A **standalone, MIT-licensed, FOSS VSCodium extension** that turns the editor into a
structured markdown workbench. OpenCode provides the optional AI agent. VSCodium
provides the editor, git, and file tree. The extension adds a **profile-driven engine**
on top.

### Zero-Config First

**A user who opens any folder gets a working tool immediately.** No setup required.
The default `doc-lifecycle` profile activates automatically. Scaffolding commands
appear in the command palette. Frontmatter linting works on any `.md` file. The
dashboard shows any file with a `status` field in its frontmatter.

OpenCode is optional and progressive — the chat panel shows a setup prompt if OpenCode
is not running, but every other feature works without it.

### What the Extension Adds

1. **Profile System** — domain-specific bundles (states, schema, templates, naming
   conventions, optional features) that snap onto the core engine; swappable; user-definable
2. **Documentation Dashboard** — sidebar showing lifecycle state, pending items, orphans,
   and quick actions at a glance
3. **Scaffolding Commands** — create structured docs with valid frontmatter in one step;
   auto-staged; naming-convention-aware
4. **Lifecycle State Machine** — frontmatter-as-truth; no external database
5. **Promote Command** — atomic state transition: updates frontmatter, renames file,
   updates all inbound wikilinks, stages, pre-fills commit message
6. **Wikilinks & Backlinks** — `[[link]]` autocomplete, go-to, backlinks panel,
   link-update-on-rename, orphan detection
7. **Frontmatter Linter** — real-time validation inline, not at commit time
8. **OpenCode Integration** — embedded chat panel, pre-configured with
   profile-specific instructions (optional, works with local LLMs)

### AI Provider: OpenCode Zen + Big Pickle (Primary Path)

The recommended and primary documented AI provider for docwright is **OpenCode Zen**
with **Big Pickle** as the default model. OpenCode Zen is a curated AI gateway run by
the OpenCode team — models benchmarked specifically for coding agents, served via an
OpenAI-compatible API. Big Pickle is Zen's current flagship free model: 200K context
window, native tool calling, and reasoning support.

```json
// ~/.config/opencode/config.json
{
  "provider": "opencode",
  "model": "opencode/big-pickle"
}
```

Obtain an API key at `opencode.ai/auth`. Big Pickle is currently free.

> **Data notice:** During Big Pickle's free period, interaction data may be used to
> improve the model — unlike other Zen models which follow a zero-retention policy.
> For sensitive documents, use a Zen model with zero-retention or a fully self-hosted
> stack (see §13).

### Self-Hosted / Local LLM (Secondary Path)

For complete data sovereignty — no cloud, no API key, no retention — docwright works
with any self-hosted OpenAI-compatible inference server. The following repositories
provide ready-to-use local LLM stacks:

| Repo | Hardware | What it provides |
|------|----------|-----------------|
| [`growlf/ai-stack`](https://github.com/growlf/ai-stack) | Intel i9 Ultra + Xe iGPU, Ubuntu | Full LLM stack configuration and install scripts |
| [`growlf/intel_nuc_skullcanyon_ollama_with_gpu`](https://github.com/growlf/intel_nuc_skullcanyon_ollama_with_gpu) | Intel NUC Skullcanyon | Ollama with GPU acceleration on NUC hardware |

Either stack eliminates all cloud dependency. docwright treats them identically to any
other OpenAI-compatible endpoint.

### Bundled Profiles

- `doc-lifecycle` — proposals → plans → completed/canceled (default)
- `infra-topology` — network/device/service management: planned → active →
  decommissioned (graph view enabled, dot-prefix naming on)

Both are illustrative starting points. Users define their own profiles for any domain
that benefits from structured markdown moving through defined states.

---

## 3. Quick Start

*The zero-config path. No profile setup, no OpenCode required.*

**1. Install**
```
VSCodium → Extensions → Search "docwright" → Install
```

**2. Open any folder**

The `doc-lifecycle` profile activates automatically. The docwright icon appears in the
Activity Bar. The dashboard sidebar opens.

**3. Create your first document**
```
Ctrl+Shift+P → "docwright: New Proposal"
```
Enter a title. A file is created with valid frontmatter, auto-staged in git, and opened
in the editor.

**4. Write**

Frontmatter linting validates as you type. `[[link]]` autocomplete works across all
tracked files. The dashboard updates in real time.

**5. Promote when ready**
```
Ctrl+Alt+Up → "docwright: Promote"
```
Select the next state. Frontmatter updates, the file is renamed (if naming convention
is on), all inbound wikilinks update, the change is staged, and a commit message is
pre-filled in the git panel.

**That's it.** No terminal required for any of these steps.

---

## 4. Why VSCodium

| Reason | Detail |
|--------|--------|
| **FOSS** | No Microsoft branding, telemetry, or proprietary marketplace terms |
| **Open VSX** | Full distribution without Microsoft's marketplace restrictions |
| **Full VS Code API compatibility** | Every VS Code API works in VSCodium; no forks or shims needed |
| **Built-in git** | Mature staging, diff, branch, commit UI — nothing to build |
| **Built-in markdown** | Native editor + preview + syntax highlighting — nothing to build |
| **Portable** | Linux, macOS, Windows; ChromeOS via Crostini |

**Why not Cursor, Windsurf, or other AI-first forks?** Proprietary products with
licensing terms that conflict with FOSS distribution. VSCodium is the only fully open
fork supporting Open VSX without restrictions.

---

## 5. Differentiation from Existing Extensions

| Capability | docwright | Foam | Dendron |
|---|---|---|---|
| **Zero-config activation** | ✅ | ❌ requires setup | ❌ requires setup |
| **Lifecycle state machine** | ✅ configurable | ❌ | ❌ |
| **Best-practices automation** | ✅ enforces conventions | ❌ | ❌ |
| **Promote command** (atomic transition) | ✅ | ❌ | ❌ |
| **Frontmatter schema enforcement** | ✅ real-time | ❌ | Partial |
| **AI agent integration** | ✅ OpenCode embedded | ❌ | ❌ |
| **Local LLM / self-hosted AI** | ✅ first-class | ❌ | ❌ |
| **Git-aware scaffolding** | ✅ auto-stage | ❌ | ❌ |
| **Dashboard with pending items** | ✅ | ❌ | ❌ |
| **Wikilinks with autocomplete** | ✅ | ✅ | ✅ |
| **Backlinks panel** | ✅ | ✅ | ✅ |
| **Link update on rename** | ✅ | ✅ | ✅ |
| **Orphans / dangling reference view** | ✅ lifecycle-aware | ✅ PKM-aware | ❌ |
| **Graph view** | ✅ profile-optional | ✅ always | ✅ always |
| **Domain profiles** | ✅ | ❌ | ❌ |
| **Multi-root workspace support** | ✅ per-root profiles | ❌ | Partial |
| **File tree status decorations** | ✅ | ❌ | ✅ (hierarchy only) |
| **Active development** | ✅ | Slow | Stalled |
| **License** | MIT | MIT | AGPL |

**The key distinction:** Foam and Dendron are knowledge management tools. docwright is
a **structured document lifecycle workbench** with a pluggable domain engine and
enforced best practices. Different problem, different user.

---

## 6. Key Design Decisions

These decisions are made upfront to prevent implementation debates. They are documented
here as the authoritative record. Changes require a proposal and BDFL sign-off.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Dashboard tech stack** | Vanilla HTML + CSS, no JS framework | Smallest bundle, no build step for the WebView, lowest barrier for contributors; revisit only if complexity demands it |
| **Graph library** (infra-topology) | D3.js force-directed | MIT license, widely understood, no framework dependency, composable with vanilla HTML WebView |
| **Workspace index format** | JSON (`index.json`) | Human-readable, git-diff-friendly, no native module needed, trivially rebuildable |
| **Wikilink disambiguation** | First-match with inline warning | Consistent with Foam; fully-qualified paths are always accepted; ambiguity warned but not fatal |
| **Multi-root workspaces** | One profile and index per workspace root | Avoids cross-root state pollution; dashboard aggregates all roots with visual separator |
| **Promote atomicity model** | Write-then-verify, no automatic rollback | Rolling back multi-file writes atomically is fragile; failed steps are logged and surfaced as a recovery checklist; Promote is idempotent for already-completed steps |
| **Dashboard refresh model** | Event-driven via VS Code file watcher; no polling | See trigger table in §7 |
| **Extension activation** | Lazy — heavy modules load after activation event | Keeps activation time under 500ms for any workspace size |
| **Profile discovery** | Local `.docworkbench/profile.json` only | No remote profile fetching; community profiles are installed by cloning/copying; prevents supply-chain attacks |

---

## 7. Architecture

### VSCodium Window Layout

```
VSCodium Window
│
├── [Activity Bar] ─────────── docwright icon
│
├── [Side Bar: Dashboard]                        ← BUILD (profile-aware)
│   ├── Lifecycle summary (counts per state)
│   ├── Pending / attention-needed
│   │   ├── Docs awaiting state transition
│   │   ├── Orphans (no inbound or outbound links)
│   │   └── Broken / placeholder wikilinks
│   ├── Recent documents (last 10 modified)
│   └── Quick actions (scaffold, promote, commit)
│
├── [Editor Area] ───────────────────────────    ← BORROW (VSCodium)
│   ├── Markdown editor + split preview
│   ├── Frontmatter syntax highlighting
│   ├── Wikilink [[autocomplete]] + navigation
│   └── Git diff view
│
├── [Side Bar: OpenCode Chat] ───────────────    ← BORROW + INTEGRATE (optional)
│   └── OpenCode web UI via direct URL embed
│       (extension host → localhost:PORT → opencode serve → AI or local LLM)
│
└── [Panel: Git] ────────────────────────────    ← BORROW (VSCodium)
    ├── Changes / staged / unstaged
    ├── Commit message + button
    └── Branch / sync status
```

### Data Flow

```
User types in editor
        │
        ├─► Frontmatter Linter (debounced 300ms)
        │       validates against profile schema → inline diagnostics
        │
        ├─► Wikilink Engine
        │       resolves [[links]] → autocomplete, go-to, backlinks
        │
        └─► Lifecycle State Machine (file-save triggered)
                reads frontmatter `status` → file decorations + workspace index
                        │
                        ▼
                Workspace Index (incremental JSON — only changed files rescanned)
                        │
                        ▼
                Dashboard WebView (event-driven refresh — see trigger table below)

OpenCode Chat (fully parallel and independent)
        │
Extension spawns `opencode serve` as child process on free port
        │
VSCodium WebView points directly at http://127.0.0.1:PORT
        │
opencode serve → any OpenAI-compatible endpoint (cloud or local)
```

**Note on the direct-URL embed:** `opencode serve` (v1.15+) serves its own SPA at
the root URL. The VSCodium WebView loads it directly — no in-process HTTP server,
static file serving, or API proxy is needed. Confirmed by Phase 0 spike.

### Dashboard Refresh Triggers

| Event | Action |
|-------|--------|
| File saved | Rescan that file's frontmatter; update index entry; refresh dashboard sections |
| File created | Add to index; refresh lifecycle summary and recent docs |
| File deleted | Remove from index; refresh all panels |
| File renamed | Update index key; trigger Link Updater; refresh dashboard |
| `.git/HEAD` changes (checkout, pull) | Full index rebuild |
| Profile switch | Full index rebuild for new glob pattern |

### State Persistence Model

**Frontmatter is the source of truth.** The profile defines which fields are required
and which values are valid:

```yaml
# doc-lifecycle profile
---
title: "Proposal: Replace logging infrastructure"
status: proposal          # proposal | plan | completed | canceled
created: 2026-05-21
author: NetYeti
tags: [infrastructure, logging]
---
```

```yaml
# infra-topology profile
---
title: "pi4-node-01"
type: device              # device | service | network-segment
status: active            # planned | active | decommissioned
hostname: pi4-node-01
ip: 192.168.1.42
depends-on:
  - "[[service.mqtt-broker]]"
  - "[[device.router-main]]"
location: rack-a
---
```

The `.docworkbench/index.json` cache is `.gitignore`d and always rebuildable.
Updates are incremental — only changed files are rescanned.

### Promote Command — Step Sequence and Failure Handling

The Promote command executes steps in order. Each step is logged. On failure, completed
steps are surfaced to the user as a recovery checklist — not silently rolled back, since
atomic rollback across multiple file writes is fragile and can hide state. Promote is
**idempotent**: re-running after a fix skips already-completed steps.

```
1. Validate transition is allowed (per profile stateTransitions)
2. Write updated frontmatter → file saved
3. Rename file (if naming convention active)
4. Update all inbound wikilinks (batch file writes)
5. git add all changed files
6. Pre-fill commit message in VS Code git panel
```

If step 3 fails (e.g. permission error): steps 1–2 are done, 3–6 are not. The user
sees: "Promote partially completed. Rename failed: [reason]. Fix and re-run Promote."

### Multi-Root Workspace Handling

Each workspace root gets its own profile and index. The dashboard aggregates across
roots with a visual separator showing the root name. The Promote command, scaffolding,
and linting all operate on the root of the currently active file. OpenCode receives
context only from the active root's `opencode-instructions.md`.

### Performance

| Concern | Mitigation |
|---------|-----------|
| Frontmatter scanning on every keystroke | Linter debounced 300ms |
| Large workspace initial scan | Deferred post-activation; progress in status bar |
| Dashboard re-render rate | Event-driven, batched on rapid changes |
| Wikilink resolution at scale | Index built at activation; incremental on change |
| Extension activation time | Lazy loading; target < 500ms for any workspace |

### Port Management

`opencode serve` is assigned a port dynamically from a configurable base (default
`4096`), incrementing until a free port is found. Port stored in VS Code workspace
state — not persisted between sessions, not shared across windows.

---

## 8. Profile System

The profile system is what makes docwright general-purpose rather than a
documentation-specific tool. The core engine handles structured markdown, frontmatter,
a generic state machine, wikilinks, a workspace index, and a dashboard. Profiles define
everything domain-specific.

### Profile Directory Structure

```
.docworkbench/
├── profile.json              ← profile manifest (versioned)
├── schema.json               ← frontmatter JSON Schema
├── opencode-instructions.md  ← domain AI context (injected into OpenCode)
├── templates/
│   ├── proposal.md           ← scaffolding template
│   ├── plan.md
│   └── sop.md
└── index.json                ← workspace cache (gitignored)
```

### Profile Manifest

```json
{
  "docwrightProfileVersion": "1",
  "name": "doc-lifecycle",
  "displayName": "Documentation Lifecycle",
  "description": "Proposals, plans, SOPs moving through formal approval states",
  "lifecycleStates": ["proposal", "plan", "completed", "canceled"],
  "stateTransitions": {
    "proposal": ["plan", "canceled"],
    "plan":     ["completed", "canceled"],
    "completed": [],
    "canceled":  []
  },
  "frontmatterSchema": "./schema.json",
  "templateDir":       "./templates/",
  "docsGlob":          "docs/**/*.md",
  "namingConvention":  null,
  "features": {
    "graph":            false,
    "wikilinks":        true,
    "backlinks":        true,
    "contentEmbedding": false
  },
  "opencodeInstructions": "./opencode-instructions.md"
}
```

`docwrightProfileVersion` enables forward-compatible migration. When the engine loads
an older profile version, it applies a migration function and warns the user. Breaking
profile schema changes are major semver bumps in docwright.

### Template Example: `proposal.md`

```markdown
---
title: "{{TITLE}}"
status: proposal
created: {{DATE}}
author: {{AUTHOR}}
tags: []
---

## Summary

<!-- What problem does this solve? One paragraph. -->

## Motivation

<!-- Why now? What is the cost of not doing this? -->

## Proposed Approach

<!-- How will this be done? Keep it high-level here. -->

## Open Questions

<!-- What must be resolved before this can move to plan? -->

## Success Criteria

<!-- How will we know this is done? Make it measurable. -->
```

Variables substituted at scaffolding time: `{{TITLE}}` (from user input), `{{DATE}}`
(ISO 8601), `{{AUTHOR}}` (from git config `user.name`).

### OpenCode Instructions Example: `doc-lifecycle`

```markdown
You are working in a repository that uses the docwright doc-lifecycle profile.

Documents follow a proposal → plan → completed/canceled lifecycle tracked via YAML
frontmatter. Your role:

- Help draft and improve documents at any lifecycle stage
- Suggest when a proposal is ready to promote: all open questions resolved, success
  criteria defined, motivation clearly stated
- Identify stalled documents: proposals with no recent edits and unresolved open
  questions, plans with no progress notes
- When asked about document status, use the workspace index context provided or ask
  to run "docwright: Rebuild Index" first

Required frontmatter fields: title, status, created, author
Valid status values: proposal, plan, completed, canceled
Docs are tracked under: docs/**/*.md
```

### Naming Convention (optional)

When `namingConvention` is `"dot-prefix"`, scaffolding enforces `{state}.{slug}.md`
and Promote renames as part of the transition. When `null`, the tool is hands-off
about filenames.

- `doc-lifecycle` ships with naming **off** (non-opinionated default)
- `infra-topology` ships with naming **on** (`device.pi4-node-01.md`)

### Bundled Profiles

#### `doc-lifecycle` (default)

| Setting | Value |
|---------|-------|
| States | `proposal → plan → completed / canceled` |
| Required frontmatter | `title`, `status`, `created`, `author` |
| Optional frontmatter | `tags`, `depends-on` |
| Templates | `proposal.md`, `plan.md`, `sop.md` |
| Naming convention | Off |
| Graph view | Off |
| Wikilinks | On |

#### `infra-topology`

| Setting | Value |
|---------|-------|
| States | `planned → active → decommissioned` |
| Required frontmatter | `title`, `type`, `status`, `hostname` |
| Optional frontmatter | `ip`, `depends-on`, `location`, `tags` |
| Templates | `device.md`, `service.md`, `network-segment.md` |
| Naming convention | `dot-prefix` (on) |
| Graph view | On (D3.js force-directed `depends-on` topology) |
| Wikilinks | On |

### Profile Security Note

Profiles live in the user's own repository — they are not fetched remotely. The attack
surface is limited to malicious repositories the user has explicitly checked out. Treat
profile files from untrusted sources the same as any other code you clone. This is
documented in the README and the profile authoring guide.

### Profile Switching

`Ctrl+Shift+P` → `docwright: Switch Profile`. Engine reloads schema, templates, state
machine, and feature flags without restarting. Index rebuilds for the new glob pattern.

### Future Profile Targets

The following profiles are tracked as post-Phase-4 development targets. They are not
in scope for current delivery but the profile system architecture is designed to support
them without core engine changes.

#### `code-review` (planned, post-Phase 4)

Inspired by [open-code-review](https://github.com/spencermarx/open-code-review)
(Apache-2.0), this profile would turn docwright into a multi-agent code review
workbench:

- Documents represent code review sessions, tracking a git diff through a structured
  review lifecycle (pending → in-review → addressed → closed)
- Multiple AI reviewer personas (generalist, security, architecture) produce structured
  findings independently, then engage in discourse before synthesis
- Findings tracked via frontmatter; status decorations in file tree; dashboard shows
  open findings across all active reviews

**Multi-model intent:** This profile is the primary motivation for keeping docwright's
AI provider layer fully abstracted. Different reviewer personas could be routed to
different models or endpoints — e.g., Big Pickle for fast initial passes, a stronger
reasoning model (via Zen or a local stack) for discourse and synthesis. No single
cloud provider dependency should be assumed.

> **Attribution note:** open-code-review is Apache-2.0 licensed. Any code borrowed
> from it must follow Apache-2.0 attribution requirements and be added to NOTICE.md.

---

## 9. What We Borrow

| Component | Source | Canonical URL | License | How We Use It |
|-----------|--------|---------------|---------|---------------|
| **OpenCode Web SPA** | Anomaly Innovations (formerly SST) | `github.com/sst/opencode` `packages/app/` | MIT | Served directly by `opencode serve` child process |
| **SPA proxy technique** | cpkt9762 | `github.com/cpkt9762/opencode-web-for-vscode` | MIT | In-process HTTP server pattern |
| **OpenCode JS SDK** | Anomaly Innovations | `github.com/sst/opencode` `packages/sdk/` | MIT | Session management and prompts |
| **opencode-gui patterns** | ktmage | `github.com/ktmage/opencode-gui` | MIT | WebView embedding reference |
| **Markdown editor + preview** | VSCodium built-in | `github.com/VSCodium/vscodium` | MIT | Native editing and preview |
| **Git integration** | VSCodium built-in | `github.com/VSCodium/vscodium` | MIT | Decorations, diff, staging, commits |
| **Frontmatter validation patterns** | bms-ai-cluster | `github.com/growlf/bms-ai-cluster` | MIT | Schema rules adapted for general use |
| **Document lifecycle model** | bms-ai-cluster | `github.com/growlf/bms-ai-cluster` | MIT | Genericized state machine |

> **OpenCode attribution:** Created by SST; maintained by Anomaly Innovations
> (`anomalyco` on GitHub). Canonical URL `github.com/sst/opencode` active via redirect.
> NOTICE.md credits both.

### Phase 0 Gate: Verifying `opencode serve`

Before Phase 1, a 2–3 day spike must confirm:

- [ ] `opencode serve` is a documented, stable HTTP API (not internal/experimental)
- [ ] The HTTP API has a stable schema or changelog
- [ ] JS SDK covers required session and prompt endpoints

**If the gate fails:** build a lightweight native WebView chat UI using the JS SDK
only. Simpler, fewer moving parts, no schedule impact on any other feature.

---

## 10. What We Build

### Core Engine Modules

| Module | Purpose | Key Files |
|--------|---------|-----------|
| **Profile Engine** | Loads manifest; applies states/schema/templates/features; schema migration; profile switching | `src/profile/ProfileEngine.ts`, `src/profile/migrations/` |
| **Documentation Dashboard** | Sidebar WebView (vanilla HTML): lifecycle summary, pending, orphans, recent, quick actions | `src/dashboard/DashboardProvider.ts`, `src/dashboard/webview/` |
| **Lifecycle State Machine** | Generic; driven by profile config; emits events to decorations and dashboard | `src/lifecycle/StateMachine.ts`, `src/lifecycle/decorations.ts` |
| **Workspace Index** | Incremental JSON cache; rebuilt from frontmatter on demand | `src/lifecycle/WorkspaceIndex.ts` |
| **Frontmatter Linter** | `DiagnosticCollection`; debounced 300ms; validates against profile schema | `src/linter/FrontmatterLinter.ts` |
| **Template Engine** | Renders templates with variable substitution (title, date, author from git) | `src/templates/TemplateEngine.ts`, `src/templates/defaults/` |
| **Scaffolding Commands** | "New [type]" per profile template; auto-stages; naming-convention-aware | `src/commands/scaffold.ts` |
| **OpenCode Server Manager** | Spawns `opencode serve` as child process; dynamic port; restart on crash | `src/opencode/ServerManager.ts` |
| **OpenCode Config Writer** | Writes profile `opencodeInstructions` to `.opencode/` on activation | `src/opencode/ConfigWriter.ts` |
| **Settings Module** | Typed `vscode.workspace.getConfiguration('docworkbench')` wrapper | `src/settings/Settings.ts` |

### Feature Modules (profile-gated)

| Module | Purpose | Default | Key Files |
|--------|---------|---------|-----------|
| **Wikilink Engine** | `[[link]]` autocomplete, go-to, hover, diagnostics, section links | Both: on | `src/wikilinks/WikilinkProvider.ts` |
| **Link Updater** | Updates all inbound wikilinks on file rename/move | Both: on | `src/wikilinks/LinkUpdater.ts` |
| **Backlinks Panel** | All docs linking to current file with context | Both: on | `src/wikilinks/BacklinksProvider.ts` |
| **Orphans View** | No-inbound-link docs; links to non-existent docs | Both: on | `src/dashboard/OrphansView.ts` |
| **Promote Command** | Atomic next-state: frontmatter + rename + link update + stage + commit | Both: on | `src/commands/promote.ts` |
| **Lookup Palette** | Quick-pick filtered by lifecycle state | Both: on | `src/commands/lookup.ts` |
| **Tag Filter** | Dashboard filter by `tags` frontmatter field | Both: on (Phase 3) | `src/dashboard/TagFilter.ts` |
| **Graph View** | D3.js force-directed `depends-on` topology | doc-lifecycle: **off** infra-topology: **on** | `src/graph/GraphProvider.ts` |
| **Content Embedding** | `![[note#section]]` transclude inline | Both: off (Phase 4) | `src/wikilinks/EmbedProvider.ts` |

### FOSS Project Hygiene (repository, not the extension)

| File | Purpose |
|------|---------|
| `CHANGELOG.md` | [Keep a Changelog](https://keepachangelog.com) format; updated with every PR |
| `SECURITY.md` | Vulnerability reporting process |
| `CONTRIBUTING.md` | PR process, code style, test requirements, profile authoring guide |
| `NOTICE.md` | Attribution for all borrowed components |
| `CODEOWNERS` | Per-path review requirements |
| `.github/ISSUE_TEMPLATE/` | Bug report, feature request, profile submission templates |
| `.github/PULL_REQUEST_TEMPLATE.md` | Checklist: tests passing, CHANGELOG updated, docs updated |
| `.github/dependabot.yml` | Automated PRs for npm (weekly) and GitHub Actions (monthly) |

---

## 11. Command Registry

All commands are prefixed `docwright.` and appear in the VS Code command palette.

| Display Name | Command ID | Default Keybinding | Phase |
|---|---|---|---|
| New Document | `docwright.new` | — | 1 |
| New Proposal | `docwright.newProposal` | `Ctrl+Alt+P` | 1 |
| New Plan | `docwright.newPlan` | `Ctrl+Alt+L` | 2 |
| New SOP | `docwright.newSop` | — | 2 |
| Promote | `docwright.promote` | `Ctrl+Alt+Up` | 3 |
| Lookup by State | `docwright.lookup` | `Ctrl+Alt+F` | 2 |
| Open Dashboard | `docwright.openDashboard` | — | 1 |
| Switch Profile | `docwright.switchProfile` | — | 3 |
| Rebuild Index | `docwright.rebuildIndex` | — | 2 |
| Open OpenCode Chat | `docwright.openChat` | `Ctrl+Alt+C` | 1 |
| Commit This Doc | `docwright.commitDoc` | — | 3 |

Keybindings avoid conflicts with VS Code defaults and common extensions. All keybindings
are user-remappable via standard VS Code keybinding settings.

---

## 12. Configuration & Generality

### VS Code Settings (minimal by design)

| Setting | Default | Description |
|---------|---------|-------------|
| `docworkbench.profileDir` | `.docworkbench/` | Profile directory relative to workspace root |
| `docworkbench.builtinProfile` | `"doc-lifecycle"` | Fallback if no `profile.json` found |
| `docworkbench.opencodePort` | `4096` | Base port for `opencode serve` (increments if in use) |
| `docworkbench.autoStageOnCreate` | `true` | Auto-`git add` newly scaffolded files |
| `docworkbench.autoStageOnPromote` | `true` | Auto-`git add` files changed by Promote |

All domain-specific configuration lives in `profile.json`. A repository that ships its
own profile gives every contributor identical behaviour automatically — no per-user
configuration required.

### Creating a Custom Profile

1. Copy a bundled profile directory to `.docworkbench/` in your repository
2. Edit `profile.json` — states, transitions, glob, naming convention, features
3. Edit `schema.json` — frontmatter fields and validation rules
4. Add templates to `.docworkbench/templates/`
5. Commit `.docworkbench/` (except `index.json`)

Contributors get the profile automatically on checkout.

---

## 13. Prerequisites & Installation Requirements

### User Must Have Installed

| Dependency | Minimum | Notes |
|------------|---------|-------|
| **VSCodium** | 1.85+ | Or VS Code 1.85+ |
| **Git** | Any recent | Required for all git integration |
| **opencode** | Latest stable | `npm i -g opencode-ai@latest` — **optional**; all non-AI features work without it |
| **AI provider** | — | **Primary:** OpenCode Zen / Big Pickle (free, see §13). **Secondary:** any self-hosted OpenAI-compatible server |

> **Minimum viable install: VSCodium + Git.** Every feature except the chat panel
> works immediately with no further setup.

### ChromeOS / Crostini Notes

The extension uses the VS Code extension host's Node.js runtime —
**no separate Node.js installation is required**. The Node.js dependency is satisfied
by VS Code/VSCodium itself.

If opencode's CLI requires a specific Node version, manage it with NVM independently:
```bash
nvm install 20 && nvm use 20 && nvm alias default 20
```

### AI Provider Configuration

**Primary: OpenCode Zen + Big Pickle**

```bash
# 1. Sign in at opencode.ai/auth to get your API key
# 2. Run /connect in the OpenCode TUI and select OpenCode Zen, or set manually:
```
```json
// ~/.config/opencode/config.json
{
  "provider": "opencode",
  "model": "opencode/big-pickle"
}
```

Big Pickle is currently free. See the data notice in §2 regarding retention during
the free period.

**Secondary: Self-Hosted Local LLM**

```json
// ~/.config/opencode/config.json
{
  "providers": {
    "local": {
      "type": "openai",
      "baseUrl": "http://localhost:11434/v1",
      "apiKey": "local"
    }
  }
}
```

Works with any OpenAI-compatible server. See
[`growlf/ai-stack`](https://github.com/growlf/ai-stack) and
[`growlf/intel_nuc_skullcanyon_ollama_with_gpu`](https://github.com/growlf/intel_nuc_skullcanyon_ollama_with_gpu)
for ready-to-use self-hosted stacks.

### Graceful Degradation

| Missing component | Effect |
|---|---|
| opencode not installed | Chat panel shows setup prompt; all other features work |
| opencode serve fails | Offline mode; chat shows error + fix steps; all other features work |
| AI provider unreachable | Chat shows error; all other features work |
| No `profile.json` | `doc-lifecycle` profile activates automatically |

---

## 14. Phased Delivery

### Phase 0 — Spike
**Goal:** Validate `opencode serve` dependency before committing to Phase 1
**Effort:** 2–3 days

- [ ] Run `opencode serve`; confirm HTTP API is stable and documented
- [ ] Confirm JS SDK covers required endpoints
- [ ] Build minimal proof-of-concept SPA embed in a VS Code WebView
- [ ] **Go:** SPA embed approach confirmed; proceed to Phase 1
- [ ] **No-go:** design SDK-only chat UI; no schedule impact on other features

---

### Phase 1 — Foundation
**Goal:** Working extension; profile engine; zero-config; basic scaffolding
**Effort:** 2–3 weeks

- [ ] Skeleton extension activates; lazy loads heavy modules (target < 500ms)
- [ ] Profile Engine: loads `profile.json`; falls back to `doc-lifecycle`; zero-config
- [ ] OpenCode chat panel (SPA embed or SDK-only per Phase 0)
- [ ] `opencode serve` child process management; crash recovery; offline mode
- [ ] Dynamic port assignment
- [ ] "New Document" scaffolding; profile template; git author from `git config user.name`; auto-stage
- [ ] Status bar progress indicator for large workspace scans
- [ ] GitHub Actions CI: lint + typecheck + unit tests + `.vsix` package on push
- [ ] All FOSS hygiene files committed from day one
- [ ] README quickstart (mirrors §3 of this document)
- [ ] Acceptance: install → open folder → "New Proposal" → valid-frontmatter file committed to git; no terminal required

**Deliverable:** Zero-config chat interface + basic scaffolding

---

### Phase 2 — Lifecycle & Wikilinks
**Goal:** Lifecycle-aware document management with cross-document linking
**Effort:** 4–5 weeks
*Note: lifecycle state machine and wikilinks engine are independent tracks; can be
parallelised if a second contributor is available*

- [ ] Documentation Dashboard (vanilla HTML WebView)
- [ ] Frontmatter linter (debounced 300ms; profile schema)
- [ ] Lifecycle state machine + file tree decorations
- [ ] Workspace Index (incremental JSON; save-triggered; lazy initial scan)
- [ ] Profile-specific scaffolding ("New Proposal", "New Device", etc.)
- [ ] Wikilink Engine — `[[autocomplete]]`, go-to, hover, diagnostics
- [ ] Link Updater — inbound links updated on rename/move
- [ ] Broken link / placeholder detection — surfaced in dashboard orphans view
- [ ] Lookup Palette — quick-pick by lifecycle state
- [ ] Naming convention support (profile-driven)
- [ ] `Rebuild Index` command
- [ ] Unit tests: profile engine, state machine, linter, wikilink resolver, workspace index
- [ ] Acceptance: create proposal → wikilink to not-yet-existing plan (placeholder) → create plan → both in dashboard with correct states, decorations, resolved link; no terminal

**Deliverable:** Lifecycle manager with cross-document traceability

---

### Phase 3 — Intelligence & Promote
**Goal:** OpenCode understands the workspace; Promote closes the workflow loop
**Effort:** 4–5 weeks

- [ ] Promote command (full step sequence per §7; idempotent; failure recovery checklist)
- [ ] Backlinks Panel
- [ ] Profile `opencodeInstructions` injected into `.opencode/` on activation
- [ ] OpenCode reads lifecycle state; suggests transitions
- [ ] Dashboard: on-demand AI summaries of pending items (cached)
- [ ] Tag Filter — dashboard filter by `tags`
- [ ] "Commit This Doc" quick action
- [ ] Keyboard shortcuts for all core workflows (see §11)
- [ ] Graph View — `infra-topology` profile only; D3.js force-directed `depends-on`
- [ ] Profile switching via command palette
- [ ] Multi-root workspace: per-root profile + index; aggregated dashboard
- [ ] Integration tests: scaffold → lint → promote → link update → dashboard
- [ ] Acceptance: ask OpenCode "what proposals are pending review?" → correct answer; promote a proposal in one command with all side effects handled

**Deliverable:** AI-native workbench with full lifecycle automation

---

### Phase 4 — Polish & Distribution
**Goal:** General release; both profiles production-quality; community-ready
**Effort:** 4–5 weeks + ongoing

- [ ] Publish to Open VSX marketplace
- [ ] User documentation site (dogfooded with `doc-lifecycle` profile)
- [ ] Demo GIFs in README (one per bundled profile)
- [ ] Content Embedding — `![[note#section]]` transclude
- [ ] Windows + macOS CI validation matrix
- [ ] Accessibility audit: keyboard-only navigation; ARIA labels on WebView elements
- [ ] Profile authoring guide: create, test, share community profiles
- [ ] Second maintainer onboarded — required gate before release
- [ ] Acceptance: unknown user installs, activates profile, creates first doc in < 10 min using only README

**Deliverable:** General release with two production profiles

---

## 15. Testing Strategy

### Unit Tests (Mocha + Chai)

- Profile Engine: valid/invalid/missing load; fallback; schema migration; feature flags; naming convention
- Lifecycle state machine: all valid and invalid transitions per profile
- Frontmatter linter: required/optional fields; debounce; profile schema
- Wikilink resolver: existing; non-existent (placeholder); section; aliased
- Template engine: variable substitution (title, date, author); missing variables; naming convention
- Promote: frontmatter update; rename on/off; link update; staging; idempotency; failure recovery
- Workspace Index: incremental update; full rebuild; large workspace performance

### Integration Tests (`@vscode/test-electron`)

- Profile activation → correct templates, states, features
- Scaffold → correct frontmatter → decorated in tree → in dashboard
- Invalid frontmatter → diagnostic → fix → clears
- Wikilink to missing doc → placeholder → doc created → resolves
- File renamed → all inbound links updated
- Promote → frontmatter + rename + links + staged (both convention states)
- Promote step 3 fails → recovery checklist shown; re-run skips completed steps
- `opencode serve` crash → detected → restarted → chat recovers
- Git checkout detected → full index rebuild

### Acceptance Tests

Each phase gate has a manually-run runbook scenario. Automated progressively.

### Coverage Target

80% line coverage for `src/lifecycle/`, `src/linter/`, `src/wikilinks/`,
`src/profile/`, `src/templates/` by end of Phase 2.

---

## 16. CI/CD & Release

### Pipeline (GitHub Actions)

```yaml
# Triggers: push to main, all PRs
jobs:
  build:
    - ESLint + Prettier
    - TypeScript type-check
    - Unit tests with coverage
    - Package .vsix
    - Upload .vsix as artifact
  integration:            # Phase 2+
    - ubuntu-latest
  matrix:                 # Phase 4+
    os: [ubuntu-latest, macos-latest, windows-latest]
```

### Dependency Management

Dependabot from Phase 1: npm weekly, GitHub Actions monthly. PRs require CI pass +
one maintainer approval.

### Release Process

1. Update `CHANGELOG.md` — Unreleased → new version
2. Bump `package.json`: patch (bugs) / minor (features) / major (breaking profile schema)
3. `git tag v0.x.x && git push --tags`
4. CI packages `.vsix` → attached to GitHub Release automatically
5. `ovsx publish` to Open VSX (manual until Phase 4; automated in Phase 4)

---

## 17. Licensing, Attribution & Governance

### License & Distribution

- **License:** MIT
- **Repository:** `github.com/growlf/docwright` ← canonical home; PROPOSAL.md lives here
- **Distribution:** Open VSX marketplace
- **Telemetry:** None, ever.
- **CLA:** Not required. MIT by PR submission.

### Governance

**BDFL model.** The project creator (NetYeti / growlfd@gmail.com) makes final
decisions on architecture, roadmap, and feature acceptance. All decisions are
documented in `PROPOSAL.md` and `CHANGELOG.md`. Any contributor may raise concerns
or proposals via GitHub Issues. Co-maintainers may be granted merge rights for
non-architectural PRs after Phase 4. The BDFL role may be transferred or expanded
by written agreement if the creator steps back.

This is a FOSS project with no corporate owner. Governance evolves as the community
grows, but decisions are never made opaquely.

### NOTICE.md (draft)

```
OpenCode
  Repository:  https://github.com/sst/opencode  (org: anomalyco)
  Author:      Anomaly Innovations (formerly SST / Serverless Stack)
  License:     MIT

opencode-web-for-vscode
  Repository:  https://github.com/cpkt9762/opencode-web-for-vscode
  License:     MIT

opencode-gui
  Repository:  https://github.com/ktmage/opencode-gui
  License:     MIT

bms-ai-cluster
  Repository:  https://github.com/growlf/bms-ai-cluster
  Author:      NetYeti (growlfd@gmail.com)
  License:     MIT

VSCodium
  Repository:  https://github.com/VSCodium/vscodium
  License:     MIT
```

---

## 18. Comparison with Alternatives

### High-Level

| | docwright | Tauri Desktop App | Obsidian Plugin |
|---|---|---|---|
| **Editor** | Built-in (Monaco) | Must embed | Obsidian's (limited) |
| **Git** | Built-in, mature | Must build | Read-only API |
| **Zero-config** | ✅ | ❌ | ❌ |
| **Profile system** | ✅ | Must build | ❌ |
| **Local LLM** | ✅ | Depends | ❌ |
| **FOSS ethos** | ✅ VSCodium | ✅ Tauri | ❌ proprietary |
| **Time to MVP** | ~3 weeks | ~2 months | Already tried, failed |

### VS Code Ecosystem

| | docwright | Foam | Dendron |
|---|---|---|---|
| **Zero-config** | ✅ | ❌ | ❌ |
| **Lifecycle + automation** | ✅ | ❌ | ❌ |
| **Promote command** | ✅ | ❌ | ❌ |
| **Frontmatter enforcement** | ✅ | ❌ | Partial |
| **AI + local LLM** | ✅ | ❌ | ❌ |
| **Wikilinks / backlinks** | ✅ | ✅ | ✅ |
| **Graph view** | ✅ profile-optional | ✅ always | ✅ always |
| **Multi-root workspaces** | ✅ | ❌ | Partial |
| **Active development** | ✅ | Slow | Stalled |
| **License** | MIT | MIT | AGPL |

---

## 19. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `opencode serve` API unstable | Medium | Critical | Phase 0 spike; SDK-only fallback designed before Phase 1 |
| OpenCode SPA breaks embedding | Medium | High | Pin SPA to release tag; SDK-only fallback ready |
| Profile schema locks in early decisions | Medium | High | `docwrightProfileVersion` from day one; major semver on breaking changes |
| OpenCode abandoned or license change | Low | High | Core features have zero AI dependency; SDK can be forked |
| Scope creep | High | Medium | Strict phase gates; all additions require a phase assignment; Phases 0–1 are inviolably minimal |
| Extension activation performance | Medium | Medium | Lazy loading; target < 500ms; deferred scan |
| Port conflict (multi-window) | Medium | Medium | Dynamic port assignment |
| Single-maintainer bus factor | High | Medium | CONTRIBUTING.md + all decisions documented from Phase 1; second maintainer = Phase 4 gate |
| HTTP server security surface | Low | Low | Binds to `127.0.0.1` only; documented |
| Cross-platform breakage | Medium | Medium | CI matrix in Phase 4; community reports interim |
| Low adoption | Medium | Low | MIT/FOSS — built for ourselves; no adoption pressure |
| Node version on ChromeOS | Low | Low | Extension uses VS Code's own Node; no separate install |
| Promote partial failure leaves inconsistent state | Low | Medium | Step logging + idempotent re-run; recovery checklist shown to user |

---

## 20. Naming

Avoid trademarked terms (VSCode, VSCodium, OpenCode, Visual Studio).

**Recommended:** `docwright`

- "wright" = craftsperson who makes things; short, memorable, no trademark conflicts
- Verify on npm, Open VSX, and GitHub before finalising

**Alternatives:**

| Name | Rationale |
|------|-----------|
| `scriptorium` | Latin for "a place for writing manuscripts" |
| `stagehand` | Lifecycle stages + git staging; double meaning |
| `waymark` | Marker along a journey; maps to state progression |

---

## 21. Document History

| Version | Date | Change | Author |
|---------|------|--------|--------|
| v0.1 | 2026-05-19 | Created | NetYeti (growlfd@gmail.com) @ phoenix |
| v0.2 | 2026-05-19 | Competitor analysis, state persistence, port management, prerequisites, testing, CI/CD, offline mode, configuration, naming, risk table, acceptance criteria, OpenCode attribution | Claude (Anthropic) |
| v0.3 | 2026-05-19 | Profile System as core architecture; bundled profiles; Wikilink Engine, Promote, Backlinks, Lookup, Orphans, Graph, naming convention; daily notes + export pods out of scope | Claude (Anthropic) |
| v0.4 | 2026-05-21 | Phase 0 spike; zero-config story; in-process HTTP server clarification; performance mitigations; local LLM first-class; FOSS hygiene files; best-practices automation as lead value prop; profile schema versioning; minimum install = VSCodium + Git; moved to Drive | Claude (Anthropic) |
| v0.5 | 2026-05-21 | Added §3 Quick Start; §6 Key Design Decisions; §11 Command Registry; template and OpenCode instructions examples; Promote step sequence and failure handling; dashboard event trigger table; multi-root workspace handling; performance targets; BDFL governance; Phase 2 parallelisation note; Promote partial failure risk | Claude (Anthropic) |
| v0.6 | 2026-05-22 | OpenCode Zen / Big Pickle established as primary AI path (with data retention note); self-hosted LLM stacks referenced (`growlf/ai-stack`, `growlf/intel_nuc_skullcanyon_ollama_with_gpu`); `code-review` added as future profile target (inspired by open-code-review, multi-model routing intent documented); `growlf/docwright` confirmed as canonical home; Drive demoted to sharing mirror | Claude (Anthropic) |
| v0.7 | 2026-06-02 | Phase 0 spike results: `opencode serve` serves its own SPA, removing need for in-process HTTP proxy; architecture simplified to direct-URL WebView embed; `@opencode-ai/sdk` added as dependency; `SpaServer.ts` removed from module table | NetYeti (growlfd@gmail.com) @ phoenix |
