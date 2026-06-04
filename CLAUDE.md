# CLAUDE.md
# Auto-read by Claude Code on session start.
# Keep this lean — full context is in the Drive folder and PROPOSAL.md.

## What this repo is

docwright is a FOSS organizational operating system for policy-driven teams.
It is a governance layer — not an editor — that runs across multiple client surfaces:
a Web UI (primary, for all contributors), a VSCodium extension (power tool, for developers),
and optional Logseq (read-only graph explorer). All surfaces operate on the same plain
Markdown files in this git repository.

BDFL: NetYeti (growlf on GitHub, growlfd@gmail.com)
License: MIT
Status: Pre-alpha — Phase 0 complete, Web UI prototype functional

## Full project context

Session log and proposal docs:
https://drive.google.com/drive/folders/1XMK0Cxil65xzpXFWdMABp5i-5BHDgaZ-

Read SESSION-LOG.md first when resuming. It contains the session index.
PROPOSAL.md (v0.8) contains the full architecture spec.

## Architecture in brief

```
Web UI (SvelteKit + markdown-it)     ← primary client, all contributors
VSCodium extension                   ← developer power tool
Logseq (read-only)                   ← optional graph explorer
         │
         ▼
docwright engine (dispatch module)   ← surface-agnostic TypeScript, NO VS Code API deps
         │
         ▼
Markdown files + YAML frontmatter    ← git repo on disk (this repo when used as vault)
```

Git server: Forgejo (recommended for self-hosting)
AI backend: OpenCode (any OpenAI-compatible endpoint; local LLMs via Meshy/Ollama)
ACL: Forgejo team membership (source of truth) + `author-role:` frontmatter (audit record)

## Core philosophy

**Security first. Policy driven. Test verified at every stage.**

**Bugs before features.** Known bugs are resolved before new feature work begins.
Unresolved bugs mislead feature development, create security exposure, and increase
cognitive load. Exceptions are rare and must be explicitly justified in the plan or
commit. See [[policies/core/bugs-before-features.md]].

Every feature is designed with security as a baseline constraint — never retrofitted.
Every behavior is governed by policy (profile definitions, frontmatter schema, ACL)
rather than hardcoded logic. Every change ships only after it is verifiable through
tests. This applies equally to the engine, the UI surfaces, and the governance
documents that DocWright itself manages.

This philosophy is not only how DocWright is built — it is what DocWright transmits
into the organizations that adopt it. Every bundled profile, every template, and every
AI instruction file should actively reinforce these values in the work the vault governs.
When DocWright helps a team write a proposal or plan, it should prompt them to consider
security implications, ground decisions in policy, and define how the outcome will be
verified before it ships.

**Keep good ideas for later.** Every plan and proposal that sets something aside MUST
capture it as a deferred proposal before closing. Good ideas not captured are good ideas
lost. See [[policies/core/capture-deferred-ideas.md]].

**Code over memory — automate process enforcement.** When a rule can be enforced
by a pre-commit hook, MCP tool, dispatch validation, UI constraint, or CI check,
it must be. Relying on AI memory or human discipline to enforce a process is a
known failure mode. Ask constantly: "Can I enforce this with code?" If yes, do it.
See [[policies/core/code-over-memory.md]].

