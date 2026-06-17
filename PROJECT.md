# docwright — Organizational Operating System for Policy-Driven Teams

> **Status:** v0.3.1 — Phase 3 in-progress — 2026-06-17
> **Repository:** `github.com/growlf/docwright`
> **License:** MIT
> **Roadmap:** See [[docs/roadmap.md]] for current prioritization

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Proposed Solution](#2-proposed-solution)
3. [Quick Start](#3-quick-start)
4. [Why This Architecture](#4-why-this-architecture)
5. [Differentiation](#5-differentiation)
6. [Key Design Decisions](#6-key-design-decisions)
7. [Architecture](#7-architecture)
8. [Profile System](#8-profile-system)
9. [What We Borrow](#9-what-we-borrow)
10. [What We Build](#10-what-we-build)
11. [Command Registry](#11-command-registry)
12. [Configuration](#12-configuration)
13. [Prerequisites & Installation](#13-prerequisites--installation)
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

### The Core Problem

Organizations — especially growing ones — lose institutional memory, repeat decisions,
and fail to connect daily work back to stated values and policy. The gap between
"what we believe" and "what we do" widens as teams grow and context gets siloed.

Ideas get lost. Decisions get un-made. New people re-litigate settled questions.
Work happens without policy grounding. And when someone leaves, their context goes
with them.

**The deeper problem:** most tools address one layer of this — a wiki, a task tracker,
a document editor, an AI chat interface — without connecting them into a governed whole.
The connections between a community's values, its decisions, its plans, and its daily
work are implicit, informal, and fragile.

### The Workflow Gap

**For a non-developer contributor (student, program lead, community partner):**
1. Has an idea or notices an issue
2. Has nowhere obvious to put it that connects to the org's decision process
3. Idea evaporates, or goes into a chat that nobody reads six months later
4. Work happens without grounding — or doesn't happen because nobody knew to start it

**For a developer or technical contributor:**
1. Gets assigned work with no clear policy lineage ("why are we doing this?")
2. Opens a second tool to ask the AI, a third tool to check documentation
3. Makes a decision that contradicts a prior one nobody remembered
4. Commits code with no traceable connection to organizational intent

**With docwright:**
1. Anyone captures an idea via zero-friction inbox (web form, email, CLI, chat)
2. AI triages: surfaces related prior decisions, suggests policy area, drafts linkage
3. Issue → Proposal → Plan → Policy/Decision — each step traceable, AI-assisted, ACL-governed
4. Developer opens VSCodium + docwright extension, sees full context, clicks into OpenCode
5. Work is grounded, auditable, and institutional memory compounds over time

### Tool Gap Analysis

| Tool | Problem |
|------|---------|
| **Wikis (Confluence, Notion)** | No lifecycle enforcement, no policy hierarchy, no AI agency, no git audit trail |
| **Task trackers (Linear, Jira)** | Task-level only — no policy root, no decision records, no knowledge compounding |
| **PKM tools (Obsidian, Logseq)** | Personal or team knowledge only — no lifecycle, no ACL, no org governance model |
| **LLM Wiki implementations** | Personal knowledge accumulation only — no lifecycle, no team, no enforcement |
| **VS Code / VSCodium (vanilla)** | No lifecycle awareness, no structured templates, no AI workflow |
| **Foam / Dendron** | PKM-focused, no lifecycle state machine, no AI agent, no governance |

---

## 2. Proposed Solution

docwright is a **governance layer** for organizations that want policy-grounded,
AI-assisted, auditable decision-making and work management. It is not a single app —
it is an engine that runs across multiple client surfaces:

- **Web UI** — the primary daily-use interface for all contributors, regardless of
  technical background. Rendered Markdown, wikilink navigation, AI chat panel,
  ACL-gated action buttons. Zero technical barrier.
- **VSCodium extension** — the power-user authoring and enforcement environment for
  developers and document stewards. Full lifecycle enforcement, git workflow, OpenCode
  integration, frontmatter validation.
- **Logseq (read-only explorer)** — optional graph exploration for contributors who
  want the visual knowledge graph. Opens the same vault folder. No configuration needed.
- **CLI / inbox adapters** — zero-friction capture: email-to-inbox, web form,
  one-liner CLI, chat bot integration. Ideas land in `/inbox/` as stubs regardless
  of source.

**The files are the system.** All state lives in plain Markdown files with YAML
frontmatter, in a git repository. Every client reads and writes the same files.
No proprietary database. No vendor lock-in. No telemetry.

### Policy as Foundation

Every document in a docwright vault traces back to a Policy. The hierarchy is:

```
Policy (living document — the org's current position)
  ↑ spawned by
Plan (how we achieved or will achieve this policy state)
  ↑ spawned by
Proposal (structured evaluation — informed by research; commits to a direction)
  ↑ spawned by
Research (optional investigation — explores feasibility, alternatives, prior art)
  ↑ spawned by
Issue (triaged observation — something worth examining)
  ↑ captured from
Inbox (raw observations — ideas, annoyances, "what if...?", emails, suggestions)

Parallel output:
Decision (rejection record — "we considered this and here's why we didn't")
Work Items (tasks, services, applications, documentation, code)
  └── Code work items → OpenCode (developer environment)
```

Research is an optional stage — simple or obvious ideas skip directly from Issue to
Proposal. For complex ideas (architectural decisions, new domains, competitive analysis,
feasibility questions) the Research stage is where investigation happens before any
commitment to a solution direction. Research findings persist in the vault; they inform
proposals and prevent re-investigation of already-settled questions.

The AI can always answer: *"what policy grounds this work?"* by walking the tree
upward. New contributors can ask *"have we tried this before?"* and get a grounded
answer with citations to actual org documents, not generic AI output.

### Zero-Friction Capture is the Entry Point

The inbox is the most important feature for organizational health. Ideas that require
tooling knowledge to capture are ideas that never get captured. docwright provides:

- **Web form** — title + paragraph. File created in `/inbox/`. No account needed
  for observers; authenticated for contributors.
- **Email-to-inbox** — a monitored address (configurable) converts incoming email
  to inbox stubs automatically.
- **CLI** — `docwright capture "what if we ran weekend hardware workshops at the library?"`
- **Chat adapter** — Discord/Slack message with trigger word or reaction creates
  an inbox item.
- **VSCodium command** — `docwright: New Inbox Item` for technical contributors.

All methods produce the same stub file. The AI triages it: searches the policy graph
for related prior decisions, suggests a policy area, flags conflicts with existing
policy, and drafts a preliminary linkage for human review.

### The "Why Not" Record is as Valuable as the "Yes"

When a Proposal is evaluated and rejected, a **Decision** document is created.
Not a failed proposal — a deliberate record: what was considered, what was evaluated,
what was concluded, and why. This document is linked from the originating Issue and
from the relevant Policy area.

This is institutional memory. Six months later, when someone raises the same idea,
the AI can surface the prior decision immediately: *"We evaluated this in March.
Here's what we found and why we went a different direction. Still relevant?"*

### AI as First-Class Participant

The AI operates at every level of the hierarchy — not just as a chat assistant,
but as a governed participant in the workflow:

- **Reading:** answer questions about any page in context, with citations to vault documents
- **Triage:** surface related prior decisions when new issues arrive
- **Drafting:** scaffold proposals, plans, and decision records from issues
- **Acting:** update documents, promote lifecycle states, create work items —
  all gated by user ACL and AI Trust tier
- **Institutional memory:** answer "have we done this before?" with grounded evidence

### Partner Org Federation

docwright is designed for organizations that identify and support other communities
with aligned vision. Three federation models are supported:

**Fork model (default):** Partner org gets their own docwright vault, seeded with
your policy templates. They operate independently. Public policy graphs are readable
across orgs. Low coupling, easy to start. Frontmatter: `origin: cascade-steam`.

**Federation model (Phase B+):** Partner orgs can submit Issues/Proposals into
your inbox, and vice versa. The AI cross-references across vaults when answering
questions. Frontmatter: `origin: partner-org-name`, `submitted-to: cascade-steam`.

**Shared vault model (mature partnerships):** Deep alignment, shared vault,
separate policy areas, full ACL model. Highest coupling, most powerful.

### AI Provider Independence

OpenCode supports any OpenAI-compatible endpoint — including locally-running LLMs
via [Meshy](https://github.com/growlf/meshy) or any other local inference stack.
docwright can operate with **no commercial API dependency whatsoever.**

### Bundled Profiles

- `org-operations` — **NEW** — inbox → issue → proposal → plan → policy/decision/work
  (the organizational operating system; default for new orgs)
- `doc-lifecycle` — proposal → plan → completed/canceled (legacy default; developer-focused)
- `infra-topology` — planned → active → decommissioned (network/device/service management)
- `knowledge-base` — LLM Wiki pattern: inbox → compiled → verified → archived

---

## 3. Quick Start

**For a non-developer contributor (Web UI):**
```
Open the docwright web UI → click "Submit an Idea"
Fill in title and description → Submit
Your idea is now in the org's inbox, ready for triage
```

**For a developer (VSCodium):**
```
1. Install
VSCodium → Extensions → Search "docwright" → Install

2. Open your vault folder
The `org-operations` profile activates automatically (or `doc-lifecycle` if no profile.json).

3. Create your first document
Ctrl+Shift+P → "docwright: New Inbox Item"

4. Promote when ready
Ctrl+Alt+Up → "docwright: Promote"
```

**To start a knowledge base:**
```
Ctrl+Shift+P → "docwright: Switch Profile" → knowledge-base
Ctrl+Shift+P → "docwright: Ingest" → select a file from raw/
```

No terminal required for any standard workflow.

---

## 4. Why This Architecture

### The Governance Layer is Editor-Agnostic

The core insight: docwright is **the governance layer**, not an editor. The
frontmatter schema, lifecycle state machine, ACL model, policy-to-work-item
hierarchy, and git audit trail exist independently of any client. Any frontend
that can render Markdown and call an API is a valid docwright client.

This means:
- The VSCodium extension is one client — optimized for technical contributors
  who need git workflow and enforcement power
- The Web UI is another client — optimized for everyone else
- Logseq is a third client (read-only) — optimized for graph exploration
- None of them are "the system" — the vault + governance layer is the system

### Why VSCodium for the Developer Client

| Reason | Detail |
|--------|--------|
| **FOSS** | No Microsoft branding, telemetry, or proprietary marketplace terms |
| **Open VSX** | Full distribution without Microsoft's marketplace restrictions |
| **Full VS Code API** | Every VS Code API works in VSCodium; no forks or shims needed |
| **Built-in git** | Mature staging, diff, branch, commit UI — nothing to build |
| **Built-in markdown** | Native editor + preview + syntax highlighting — nothing to build |
| **Portable** | Linux, macOS, Windows; ChromeOS via Crostini |

### Why a Purpose-Built Web UI for the Primary Interface

VSCodium's Markdown reading UX is fundamentally designed for code editing,
not document navigation. The split-pane model, the absence of first-class
wikilink navigation, and the code-editor aesthetic create friction for
non-developer contributors who will be the majority of docwright users.

The Web UI provides:
- **Rendered Markdown navigation** — click wikilinks, follow the document graph
- **AI chat panel** — context-aware to the current page, with access to the full vault
- **ACL-gated action buttons** — "Promote this Issue", "Draft a Proposal", "Reject with reason"
- **Inbox submission** — zero-friction capture for any contributor
- **"Open in VSCodium"** button — for developers who need the full power tool
- **"Open in OpenCode"** button — for coding work items

The Web UI is a thin layer. It is not a CMS, not a full app rewrite. Core features:
render a page, show backlinks, follow wikilinks, AI chat panel with page context,
ACL-gated action buttons. The vault is the system; the Web UI is a window into it.

### Why Logseq as an Optional Explorer

Logseq opens the same vault folder and provides graph visualization and
outliner navigation that neither VSCodium nor the Web UI needs to replicate.
It's a free addition for contributors who want that experience. It requires
no integration work — the files are already there.

---

## 5. Differentiation

### vs. Organizational Tools

| Capability | docwright | Confluence | Notion | Linear/Jira |
|---|---|---|---|---|
| **Policy-grounded hierarchy** | ✅ | ❌ | ❌ | ❌ |
| **Inbox → Issue → Proposal → Plan → Policy** | ✅ | ❌ | ❌ | ❌ |
| **Decision/rejection records** | ✅ | ❌ | partial | ❌ |
| **AI institutional memory** | ✅ | ❌ | ❌ | ❌ |
| **Git-native audit trail** | ✅ | ❌ | ❌ | ❌ |
| **Local LLM first-class** | ✅ | ❌ | ❌ | ❌ |
| **FOSS / self-hosted** | ✅ | ❌ | ❌ | ❌ |
| **Partner org federation** | ✅ | ❌ | ❌ | ❌ |
| **Zero-friction capture** | ✅ | ❌ | partial | partial |

### vs. VS Code Ecosystem (Foam, Dendron)

| Capability | docwright | Foam | Dendron |
|---|---|---|---|
| **Zero-config activation** | ✅ | ❌ | ❌ |
| **Lifecycle state machine** | ✅ | ❌ | ❌ |
| **Policy hierarchy** | ✅ | ❌ | ❌ |
| **ACL user roles** | ✅ | ❌ | ❌ |
| **Web UI client** | ✅ | ❌ | ❌ |
| **Zero-friction inbox** | ✅ | ❌ | ❌ |
| **AI + local LLM** | ✅ | ❌ | ❌ |
| **Multi-user team git** | ✅ | ❌ | ❌ |
| **Active development** | ✅ | Slow | Stalled |
| **License** | MIT | MIT | AGPL |

### vs. LLM Wiki Implementations

Every project in the Karpathy LLM Wiki ecosystem is a **personal knowledge
accumulation tool**. docwright is fundamentally different:

| Capability | docwright | link | synto | llm-wiki-manager | ΩmegaWiki |
|---|---|---|---|---|---|
| **VSCodium extension** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Web UI client** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Org governance model** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Policy hierarchy** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **ACL user roles** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Lifecycle states** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Git-native auditability** | ✅ | partial | partial | ❌ | ❌ |
| **Multi-user team** | ✅ (Phase A/B) | ❌ | ❌ | ❌ | ❌ |
| **Domain profiles** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 6. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Governance layer is editor-agnostic** | Surface-agnostic dispatch module; no VS Code API deps | Enables VSCodium extension + Web UI + CLI from same codebase |
| **Primary client** | Purpose-built Web UI (thin) | Non-developer contributors are the majority user |
| **Developer client** | VSCodium + docwright extension | Git-native, enforcement-capable, OpenCode-integrated |
| **Dashboard tech stack** | Vanilla HTML + CSS | Smallest bundle, no build step for WebView |
| **Web UI tech stack** | SvelteKit (SSR + SPA; Vite dev server) | Fast, FOSS, SSE live reload, deployable locally or on any Node host |
| **Graph library** | D3.js force-directed | MIT, no framework dependency |
| **Workspace index format** | JSON (`index.json`) | Human-readable, git-diff-friendly, rebuildable |
| **Wikilink disambiguation** | First-match + inline warning | Consistent with Foam |
| **Multi-root workspaces** | One profile and index per root | Avoids cross-root pollution |
| **Promote atomicity** | Write-then-verify, no auto-rollback | Step logging + idempotent re-run |
| **Promote diff minimization** | Frontmatter + rename only | Clean diffs → easy multi-user merges |
| **Dashboard refresh** | Event-driven, no polling | See trigger table in §7 |
| **Extension activation** | Lazy; target < 500ms | Performance |
| **Profile discovery** | Local `.docworkbench/profile.json` only | No remote fetch; no supply-chain risk |
| **Canonical store** | Git | Reliability, security, performance at scale |
| **Dispatch plane** | Surface-agnostic TS module, no VS Code API deps | Enables extension + Web UI + remote node |
| **AI trust level** | Workspace setting, default Safe | Per-instance, not per-domain |
| **AI authorship stamping** | `ai-last-action:` frontmatter field | Auditable in multi-user contexts |
| **OCC for AI writes** | Snapshot mtime → verify → atomic commit | Prevents concurrent edit corruption |
| **Search backend** | `index.json` scan < 200 docs; qmd ≥ 200 docs | Scales without requiring qmd for small wikis |
| **ACL model** | User roles in frontmatter + git branch protection | No external auth system required for v1 |
| **Inbox adapters** | Web form + email + CLI + chat (pluggable) | Zero friction is a hard requirement |
| **Decision records** | First-class document type; linked from Issue and Policy | Institutional memory is a core deliverable |
| **Partner federation** | Fork model default; federation in Phase B+ | Loose coupling first; tighter integration earned |

---

## 7. Architecture

### Client Surfaces

```
┌─────────────────────────────────────────────────────────────────┐
│                        docwright clients                        │
├─────────────────┬───────────────────┬───────────────────────────┤
│   Web UI        │  VSCodium Ext.    │  Logseq (optional)        │
│  (primary)      │  (power users)    │  (graph explorer)         │
│                 │                   │                           │
│ Rendered MD     │ Editor + Preview  │ Graph view                │
│ Wikilink nav    │ Frontmatter lint  │ Backlinks                 │
│ AI chat panel   │ Git workflow      │ Outliner                  │
│ ACL buttons     │ Promote command   │ (read-only recommended)   │
│ Inbox form      │ OpenCode panel    │                           │
│ "Open in VSC"   │ "Open in OC"      │                           │
└────────┬────────┴─────────┬─────────┴──────────────────────────┘
         │                  │
         └──────────────────┘
                   │
         ┌─────────▼─────────┐
         │  docwright engine  │   ← the governance layer
         │  (dispatch module) │
         │  surface-agnostic  │
         │  no VS Code API    │
         ├────────────────────┤
         │  ProfileEngine     │
         │  WorkspaceIndex    │
         │  FrontmatterLinter │
         │  TemplateEngine    │
         │  PromoteCommand    │
         │  WikilinkEngine    │
         │  LLMWikiEngine     │
         │  ACLController     │   ← NEW
         │  InboxAdapters     │   ← NEW
         │  AIDispatch        │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  Markdown files    │
         │  (git repo on disk)│
         │                    │
         │  /inbox/           │
         │  /issues/          │
         │  /proposals/       │
         │  /plans/           │
         │  /policies/        │
         │  /decisions/       │
         │  /work/            │
         │  /archive/         │
         └────────────────────┘
```

### Inbox Adapter Layer

```
Email → inbox adapter ──┐
Web form ───────────────┤
CLI capture ────────────┼──→ /inbox/INX-{id}.md (stub)
Chat bot ───────────────┤         ↓
VSCodium command ───────┘    AI triage
                             (policy match, prior decisions,
                              conflict detection, draft linkage)
                                  ↓
                             /issues/ISS-{id}.md
```

### ACL User Role Model

| Tier | Who | Read | Submit Inbox | Create Issues/Proposals | Promote | Edit Policy | Configure |
|------|-----|------|--------------|------------------------|---------|-------------|-----------|
| **Observer** | Public, community | Published policies only | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Contributor** | Students, active members | All non-restricted | ✅ | ✅ | With review | ❌ | ❌ |
| **Steward** | Program leads, experienced contributors | All | ✅ | ✅ | ✅ | Draft only | ❌ |
| **Governance** | Leadership | All | ✅ | ✅ | ✅ | ✅ | ✅ |

Implementation: `author-role:` frontmatter field + git branch protection rules.
No external auth system required for Phase A/B. OAuth integration in Phase C+.

### AI Trust & Safety Tiers (unchanged from v0.7)

| Tier | Setting | What AI can do |
|------|---------|----------------|
| 🟢 **Safe** | `"safe"` (default) | Read, answer, suggest — **no file writes** |
| 🟠 **Augmented** | `"augmented"` | Add metadata fields, create placeholders, append to log — **no prose edits** |
| 🔥 **Surgeon** | `"surgeon"` | Edit document body — **strictly opt-in per workspace** |

Note: AI Trust tiers govern what the AI can write. User ACL tiers govern what
a human user can do. These are orthogonal axes.

### VSCodium Window Layout (unchanged from v0.7)

```
VSCodium Window
│
├── [Activity Bar] ──────────── docwright icon
│
├── [Side Bar: Dashboard] → BUILD (profile-aware)
│   ├── Lifecycle summary (counts per state)
│   ├── Pending / attention-needed
│   │   ├── Docs awaiting state transition
│   │   └── Orphans (no inbound or outbound links)
│   │       └── Broken / placeholder wikilinks
│   ├── Recent documents (last 10 modified)
│   └── Quick actions (scaffold, promote, ingest, lint, commit)
│
├── [Editor Area] ──────────────────────────── → BORROW (VSCodium)
│   ├── Markdown editor + split preview
│   ├── Frontmatter syntax highlighting
│   ├── Wikilink [[autocomplete]] + navigation
│   └── Git diff view
│
├── [Side Bar: OpenCode Chat] ──────────────── → BORROW + INTEGRATE (optional)
│   └── OpenCode web UI via in-process HTTP server
│
└── [Panel: Git] ──────────────────────────── → BORROW (VSCodium)
    ├── Changes / staged / unstaged
    ├── Commit message + button
    └── Branch / sync status
```

### Headless Dispatch Plane (unchanged from v0.7)

The mutation layer is a **surface-agnostic dispatch module** with no VS Code API
dependencies. Runs identically in three contexts:

1. **Extension host** — interactive use (today)
2. **Standalone Node process** — CLI or test harness
3. **Remote node / team daemon** — called over HTTP/MCP (Phase B+)

### Dashboard Refresh Triggers (unchanged from v0.7)

| Event | Action |
|-------|--------|
| File saved | Rescan frontmatter; update index entry; refresh dashboard |
| File created | Add to index; refresh lifecycle summary |
| File deleted | Remove from index; refresh all panels |
| File renamed | Update index key; trigger Link Updater |
| `.git/HEAD` changes | Full index rebuild |
| Profile switch | Full index rebuild |
| Ingest completes | Refresh knowledge-base dashboard panels |
| Lint completes | Surface findings in dashboard |

### Performance (unchanged from v0.7)

| Concern | Mitigation |
|---------|------------|
| Frontmatter scanning on keystroke | Linter debounced 300ms |
| Large workspace initial scan | Deferred post-activation; progress in status bar |
| Dashboard re-render rate | Event-driven, batched on rapid changes |
| Wikilink resolution at scale | Index built at activation; incremental on change |
| Extension activation time | Lazy loading; target < 500ms |
| AI context size | Hierarchical summaries; full content only on explicit request |
| Search at scale (≥200 docs) | qmd backend with hybrid BM25+vector+LLM reranking |

---

## 8. Profile System

Profiles define everything domain-specific. The core engine handles structured
markdown, frontmatter, a generic state machine, wikilinks, a workspace index, and
a dashboard. Profiles snap on top.

### Profile Directory Structure (unchanged from v0.7)

```
.docworkbench/
├── profile.json           → profile manifest (versioned)
├── schema.json            → frontmatter JSON Schema
├── opencode-instructions.md  → domain AI context
├── daemon.json            → shared daemon trust config (gitignored; default: safe)
├── templates/
│   └── [type].md          → scaffolding templates
└── index.json             → workspace cache (gitignored)
```

### Bundled Profiles

#### `org-operations` (NEW — recommended default for organizations)

The organizational operating system. Policy as the foundation of all work.

| Setting | Value |
|---------|-------|
| Document types | `inbox`, `issue`, `proposal`, `plan`, `policy`, `decision`, `work-item` |
| Policy states | `draft → active → superseded / archived` |
| Proposal states | `inbox → triaged → evaluated → accepted / rejected` |
| Plan states | `draft → active → completed / canceled` |
| Issue states | `inbox → triaged → resolved / declined` |
| Decision states | `draft → final` (rejection records; immutable once final) |
| Work item states | `backlog → active → done / canceled` |
| Required frontmatter | `type`, `status`, `created`, `author`, `author-role` |
| Optional frontmatter | `parent`, `policy-area`, `tags`, `origin`, `ai-last-action` |
| Features | wikilinks: on, graph: on, naming: on, LLM Wiki: off |
| Templates | `inbox.md`, `issue.md`, `proposal.md`, `plan.md`, `policy.md`, `decision.md`, `work-item.md` |
| AI instructions | policy-aware triage, prior-decision retrieval, institutional memory queries |

**Directory structure:**
```
/inbox/          ← zero-friction capture (stubs; auto-timestamped)
/issues/         ← triaged observations (reference parent inbox item)
/proposals/      ← structured evaluations (reference parent issue)
/plans/          ← actionable plans (reference parent proposal)
/policies/
  /core/         ← mission, vision, values, governance
  /operational/  ← finance, partnerships, process
  /program-areas/ ← domain-specific policies
/decisions/      ← rejection records (reference parent proposal + policy area)
/work/
  /tasks/        ← discrete work items
  /services/     ← running services
  /applications/ ← built applications
  /docs/         ← reference documentation
/archive/        ← superseded/completed documents
```

**Frontmatter examples:**

Inbox item (stub — zero-friction capture):
```yaml
---
type: inbox
status: new
created: 2026-06-01
origin: web-form
author: anonymous
---
What if we ran weekend hardware workshops at the library?
```

Issue (triaged):
```yaml
---
type: issue
status: triaged
created: 2026-06-01
parent: inbox/INX-2026-06-01-001.md
policy-area: program-areas/tech-literacy.md
author: student-contributor
author-role: contributor
ai-last-action: triage 2026-06-01 docwright v0.1.0
---
```

Decision (rejection record):
```yaml
---
type: decision
status: final
created: 2026-06-15
parent-proposal: proposals/PRP-2026-06-003.md
policy-area: program-areas/tech-literacy.md
outcome: declined
author: governance-lead
author-role: governance
---
## Decision

We evaluated the proposal to partner with vendor X for hardware procurement.

## Reasoning

The vendor's licensing terms conflict with our FOSS-first policy (see
[[policies/core/values.md]]). The cost savings (estimated 15%) do not
justify the lock-in risk for a community that depends on long-term
hardware serviceability.

## Related

- [[proposals/PRP-2026-06-003.md]] — originating proposal
- [[policies/core/values.md]] — policy consulted
- [[issues/ISS-2026-05-047.md]] — originating issue
```

**OpenCode instructions (org-operations profile):**
```markdown
You are the AI participant in a policy-driven organizational operating system.

Your responsibilities:
- When triaging an inbox item: search the policy graph for related prior
  decisions, identify the relevant policy area, flag conflicts with existing
  policy, draft a preliminary linkage for human review.
- When queried about any document: answer with citations to vault documents.
  Always trace lineage upward: work item → plan → proposal → policy.
- When asked "have we done this before?": search decisions/ and proposals/ for
  related prior evaluations. Surface them with links and summaries.
- When asked to act (promote, draft, reject): verify user ACL tier before
  proceeding. Governance tier required for policy edits.
- Always add ai-last-action frontmatter to pages you create or modify.
- Append to wiki/log.md after each operation.

Policy areas: check /policies/program-areas/ to understand the org's domains.
Prior decisions: check /decisions/ before drafting any new proposal on a topic.
Institutional memory: the vault is the org's brain. Treat it as such.

Workspace trust level: respect docworkbench.aiTrustLevel at all times.
```

#### `doc-lifecycle` (original default — developer-focused)

| Setting | Value |
|---------|-------|
| States | `proposal → plan → completed / canceled` |
| Required frontmatter | `title`, `status`, `created`, `author` |
| Features | wikilinks: on, graph: off, naming: off, LLM Wiki: off |
| Templates | `proposal.md`, `plan.md`, `sop.md` |

#### `infra-topology`

| Setting | Value |
|---------|-------|
| States | `planned → active → decommissioned` |
| Required frontmatter | `title`, `type`, `status`, `hostname` |
| Features | wikilinks: on, graph: on (D3.js force-directed), naming: on (dot-prefix), LLM Wiki: off |
| Templates | `device.md`, `service.md`, `network-segment.md` |

#### `knowledge-base` (NEW in v0.7)

Implements the [Karpathy LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
with docwright's governance layer. Page taxonomy adapted from
[gowtham0992/link](https://github.com/gowtham0992/link) (MIT).

| Setting | Value |
|---------|-------|
| States | `inbox → compiled → verified → archived` (source pages only) |
| Page types | `source`, `concept`, `entity`, `comparison`, `exploration` |
| Required frontmatter | `title`, `type`, `status` (for sources) |
| Optional frontmatter | `tags`, `confidence`, `aliases`, `source_url`, `ai-last-action` |
| Features | wikilinks: on, graph: on, naming: off, LLM Wiki: **on** |
| Templates | `source.md`, `concept.md`, `entity.md`, `comparison.md`, `exploration.md` |
| Commands | Ingest, Lint, Save to Wiki (in addition to all standard commands) |
| Search | qmd backend auto-enabled at ≥200 docs |

**Directory structure:**
```
wiki/
├── index.md        → master catalog (AI-maintained)
├── log.md          → append-only operation log (AI-maintained)
├── sources/        → one summary page per ingested source
├── concepts/       → concept/topic articles
├── entities/       → people, orgs, projects, tools
├── comparisons/    → side-by-side analyses
└── explorations/   → filed-back query results (Save to Wiki)

raw/                → immutable source documents (human adds; AI reads only)
```

### Profile Switching

`Ctrl+Shift+P` → `docwright: Switch Profile`. Engine reloads without restarting the
extension host. Index rebuilds for the new glob pattern.

### Profile Security Note

Profiles live in the user's own repository — they are not fetched remotely. Treat
profile files from untrusted sources the same as any other code you clone.

---

## 9. What We Borrow

### Foundational Reference

**Karpathy LLM Wiki pattern**
- URL: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Author: Andrej Karpathy
- License: no explicit license — credited as foundational reference
- Contribution to docwright: the compounding-knowledge architecture (Ingest/Query/Lint
  operations, raw/wiki/schema three-layer model, index.md + log.md navigation pattern,
  "file back valuable answers as wiki pages" principle). This gist catalyzed the
  `knowledge-base` profile and the LLMWikiEngine module. It is the reason docwright
  is more than a structured document tool — it is also a governed knowledge base.
- Why docwright is different from all other implementations: lifecycle states,
  frontmatter enforcement, Promote command, git-native auditability, team collaboration,
  and a profile system that makes the pattern domain-agnostic. Every other implementation
  is personal-only, editor-agnostic, and has no governance layer.

### LLM Wiki Ecosystem (all MIT)

| Component | Source | URL | Contribution |
|-----------|--------|-----|--------------|
| **Page taxonomy** | gowtham0992/link | https://github.com/gowtham0992/link | source/concept/entity/comparison/exploration folder structure; YAML frontmatter templates for each type; `_backlinks.json` reverse-link pattern; `confidence:` field |
| **Operation taxonomy** | sametbrr/llm-wiki-manager | https://github.com/sametbrr/llm-wiki-manager | Formal operation names: bootstrap, ingest, query, update, lint, route — used as slash commands in knowledge-base OpenCode instructions |
| **Team folder taxonomy** | eslamgenio/long-term-agent-memory | https://github.com/eslamgenio/long-term-agent-memory | decisions/procedures/concepts/entities/analyses/inbox structure — informs knowledge-base profile design |
| **qmd search** | tobi/qmd | https://github.com/tobi/qmd | Optional search backend (MIT, 16.5k stars); hybrid BM25+vector+LLM reranking, all on-device; CLI + MCP server interfaces; auto-enabled at ≥200 docs |

### Architecture References (Apache-2.0)

| Component | Source | URL | Contribution |
|-----------|--------|-----|--------------|
| **Dispatch architecture** | matryca-plumber | https://github.com/MarcoPorcellato/matryca-plumber | Three-surface / shared dispatch plane; surface-agnostic mutation layer pattern |
| **Trust & Safety tiers** | matryca-plumber | — | Safe/Augmented/Surgeon AI write tier model |
| **OCC two-layer model** | matryca-plumber | — | Snapshot-mtime + per-file lock pattern for AI background writes |
| **AI authorship stamping** | matryca-plumber | — | `ai-last-action:` frontmatter pattern |
| **Context Acceleration** | matryca-plumber | — | Hierarchical summaries for large workspace AI context |
| **AGENTS.md as repo artifact** | matryca-plumber | — | Motivation for AGENTS.md in docwright |

> matryca-plumber is Apache-2.0. Patterns borrowed, not code. NOTICE.md must credit
> the repo and list the specific patterns adopted.

### VS Code Ecosystem (MIT)

| Component | Source | Contribution |
|-----------|--------|--------------|
| **OpenCode Web SPA** | sst/opencode | Serve via in-process HTTP server |
| **SPA proxy technique** | cpkt9762/opencode-web-for-vscode | In-process HTTP server pattern |
| **OpenCode JS SDK** | sst/opencode | Session management and prompts |
| **opencode-gui patterns** | ktmage/opencode-gui | WebView embedding reference |
| **Markdown editor + preview** | VSCodium built-in | Native editing and preview |
| **Git integration** | VSCodium built-in | Decorations, diff, staging, commits |
| **Frontmatter patterns** | growlf/bms-ai-cluster | Schema rules; lifecycle model |

---

## 10. What We Build

### Core Engine Modules

| Module | Purpose |
|--------|---------|
| **Profile Engine** | Loads manifest; schema migration; profile switching |
| **Dispatch Module** | Surface-agnostic mutation layer; no VS Code API dependencies |
| **Documentation Dashboard** | Sidebar WebView (vanilla HTML): lifecycle summary, pending, orphans, recent |
| **Lifecycle State Machine** | Generic; driven by profile config |
| **Workspace Index** | Incremental JSON cache; rebuilt from frontmatter |
| **Frontmatter Linter** | `DiagnosticCollection`; debounced 300ms |
| **Template Engine** | Variable substitution (title, date, author from git) |
| **Scaffolding Commands** | "New [type]" per profile template; auto-stages |
| **OpenCode Server Manager** | Spawns `opencode serve`; crash recovery; remoteDispatch fallback |
| **In-Process HTTP Server** | Serves SPA + proxies `/api/*` |
| **OpenCode Config Writer** | Writes `opencodeInstructions` to `.opencode/` on activation |
| **Remote Dispatch Client** | Routes AI operations to remoteDispatch URL; fallback logic |
| **Settings Module** | Typed `vscode.workspace.getConfiguration` wrapper |
| **ACL Controller** | Enforces user role tier; gates promoted actions and AI writes | ← NEW |
| **Inbox Adapters** | Web form handler, email-to-inbox, CLI, chat webhook | ← NEW |
| **Web UI Server** | Lightweight local server serving the Web UI client | ← NEW |

### Feature Modules (profile-gated)

| Module | Purpose | Default |
|--------|---------|---------|
| **Wikilink Engine** | `[[link]]` autocomplete, go-to, hover, diagnostics | Both lifecycle profiles: on |
| **Link Updater** | Updates all inbound wikilinks on rename/move | Both: on |
| **Backlinks Panel** | All docs linking to current file | Both: on |
| **_backlinks.json Maintainer** | Keeps reverse-link index current | Both: on |
| **Orphans View** | No-inbound-link docs; broken links | Both: on |
| **Promote Command** | Atomic next-state transition | Both: on |
| **Lookup Palette** | Quick-pick by lifecycle state | Both: on |
| **Tag Filter** | Dashboard filter by `tags` field | Both: on (Phase 4) |
| **Graph View** | D3.js force-directed topology | doc-lifecycle: off; infra-topology: on; knowledge-base: on; org-operations: on |
| **Content Embedding** | `![[note#section]]` transclude | Both: off (Phase 5) |
| **AI Trust Controller** | Enforces trust tier; gates all AI writes | All profiles: on |
| **LLM Wiki Engine** | Ingest / Lint / Save-to-Wiki operations | knowledge-base: on; others: off |
| **qmd Search Client** | Routes search to qmd when ≥200 docs | knowledge-base: auto |
| **ACL Controller** | Enforces user role; gates actions by tier | org-operations: on; others: advisory |
| **Inbox Adapters** | Web form, email, CLI, chat capture | org-operations: on |

### FOSS Hygiene Files

| File | Purpose |
|------|---------|
| `CHANGELOG.md` | Keep a Changelog format |
| `SECURITY.md` | Vulnerability reporting |
| `CONTRIBUTING.md` | PR process, code style, test requirements, profile authoring guide |
| `NOTICE.md` | Attribution for all borrowed components |
| `AGENTS.md` | What OpenCode knows about the docwright repo when working ON docwright |
| `CODEOWNERS` | Per-path review requirements |
| `.github/ISSUE_TEMPLATE/` | Bug, feature, profile submission templates |
| `.github/PULL_REQUEST_TEMPLATE.md` | Checklist |
| `.github/dependabot.yml` | npm weekly, GitHub Actions monthly |

---

## 11. Command Registry

| Display Name | Command ID | Keybinding | Phase |
|---|---|---|---|
| New Document | `docwright.new` | — | 1 |
| New Inbox Item | `docwright.newInbox` | `Ctrl+Alt+N` | 1 |
| New Proposal | `docwright.newProposal` | `Ctrl+Alt+P` | 1 |
| New Plan | `docwright.newPlan` | `Ctrl+Alt+L` | 2 |
| New SOP | `docwright.newSop` | — | 2 |
| **New Issue** | `docwright.newIssue` | — | 2 |
| **New Decision** | `docwright.newDecision` | — | 2 |
| **New Policy** | `docwright.newPolicy` | — | 2 |
| Promote | `docwright.promote` | `Ctrl+Alt+Up` | 3 |
| Lookup by State | `docwright.lookup` | `Ctrl+Alt+F` | 2 |
| Open Dashboard | `docwright.openDashboard` | — | 1 |
| Switch Profile | `docwright.switchProfile` | — | 3 |
| Rebuild Index | `docwright.rebuildIndex` | — | 2 |
| Open OpenCode Chat | `docwright.openChat` | `Ctrl+Alt+C` | 1 |
| Commit This Doc | `docwright.commitDoc` | — | 3 |
| Set AI Trust Level | `docwright.setTrustLevel` | — | 3 |
| **Ingest** | `docwright.ingest` | `Ctrl+Alt+I` | 3 |
| **Lint Wiki** | `docwright.lint` | — | 3 |
| **Save to Wiki** | `docwright.saveToWiki` | `Ctrl+Alt+S` | 3 |
| **Rebuild Backlinks** | `docwright.rebuildBacklinks` | — | 2 |
| **Triage Inbox** | `docwright.triageInbox` | — | 3 |

Commands marked **bold** are new or updated in v0.8.

---

## 12. Configuration

### VS Code Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `docworkbench.profileDir` | `.docworkbench/` | Profile directory |
| `docworkbench.builtinProfile` | `"org-operations"` | Fallback if no `profile.json` |
| `docworkbench.opencodePort` | `4096` | Base port for `opencode serve` |
| `docworkbench.autoStageOnCreate` | `true` | Auto-`git add` on scaffold |
| `docworkbench.autoStageOnPromote` | `true` | Auto-`git add` on Promote |
| `docworkbench.aiTrustLevel` | `"safe"` | `"safe"` \| `"augmented"` \| `"surgeon"` |
| `docworkbench.remoteDispatch.url` | `""` | Remote AI node URL |
| `docworkbench.remoteDispatch.token` | `""` | Auth token (VS Code secret storage) |
| `docworkbench.searchBackend` | `"auto"` | `"auto"` \| `"index"` \| `"qmd"` |
| `docworkbench.qmdPath` | `""` | Path to qmd binary (auto-detected if empty) |
| `docworkbench.llmWikiRawDir` | `"raw/"` | Raw sources directory (knowledge-base profile) |
| `docworkbench.llmWikiSearchThreshold` | `200` | Doc count at which qmd backend activates |
| `docworkbench.webUI.port` | `7432` | Port for local Web UI server |
| `docworkbench.webUI.enabled` | `true` | Launch Web UI server on activation |
| `docworkbench.inbox.emailAddress` | `""` | Email address for inbox adapter (optional) |
| `docworkbench.inbox.webhookSecret` | `""` | Shared secret for chat webhook adapter |

---

## 13. Prerequisites & Installation

### User Must Have Installed

| Dependency | Minimum | Notes |
|------------|---------|-------|
| **VSCodium** | 1.85+ | Or VS Code 1.85+ |
| **Git** | Any recent | Required for all git integration |
| **opencode** | Latest stable | `npm i -g opencode-ai@latest` — optional; all non-AI features work without it |
| **qmd** | Latest | `brew install qmd` or from https://github.com/tobi/qmd — **optional**; auto-enabled at ≥200 docs in knowledge-base profile |
| **AI provider** | — | Any OpenAI-compatible endpoint; local LLMs fully supported |

> **Minimum viable install: VSCodium + Git.** Every feature except AI works immediately.

### Web UI Additional Options

The Web UI server runs locally on `localhost:7432` by default. For team deployment,
it can be served from any static host with the docwright backend accessible.
Docker deployment guide in Phase 4 documentation.

### Graceful Degradation

| Missing component | Effect |
|---|---|
| opencode not installed | Chat shows setup prompt; all non-AI features work |
| qmd not installed | Index scan used regardless of doc count; dashboard note suggests install |
| AI provider unreachable | Chat shows error; all non-AI features work |
| remoteDispatch unreachable | Falls back to local OpenCode; logs warning |
| No `profile.json` | `org-operations` activates automatically |
| Web UI server fails | VSCodium extension continues normally; Web UI unavailable |

---

## 14. Phased Delivery

> **Note on phase numbering.** The original plan was extension-first; reality went
> Web UI-first. The phases below reflect the actual build order and the forward
> trajectory from where we are today. No content has been removed — all deliverables
> have been redistributed to the phase where they belong.

---

### Phase 0 — Spike ✅ Complete

**Goal:** Validate `opencode serve` HTTP API feasibility before committing to the
Web UI path.

- [x] Confirm `opencode serve` HTTP API is stable and documented
- [x] Confirm JS SDK covers required endpoints
- [x] Build minimal SPA embed proof-of-concept
- [x] **Decision:** go with Web UI as primary client; VSCodium extension deliberately
      deferred until after alpha validation by real users

---

### Phase 1 — Web UI Prototype ✅ Complete (v0.2.x)

**Goal:** Functional SvelteKit Web UI with full lifecycle management, AI integration,
governance enforcement, and containerized deployment. The VSCodium extension was
deliberately deferred here in favour of validating the Web UI first.

**Key pivot from original plan:** Phase 0 confirmed the Web UI should be the primary
client. Phase 1 built it end-to-end rather than starting with the VSCodium extension.

- [x] SvelteKit scaffold — dark theme layout, collapsible file tree sidebar
- [x] Markdown rendering (markdown-it) with TOC anchors, wikilinks
      (`[[path]]`, `[[path#section]]`, `[[path|alias]]`)
- [x] 3-mode editor: preview / WYSIWYG / source (turndown + contenteditable)
- [x] CRUD + rename + delete with toast notifications and git undo
- [x] SSE live reload (`/api/watch`) — auto-refresh tree + page on file change
- [x] Proposal templating system (sidebar + UI button)
- [x] Document properties pane (frontmatter form, action buttons, mode-aware)
- [x] Sidebar polish: docs/all-files toggle, hidden archived dirs, context-aware +
- [x] Vault status page (`/status`) with SSE refresh — default home page
- [x] Smart 404: moved-document redirect + not-found inline state
- [x] Collation: multi-signal relationship engine (Jaccard + tag + phase + author +
      wikilink co-occurrence), related-proposals panel, relationship types
- [x] Lifecycle compliance: pre-commit gate, MCP server, Claude Code hook
- [x] Project registry + vault switching (multi-vault support)
- [x] Git controls panel (stage, commit, undo)
- [x] Containerization (Docker compose; DOCWRIGHT_ROOT env var)
- [x] OpenCode chat panel (direct + proxy modes; SSE streaming)
- [x] Dispatch module (surface-agnostic TypeScript; no VS Code API)
- [x] Plan critique skill (`scripts/critique-plan.js` + `.claude/skills/critique-plan.md`)
- [x] Plan step enforcement (⏳/✅ tracking, tests_defined gate, ▶ Run Tests button)
- [x] Lifecycle gates (phase sign-off, AI pre-review, multi-reviewer quorum, time-based;
      gate_reviewer, gate_status, gate_note frontmatter)
- [x] Proposal relationship engine and Plan → button (collation-to-plan flow)
- [x] Rename document (inline rename in file tree)
- [x] Session shutdown automation (endsession skill)
- [x] Cross-tool compatibility (Claude Code + OpenCode skills, governance parity,
      sync-claude-skills.ts, agent role contract)
- [x] Isolate MCP instances per project (DOCWRIGHT_ROOT scoping)
- [x] Mobile-friendly and responsive layout
- [x] AI proposal improvement (fillProposal, critiqueDocument, ✨ Improve button,
      ImprovementPanel, on-save trigger for new proposals)
- [x] AI plan review (⚡ Review button on draft plans, PlanReviewPanel, adversarial
      critique via OpenCode session API, Write to Plan)
- [x] Phase 2 UI Polish Bundle: full-text vault search, tag browser + tag index,
      keyboard shortcuts, theme picker foundation, navigation improvements
- [x] GitHub Actions CI: lint + typecheck + unit tests, Docker build + health check
      (ci.yml; triggered on v0.x.x tags and workflow_dispatch per versioning policy)
- [x] Git push + tagging UI: annotated tag creation, push, CI watch panel (SSE),
      `npm run release:tag` script; v0.x.x policy enforced at API layer
- [x] CI/CD build monitoring: PostToolUse hook (Claude Code), behavioral rule
      (OpenCode), `/api/git/ci-watch` SSE endpoint streaming live run status

---

### Phase 2 — Foundation & Methodology ✅ Complete (v0.3.x)

**Goal:** Establish the research-stage methodology, engineering foundation (TypeScript
MCP, CI, FOSS hygiene), profile engine runtime, and inbox capture.

- [x] Research stage (`research/` directory, schema, lifecycle states, collation `informed-by`)
- [x] TypeScript MCP server (replaced Python `mcp-server.py`)
- [x] GitHub Actions CI (ci.yml; v0.x.x tags + workflow_dispatch)
- [x] FOSS hygiene (`CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `NOTICE.md`, `AGENTS.md`, `.github/` templates)
- [x] Dispatch module CI (zero VS Code API symbols verified)
- [x] Profile engine runtime: load/validation, `profile.json` override merge
- [x] **Policy Atom Framework** — `policy-atoms-core` library, 10 governance atoms,
      `DOCWRIGHT_ATOM_ROUTING` coexistence shim, manager/project separation, hook stubs
      (`OrgSourceHook`, `JudgmentDispatchHook`), `npm run atoms:check`, isolation CI gate
- [x] **AI Task Category Taxonomy** Steps 1–2 — `AiCategory` extended to 6 values
      (`coding`, `agentic`), `categories.yaml` registry, routing tables
- [x] **Plan completion gate enforcement** — `checkCompletionGate` recognizes
      `### Gate Criteria`; `tests_human_reviewed` gates completion; Complete button
      shows blockers client-side
- [x] **Vault adoption tooling** — `npm run adopt` (lightweight/full/upgrade), `npm run open`,
      three-surface skills bridge (Claude Code, OpenCode, Gemini CLI), `npm run build:atoms`,
      `npm run migrate:mode-field`, `npm run atoms:check`
- [x] Executor heartbeat events (no more silent Execute panel during BigPickle sessions)
- [x] Atomic plan generation at approval (`approve-proposal/plan-generator.ts`)
- [x] `mode:` field accepted by linter/pre-commit (`mentor/guided/autonomous`); all 58 plans migrated

---

### Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (Current — 6/11 done)

**Goal:** Deploy DocWright against an external vault (non-profit MSP pilot), establish
the clean tool/vault separation architecture, and create a structured feedback pipeline
so real-world usage drives DocWright's evolution. See [[plans/phase-vault-portability-pilot.md]].

**Gate to close Phase 3:** MSP pilot vault (step 8) and Cascade STEAM early-access
(step 9) are the real-world validation milestones. Both sub-plan proposals are unapproved —
approving them is the immediate next action. See [[docs/roadmap.md]].

- [x] TypeScript MCP server with `--mode` flag (vault / upstream)
- [x] Vault portability foundation (no hardcoded paths, `DOCWRIGHT_PATH` env var)
- [x] `docwright init` scaffold (`npm run init`)
- [x] Profile override merge engine
- [x] Vault migration system (`MIGRATION.md` + `npm run vault:migrate`)
- [x] `docwright adopt` (lightweight/full/upgrade modes) — DAFO + bms-ai-cluster validated
- [ ] Contribution pipeline & friction log (`sub-plan-contribution-pipeline` — in-progress)
- [ ] MSP pilot vault — real-world non-profit governance test (**next: approve sub-plan-msp-pilot-vault**)
- [ ] Cascade STEAM early-access vault (**next: approve sub-plan-cascade-steam-early-access**)
- [ ] Friction log tooling (MCP tool `log_friction`)
- [ ] Architecture boundary document (substantially covered by `docs/vault-portability.md`)

---

### Phase 4 — Profile Engine, ACL & Research AI Tooling

**Goal:** Full profile system runtime, Forgejo ACL integration, vault-wide wikilink
index, AI-native research tooling, and governance atom integration.

**Note on AI:** Core AI features (✨ Improve, ⚡ Plan Review, chat panel, fillProposal,
critiqueDocument) shipped in Phase 1. Phase 4 AI work is governance atom integration,
routing, and research-stage tooling.

**Already delivered in Phase 4 (during Phase 3 close-out):**
- [x] Policy Atom Framework — complete (moved forward from Phase 4 to unblock governance work)
- [x] AI Task Category Taxonomy Steps 1–2 — `AiCategory` 6 values + `categories.yaml`
- [x] Plan completion gate enforcement — `checkCompletionGate`, `tests_human_reviewed`, client-side Complete button blockers
- [x] `mode:` field canonical — linter + pre-commit, all 58 plans migrated

**Remaining Phase 4 work:**

#### Profile & ACL
- [ ] Profile engine: full runtime load/validation, schema migration, template resolution,
      profile switching via UI
- [ ] Forgejo team membership API → ACL enforcement (`author-role:` field as audit record;
      Forgejo membership as enforcement source)
- [ ] OpenCode instructions per profile (`opencode-instructions.md`) — system prompt
      injected on session start; embeds core philosophy.
      (`org-operations` already has this; pending for `doc-lifecycle`, `knowledge-base`,
      `infra-topology`)

#### Vault-Wide Index
- [ ] Vault-wide backlink index (`_backlinks.json`) — rebuilt on document changes
- [ ] Wikilink back-reference updating on rename (atomic git commit)
- [ ] Contributor name autocomplete in properties pane (Forgejo team membership source)
- [ ] Related docs UX improvements: score threshold, explicit `related_to` shown first,
      acknowledgement state, "Why related?" keyword explanation, suppress on
      frontmatter-only saves

#### Research Stage Phase 4 Tooling
- [ ] AI-assisted research sessions: opening research doc injects `question` + findings
      as chat context; "Save findings" action writes back to document body
- [ ] Research → proposal generation: "Create Proposal" from concluded research doc,
      pre-fills from `question`, findings, `conclusion`; sets `related_to`
- [ ] Multi-perspective research: parallel model review applied to research questions
- [ ] ✨ Improve button for research documents (synthesis of scattered notes)

#### Additional
- [ ] Graph view: lifecycle graph (proposals → plans → completed) + tag-filter mode
- [ ] `qmd` integration: auto-detect, threshold-based backend switch (≥200 docs),
      MCP + CLI modes
- [ ] Triage Inbox: AI-assisted prior-decision search, policy area suggestion

---

### Phase 5 — Advanced Features & Feature Bundles

**Goal:** Deliver the major feature bundles approved during Phases 1–3 and deferred
for Phase 4+ foundations.

- [ ] **Lifecycle Gates Phase 2** — AI-assisted gate preparation, multi-reviewer
      quorum, retroactive audit, time-based/scheduled triggers, governance audit log
      (`audit/lifecycle.jsonl`). See [[proposals/bundle-lifecycle-gates-phase-2.md]]
- [ ] **Chat & Session Panel Phase 2** — full session management, @-mention context
      injection, model/provider picker, vault-scoped session history, diff/review
      panel. See [[proposals/bundle-chat-session-panel.md]]
- [ ] **AI Capabilities Bundle** — AI-powered complexity estimation, parallel
      multi-model review, automated test lifecycle, perspective synthesis (with
      human-preserving design). See [[proposals/bundle-ai-capabilities.md]]
- [ ] **Phase 4 UI Polish Bundle** — keyboard shortcuts, resizable panels, in-app
      theme picker, policies navigation button, wikilink backref updating (builds on
      Phase 4 vault-wide index), drag-and-drop reorganization, contributor autocomplete.
      See [[proposals/bundle-phase-3-ui-polish.md]]
- [ ] `org-operations` profile: full implementation — Issue, Decision, Policy
      scaffolding; Inbox Adapters (web form, email-to-inbox, chat webhook); full
      OpenCode instructions embedding core philosophy
- [ ] `knowledge-base` profile: full implementation — Ingest, Lint, Save-to-Wiki
      operations; all page types; LLM Wiki engine
- [ ] Typed wikilinks — `[[link|type:contains]]` syntax (knowledge-base profile first)
- [ ] Entity deduplication in Lint

---

### Phase 6 — Enterprise, Distribution & Cascade STEAM

**Goal:** Enterprise tier for Cascade STEAM reference deployment; public distribution;
VSCodium extension (after alpha validated by real users).

#### Enterprise Tier
- [ ] **Enterprise Tier Bundle** — server-side AI (system service, shared API key/
      local LLM), CI/CD webhook integration (Forgejo), email intake to inbox (IMAP/SMTP),
      scheduled compliance scans + gate reminders.
      See [[proposals/bundle-enterprise-tier.md]]
- [ ] Kubernetes / Helm deployment
- [ ] Remote registry sync (multi-vault coordination)
- [ ] Federation model — cross-vault Issue/Proposal submission

#### Cascade STEAM Reference Deployment
- [ ] Vault seed finalised: `vision.md` + `governance.md` completed by leadership
- [ ] Forgejo as git server (self-hosted; recommended for STEAM)
- [ ] AI stack integration: growlf/ai-stack (i9 Ultra + Xe iGPU) + growlf/meshy
- [ ] Full governance loop: human contributors + server AI + Forgejo enforcement +
      scheduled compliance

#### Distribution
- [ ] VSCodium extension skeleton (after Web UI alpha validated by real users)
- [ ] Publish to Open VSX marketplace
- [ ] User documentation site
- [ ] Demo GIFs in README (one per bundled profile)
- [ ] Partner org fork templates (seed a new org's vault from Cascade STEAM policies)
- [ ] Windows + macOS CI validation matrix
- [ ] Accessibility audit
- [ ] Profile authoring guide
- [ ] Second maintainer onboarded — required gate before public release

---

### Phase B — Shared Team Daemon (post-Phase 6)

- [ ] Standalone Node process wrapping the dispatch module
- [ ] Git integration: clone/pull, watch, commit AI results under daemon identity
- [ ] `docwright/ai-suggestions` branch → PR workflow
- [ ] REST/MCP endpoint exposing the dispatch contract
- [ ] OCC two-layer implementation for all background AI writes
- [ ] qmd MCP server integration for daemon search
- [ ] Federation model (cross-vault Issue/Proposal submission)

### Phase C — Live Co-Editing (aspirational)

Y.js CRDT sync server. Not on near-term roadmap. Revisit after Phase B.

---

## 15. Testing Strategy

### Unit Tests (Mocha + Chai)

- Profile Engine: valid/invalid/missing load; schema migration
- Lifecycle state machine: all transitions per profile
- Frontmatter linter: required/optional fields; debounce
- Wikilink resolver: existing; non-existent; section; aliased
- _backlinks.json: update on link add/remove/rename; rebuild
- Template engine: variable substitution; naming convention
- Promote: frontmatter + rename + link update + staging; idempotency; minimal diff
- Workspace Index: incremental update; full rebuild
- Dispatch module: callable outside VS Code extension host; **no VS Code API leakage**
- AI Trust Controller: Safe blocks writes; Augmented allows metadata; Surgeon allows prose
- ACL Controller: Observer blocked from promote; Contributor blocked from policy edit;
  Steward can promote; Governance can edit policy
- OCC: snapshot; verify; abort on conflict
- LLMWikiEngine: ingest pipeline (mock AI); lint output format; save-to-wiki scaffolding
- qmd client: auto-detect; threshold trigger; fallback to index scan
- Inbox adapters: web form creates stub; email creates stub; webhook creates stub

### Integration Tests

- Profile activation → correct templates, states, features
- Scaffold → frontmatter → decorated in tree → in dashboard
- Wikilink to missing doc → placeholder → doc created → resolves
- File renamed → all inbound links + _backlinks.json updated
- Promote → minimal diff; recovery checklist on failure
- `opencode serve` crash → restart → chat recovers
- remoteDispatch unreachable → fallback; warning shown
- AI write blocked by Safe trust level → no file modified
- ACL: Contributor cannot promote without review gate
- Ingest → sources/ page created → concept pages updated → log.md appended → index.md updated
- Lint → orphan pages identified → output in dashboard
- Save to Wiki → exploration page scaffolded with correct frontmatter
- qmd threshold → backend switches at 200 docs → search results unchanged in quality
- Inbox web form → stub created in /inbox/ → AI triage triggered → issue linked
- Decision record → linked to proposal and policy area → queryable by AI

### Coverage Target

80% line coverage for `src/lifecycle/`, `src/linter/`, `src/wikilinks/`,
`src/profile/`, `src/templates/`, `src/dispatch/`, `src/llmwiki/`,
`src/acl/`, `src/inbox/` by end of Phase 4.

---

## 16. CI/CD & Release

### Pipeline

```yaml
# Triggers: push to main, all PRs
jobs:
  build:
    - ESLint + Prettier
    - TypeScript type-check
    - Unit tests with coverage
    - Package .vsix
  integration:  # Phase 2+
    - ubuntu-latest
  matrix:  # Phase 5+
    os: [ubuntu-latest, macos-latest, windows-latest]
```

### Release Process

1. Update `CHANGELOG.md`
2. Bump `package.json`: patch / minor / major (breaking profile schema)
3. `git tag v0.x.x && git push --tags`
4. CI packages `.vsix` → attached to GitHub Release
5. `ovsx publish` to Open VSX (manual until Phase 5; automated after)

---

## 17. Licensing, Attribution & Governance

### License & Distribution

- **License:** MIT
- **Distribution:** Open VSX marketplace
- **Telemetry:** None, ever.

### Governance

BDFL model. NetYeti (growlfd@gmail.com) makes final decisions. All decisions documented
in `PROJECT.md` and `CHANGELOG.md`. Co-maintainers may be granted merge rights after
Phase 6. Second maintainer is a Phase 6 gate.

### NOTICE.md (draft)

```
Karpathy LLM Wiki pattern
  URL: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
  Author: Andrej Karpathy
  License: conceptual reference (no explicit license)
  Contribution: LLM Wiki pattern; Ingest/Query/Lint operations; knowledge-base profile

link
  Repository: https://github.com/gowtham0992/link
  Author: gowtham0992
  License: MIT
  Contribution: page taxonomy, frontmatter templates, _backlinks.json pattern, confidence field

llm-wiki-manager
  Repository: https://github.com/sametbrr/llm-wiki-manager
  Author: sametbrr
  License: MIT
  Contribution: operation taxonomy (bootstrap/ingest/query/update/lint/route)

long-term-agent-memory
  Repository: https://github.com/eslamgenio/long-term-agent-memory
  Author: eslamgenio
  License: MIT
  Contribution: team-oriented folder taxonomy

qmd
  Repository: https://github.com/tobi/qmd
  Author: tobi
  License: MIT
  Contribution: optional search backend; BM25+vector+LLM reranking; CLI + MCP interfaces

matryca-plumber
  Repository: https://github.com/MarcoPorcellato/matryca-plumber
  Author: Marco Porcellato
  License: Apache-2.0
  Patterns borrowed (no code): dispatch architecture, Trust & Safety tiers,
    OCC two-layer lifecycle, AI authorship stamping, Context Acceleration,
    SYSTEM_PROMPT / AGENTS.md as first-class repo artifact

OpenCode
  Repository: https://github.com/sst/opencode (org: anomalyco)
  Author: Anomaly Innovations (formerly SST)
  License: MIT

opencode-web-for-vscode
  Repository: https://github.com/cpkt9762/opencode-web-for-vscode
  License: MIT

opencode-gui
  Repository: https://github.com/ktmage/opencode-gui
  License: MIT

bms-ai-cluster
  Repository: https://github.com/growlf/bms-ai-cluster
  Author: NetYeti
  License: MIT

VSCodium
  Repository: https://github.com/VSCodium/vscodium
  License: MIT
```

---

## 18. Comparison with Alternatives

### Organizational Tools

| | docwright | Confluence | Notion | Linear/Jira |
|---|---|---|---|---|
| Policy-grounded hierarchy | ✅ | ❌ | ❌ | ❌ |
| Inbox → Issue → Proposal → Plan → Policy | ✅ | ❌ | ❌ | ❌ |
| Decision/rejection records | ✅ | ❌ | partial | ❌ |
| AI institutional memory | ✅ | ❌ | ❌ | ❌ |
| Git-native audit trail | ✅ | ❌ | ❌ | ❌ |
| Local LLM first-class | ✅ | ❌ | ❌ | ❌ |
| FOSS / self-hosted | ✅ | ❌ | ❌ | ❌ |
| Partner org federation | ✅ | ❌ | ❌ | ❌ |
| Zero-friction capture | ✅ | ❌ | partial | partial |
| Non-developer Web UI | ✅ | ✅ | ✅ | ✅ |

### VS Code Ecosystem

| | docwright | Foam | Dendron |
|---|---|---|---|
| Zero-config | ✅ | ❌ | ❌ |
| Lifecycle + automation | ✅ | ❌ | ❌ |
| Policy hierarchy | ✅ | ❌ | ❌ |
| Web UI client | ✅ | ❌ | ❌ |
| ACL user roles | ✅ | ❌ | ❌ |
| LLM Wiki (Ingest/Lint) | ✅ | ❌ | ❌ |
| AI + local LLM | ✅ | ❌ | ❌ |
| Remote AI node | ✅ | ❌ | ❌ |
| Multi-user team | ✅ | ❌ | ❌ |
| Domain profiles | ✅ | ❌ | ❌ |
| Wikilinks / backlinks | ✅ | ✅ | ✅ |
| Active development | ✅ | Slow | Stalled |
| License | MIT | MIT | AGPL |

---

## 19. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `opencode serve` API unstable | Medium | Critical | Phase 0 spike; SDK-only fallback |
| OpenCode SPA breaks embedding | Medium | High | Pin to release tag; SDK fallback ready |
| Profile schema locks early | Medium | High | `docwrightProfileVersion` from day one |
| OpenCode abandoned | Low | High | Core features have zero AI dependency |
| Scope creep | High | Medium | Strict phase gates; all additions need phase assignment |
| Extension activation performance | Medium | Medium | Lazy loading; target < 500ms |
| Port conflict (multi-window) | Medium | Medium | Dynamic port assignment |
| Single-maintainer bus factor | High | Medium | All decisions documented; second maintainer = Phase 6 gate |
| HTTP server security surface | Low | Low | Binds to `127.0.0.1` only |
| Cross-platform breakage | Medium | Medium | CI matrix in Phase 6 |
| Promote partial failure | Low | Medium | Step logging + idempotent re-run |
| Multi-user merge conflicts | Low | Medium | Minimal diff output |
| Remote dispatch unavailable | Medium | Low | Graceful fallback; warning |
| AI write corrupts human edits | Low | High | OCC two-layer model |
| Dispatch module acquires VS Code dep | Medium | High | Explicit test: dispatch unit tests run outside extension host |
| LLM Wiki identity/level/relationship problems | Medium | Medium | Noted as Phase 6+ known challenges; Lint operation provides ongoing detection |
| qmd not installed by user | Medium | Low | Graceful fallback to index scan; dashboard suggests install |
| knowledge-base profile too complex for users | Medium | Medium | Zero-config; `doc-lifecycle` remains available; `knowledge-base` opt-in |
| **Reading UX drives users away from VSCodium** | High | High | Web UI is the primary client; VSCodium is the power tool — not the daily driver |
| **Inbox friction prevents idea capture** | High | Critical | Zero-friction capture is a hard requirement; multiple adapters; Phase 1 gate |
| **ACL complexity slows contributor onboarding** | Medium | High | Default: Contributor tier for authenticated users; Observer for all others |
| **Partner org federation complexity** | Low | Medium | Fork model first; federation is Phase B+ |

---

## 20. Naming

Avoid trademarked terms (VSCode, VSCodium, OpenCode, Visual Studio).

**Confirmed:** `docwright`

- "wright" = craftsperson who makes things
- Verify on npm, Open VSX, and GitHub before finalising

---

## 21. Document History

| Version | Date | Change | Author |
|---------|------|--------|--------|
| v0.1 | 2026-05-19 | Created | NetYeti (growlfd@gmail.com) |
| v0.2 | 2026-05-19 | Competitor analysis, state persistence, port management, prerequisites, testing, CI/CD, offline mode, configuration, naming, risk table, acceptance criteria, OpenCode attribution | Claude (Anthropic) |
| v0.3 | 2026-05-19 | Profile System as core architecture; bundled profiles; Wikilink Engine, Promote, Backlinks, Lookup, Orphans, Graph, naming convention; daily notes + export pods out of scope | Claude (Anthropic) |
| v0.4 | 2026-05-21 | Phase 0 spike; zero-config story; in-process HTTP server; performance mitigations; local LLM first-class; FOSS hygiene files; best-practices automation as lead value prop; profile schema versioning; moved to Drive | Claude (Anthropic) |
| v0.5 | 2026-05-21 | §3 Quick Start; §6 Key Design Decisions; §11 Command Registry; template and OpenCode instructions examples; Promote step sequence and failure handling; dashboard event trigger table; multi-root workspace; BDFL governance; Phase 2 parallelisation note | Claude (Anthropic) |
| v0.6 | 2026-05-26 | Drive access resolved. Added: headless dispatch plane; multi-user & team collaboration; Trust & Safety tiers; AI authorship stamping; OCC two-layer model; Context Acceleration; remoteDispatch config; Phase B shared daemon + Phase C Y.js; matryca-plumber attribution | Claude (Anthropic) |
| v0.7 | 2026-05-26 | LLM Wiki pattern adopted as first-class (Karpathy gist reference added). Added: third bundled profile `knowledge-base`; LLMWikiEngine module; Ingest/Lint/Save-to-Wiki commands; `_backlinks.json` maintainer; qmd optional search backend (auto-enabled ≥200 docs); page taxonomy from gowtham0992/link; operation taxonomy from sametbrr/llm-wiki-manager; team folder taxonomy note from eslamgenio/long-term-agent-memory; differentiation table vs full LLM Wiki ecosystem; three hard problems noted as Phase 4+ known challenges; typed wikilinks spec stub; 10 new gaps added; all attribution in §9 and NOTICE.md | Claude (Anthropic) |
| v0.9 | 2026-06-07 | **Phase recalibration.** Phases rewritten to reflect actual build order (Web UI-first, not extension-first). Phase 0 and Phase 1 marked complete with accurate delivered feature list. Phase 2 elevated to Foundation & Methodology with Research stage as critical first deliverable. Phases 3–5 and B/C restructured around current trajectory and approved bundle proposals. Added Research stage to §2 Policy hierarchy. Updated §6 Web UI tech stack to SvelteKit. No content removed — all deliverables redistributed to correct phases. | Claude (Anthropic) |
| v0.10 | 2026-06-07 | **Phase accuracy pass.** Phase 1 done list extended with 3 missing deliverables (CI/CD setup, Git push+tag UI, CI watch system). Phase 2 Engineering Foundation: marked CI, dispatch test, and most FOSS hygiene items as done; noted remaining gaps (CODEOWNERS, dependabot.yml). Removed duplicate `author-role:` item (already done in all 4 profiles). Phase 3 renamed from "Profile Engine, ACL & AI Integration" to "Profile Engine, ACL & Research AI Tooling" — core AI features (Improve, Plan Review, chat, fillProposal) shipped in Phase 1; Phase 3 AI scope is research-stage tooling only. Clarified opencode-instructions.md status (org-operations done; 3 profiles pending). | NetYeti |
| v0.8 | 2026-06-01 | **Major reframe.** docwright repositioned as organizational operating system / governance layer, not a VSCodium extension. Added: §2 Policy as Foundation hierarchy; §2 zero-friction inbox capture (web form, email, CLI, chat); §2 "why not" Decision document type; §2 partner org federation model (fork/federation/shared-vault); §4 Why This Architecture (Web UI as primary client, VSCodium as power tool, Logseq as optional explorer); §7 ACL user role model (Observer/Contributor/Steward/Governance); §7 Inbox Adapter Layer diagram; §8 `org-operations` profile (fourth bundled profile — the org OS); §10 ACL Controller + Inbox Adapters + Web UI Server modules; §12 Web UI and inbox configuration settings; §14 Phase 3 expanded with Web UI v1 and org-operations full implementation; §19 three new risks (reading UX, inbox friction, ACL complexity). Updated: §1 problem statement to organizational frame; §2 proposed solution to multi-client architecture; §5 differentiation table vs organizational tools; default profile changed from `doc-lifecycle` to `org-operations`. Session context: Cascade STEAM — educational equity org; non-developer contributors are primary users. | Claude (Anthropic) |
