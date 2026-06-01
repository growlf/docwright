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
Status: Pre-alpha — Phase 0 spike in progress

## Full project context

Session log and proposal docs:
https://drive.google.com/drive/folders/1XMK0Cxil65xzpXFWdMABp5i-5BHDgaZ-

Read SESSION-LOG-v8.md first when resuming. It contains the full decision log.
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

## Phase 0 (current) — spike

Goal: validate `opencode serve` HTTP API before building Phase 1.
Go/no-go gate — if API is unstable, fall back to SDK-only chat, no schedule impact.

Checklist:
- [ ] Confirm `opencode serve` HTTP API is stable and documented
- [ ] Confirm JS SDK covers required endpoints (session create, message send, stream)
- [ ] Build minimal SPA embed proof-of-concept in a WebView
- [ ] Decision: SPA embed OR SDK-only for the OpenCode chat panel

## Phase 1 (next) — Foundation

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