**Multiple perspectives produce better outcomes.** No single AI model, and no single
person, has complete knowledge or perfect judgment. DocWright was built by triangulating
between Claude, BigPickle (OpenCode's configured LLM), and the BDFL — each catching
what the others missed. This practice must be preserved and made easy for every
organization that adopts DocWright. See [[policies/core/multi-perspective-review.md]].

## Key architectural invariants — never break these

1. The dispatch module has ZERO VS Code API dependencies. Test it outside the extension host.
2. Frontmatter is source of truth for document state. index.json is a derived cache only.
3. Git is the canonical store. No auxiliary database.
4. No telemetry. Ever.
5. `author-role:` frontmatter is an audit record, not an enforcement mechanism.
   Enforcement is Forgejo team membership + branch protection + Web UI OAuth.

## Bundled profiles

- `org-operations` — inbox→issue→proposal→plan→policy/decision/work (default)
- `doc-lifecycle` — proposal→plan→completed/canceled (developer-focused)
- `infra-topology` — planned→active→decommissioned (network/device management)
- `knowledge-base` — LLM Wiki pattern (Karpathy); Ingest/Lint/Save-to-Wiki

## Phase 0 — spike (complete) ✅

Goal: validate `opencode serve` HTTP API feasibility.

Results:
- `opencode serve` v1.15.13 HTTP API is stable ✅
- JS SDK covers required endpoints ✅
- SPA embed via iframe in WebView confirmed working ✅
- Decision: go with iframe SPA embed (approach 1) ✅
- Web UI redirected as primary target (VSCodium extension demoted)

## Phase 1 (current) — Web UI prototype

Goal: functional SvelteKit web UI with full CRUD, file tree, wikilink navigation,
and live file change detection via SSE.

**VSCodium extension: deliberately deferred.** The team uses the Web UI
surface more than the IDE at this stage. The extension will follow in Phase 2
when the dispatch module exists. See `plans/phase-1-opencode-embed.md`.

Delivered:
- [x] SvelteKit scaffold with dark theme layout, collapsible file tree sidebar
- [x] Markdown rendering (markdown-it) with TOC anchors, external link targets
- [x] Wikilink parsing: `[[path]]`, `[[path#section]]`, `[[path|alias]]`
- [x] CRUD + rename + delete with toast notifications and git undo
- [x] SSE live reload: `/api/watch` endpoint, auto-refresh tree + page on file change
- [x] 3-mode editor: preview / WYSIWYG / source
- [x] Proposal templating system (sidebar + UI button)
- [x] Document properties pane (frontmatter form, action buttons, mode-aware)
- [x] Sidebar polish: docs/all-files toggle, hidden archived dirs, context-aware +
- [x] Vault status page (`/status`) with SSE refresh — default home page
- [x] Smart 404: moved-document redirect + not-found inline state
- [x] Collation foundation: overlap detection stub, related-proposals panel
- [x] Lifecycle compliance: pre-commit gate, MCP server, Claude Code hook
- [x] Project registry + vault switching

**Active plans:** collation (high), git-controls (medium), phase-1-opencode-embed (high, see above)

## Phase 2 (next) — Foundation

Goal: working extension skeleton; profile engine; zero-config; basic scaffolding;
inbox capture (VSCodium command + localhost web form).

Key deliverables:
- Extension activates lazily (< 500ms)
- Profile engine loads profile.json; falls back to org-operations
- Dispatch module skeleton — verify no VS Code API leakage
- `opencode serve` child process management + crash recovery
- New Document scaffolding with auto-stage
- Inbox capture: VSCodium command + minimal web form on localhost
- `author-role:` field in ALL profile templates from day one
- GitHub Actions CI: lint + typecheck + unit tests + .vsix package
- All FOSS hygiene files: CHANGELOG.md, SECURITY.md, CONTRIBUTING.md,
  NOTICE.md, AGENTS.md, CODEOWNERS, .github/ templates, dependabot.yml

## Repo structure

```
docwright/
├── CLAUDE.md                    ← this file (auto-read by Claude Code)
├── PROPOSAL.md                  ← full architecture spec (v0.8+)
├── AGENTS.md                    ← what AI agents need to know when working ON docwright
├── NOTICE.md                    ← attribution for borrowed components
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
├── LICENSE                      ← MIT
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── src/
│   ├── extension/               ← VSCodium extension entry point
│   │   └── extension.ts
│   ├── dispatch/                ← surface-agnostic engine (NO VS Code API)
│   │   ├── profile.ts
│   │   ├── index.ts             ← workspace index manager
│   │   ├── linter.ts            ← frontmatter linter
│   │   ├── templates.ts
│   │   ├── wikilinks.ts
│   │   ├── promote.ts
│   │   ├── acl.ts               ← ACL controller
│   │   ├── inbox.ts             ← inbox adapter interfaces
│   │   └── llmwiki.ts           ← LLM Wiki engine (knowledge-base profile)
│   ├── webui/                   ← SvelteKit web UI
│   │   └── ...
│   └── profiles/                ← bundled profile definitions
│       ├── org-operations/
│       ├── doc-lifecycle/
│       ├── infra-topology/
│       └── knowledge-base/
├── test/
│   └── dispatch/                ← dispatch unit tests (run OUTSIDE extension host)
└── example-vault/               ← generic org-operations starter vault
    ├── README.md
    ├── policies/core/
    ├── policies/program-areas/
    ├── inbox/
    ├── issues/
    ├── proposals/
    └── decisions/
```

## Working on the dispatch module

The dispatch module is the heart of docwright. Rules:
- Import NOTHING from `vscode` — the CI test runs it outside the extension host
- Every public function is unit-testable with a plain filesystem mock
- State lives in frontmatter and index.json, never in memory between calls
- All AI writes go through the ACL controller and carry `ai-last-action:` stamps

## Working on profiles

A profile is a directory under `src/profiles/[name]/` containing:
- `profile.json` — manifest (name, version, states, document types, features)
- `schema.json` — frontmatter JSON Schema for validation
- `opencode-instructions.md` — AI context injected on activation
- `templates/[type].md` — scaffolding templates (MUST include `author-role:` field)

All templates MUST include `author-role:` field. Default value: `contributor`.

Every `opencode-instructions.md` MUST embed the core philosophy and instruct the AI
to actively apply it to the vault's work — prompting for security considerations,
policy grounding, and verification steps whenever it helps draft or review a document.

## Attribution reminder (see NOTICE.md for full list)

Key attributions required:
- matryca-plumber (Apache-2.0) — dispatch architecture, Trust tiers, OCC, AI stamping
- Karpathy LLM Wiki gist — knowledge-base profile, Ingest/Lint pattern
- gowtham0992/link (MIT) — page taxonomy, _backlinks.json pattern
- sametbrr/llm-wiki-manager (MIT) — operation taxonomy
- tobi/qmd (MIT) — search backend
- OpenCode / sst (MIT) — AI integration

## Cascade STEAM deployment context

The reference implementation. Vault seed is in Drive folder.
vision.md and governance.md in the seed need leadership completion before going active.
Forgejo is the recommended git server for self-hosting.
AI stack: growlf/ai-stack (i9 Ultra + Xe iGPU) + growlf/meshy (inference proxy).
