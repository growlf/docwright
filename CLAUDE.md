# CLAUDE.md
# Auto-read by Claude Code on session start.
# Keep this lean — full context is in the Drive folder and PROJECT.md.

## How to Invoke Skills

**FIRST: Check `.claude/SKILL-INVOCATION-RULES.md`** — it has a decision tree that tells you whether to:
- Use `Skill(name: "...")` (harness-registered skills like Explore, Plan, code-reviewer)
- Read `.claude/skills/<name>.md` and execute directly (DocWright skills like endsession)
- Read `.opencode/skills/<name>/SKILL.md` and follow the process (OpenCode workflow skills)

**Key rule:** `Skill()` tool only works on harness-registered skills. DocWright skills must be read and executed manually. See `.claude/SKILL-INVOCATION-RULES.md` for the full matrix.

---

## Available Skills (Reference)

DocWright ships workflow skills under `.opencode/skills/`. Each directory
contains a `SKILL.md` with detection heuristics and step-by-step instructions.
When a task matches a skill's triggers, read its `SKILL.md` and follow the process.

> **Auto-generated** by `scripts/sync-claude-skills.ts`. Do not edit manually.
> Run `npm run sync:skills` after adding, removing, or renaming a skill.

<!-- skills-table-start -->

| Skill | Description | SKILL.md |
|-------|-------------|----------|
| `docwright-backup` | Backup and recovery procedures for infrastructure and configuration | [`.opencode/skills/docwright-backup/SKILL.md`](.opencode/skills/docwright-backup/SKILL.md) |
| `docwright-discovery` | Hardware and network asset discovery — runs unified Ansible playbook, cross-references router ARP, detects drift, syncs device YAMLs | [`.opencode/skills/docwright-discovery/SKILL.md`](.opencode/skills/docwright-discovery/SKILL.md) |
| `docwright-git` | Git commit standards for DocWright projects | [`.opencode/skills/docwright-git/SKILL.md`](.opencode/skills/docwright-git/SKILL.md) |
| `docwright-infra` | Infrastructure placement and reliability standards | [`.opencode/skills/docwright-infra/SKILL.md`](.opencode/skills/docwright-infra/SKILL.md) |
| `docwright-issue-workflow` | End-to-end GitHub issue processing — branch, fix, test, PR, merge, cleanup | [`.opencode/skills/docwright-issue-workflow/SKILL.md`](.opencode/skills/docwright-issue-workflow/SKILL.md) |
| `docwright-lifecycle` | DocWright document lifecycle management - proposals, plans, completed/canceled transitions | [`.opencode/skills/docwright-lifecycle/SKILL.md`](.opencode/skills/docwright-lifecycle/SKILL.md) |
| `docwright-project` | Project registry and vault switching for multi-project DocWright workspaces | [`.opencode/skills/docwright-project/SKILL.md`](.opencode/skills/docwright-project/SKILL.md) |
| `docwright-proposal` | Create properly templated proposals with required frontmatter | [`.opencode/skills/docwright-proposal/SKILL.md`](.opencode/skills/docwright-proposal/SKILL.md) |
| `docwright-raw-proposal` | Detect raw proposals and draft them into structured form | [`.opencode/skills/docwright-raw-proposal/SKILL.md`](.opencode/skills/docwright-raw-proposal/SKILL.md) |
| `docwright-security` | Security practices for credential management, network access, and system hardening | [`.opencode/skills/docwright-security/SKILL.md`](.opencode/skills/docwright-security/SKILL.md) |
| `docwright-session-start` | Automated session startup — resolves identity, gathers active plans, session history, git status, and sets up todo | [`.opencode/skills/docwright-session-start/SKILL.md`](.opencode/skills/docwright-session-start/SKILL.md) |
| `docwright-templates` | Document format templates for audit plans, mitigation tracking, and assessment reports | [`.opencode/skills/docwright-templates/SKILL.md`](.opencode/skills/docwright-templates/SKILL.md) |
| `docwright-tools` | Security audit and hardening tools reference — lynis, rkhunter, fail2ban, firewalld, OpenSCAP, auditd | [`.opencode/skills/docwright-tools/SKILL.md`](.opencode/skills/docwright-tools/SKILL.md) |
| `endsession` | Automated session shutdown — saves session note, updates SESSION-LOG.md, commits all remaining changes, pushes all branches, reports status | [`.opencode/skills/endsession/SKILL.md`](.opencode/skills/endsession/SKILL.md) |

<!-- skills-table-end -->

## What this repo is

docwright is a FOSS organizational operating system for policy-driven teams.
It is a governance layer — not an editor — that runs across multiple client surfaces:
a Web UI (primary, for all contributors), a VSCodium extension (power tool, for developers),
and optional Logseq (read-only graph explorer). All surfaces operate on the same plain
Markdown files in this git repository.

BDFL: NetYeti (growlf on GitHub, growlfd@gmail.com)
License: MIT
Status: Pre-alpha — v0.4.x; Phases 0–3 complete, Phase 4 (profile engine, ACL, AI integration) in progress

## Full project context

Session log and proposal docs:
https://drive.google.com/drive/folders/1XMK0Cxil65xzpXFWdMABp5i-5BHDgaZ-

Read SESSION-LOG.md first when resuming. It contains the session index.
PROJECT.md (v0.8) contains the full architecture spec.

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

**ALWAYS file noticed bugs/gaps through `capture_bug_report`.** Never hand-file first:
`suggest` (cross-source dedup — `confirm` to +1 demand on a match) → `create` if novel →
mirror to GitHub with a `github_issue:` backlink. Hand-filed issues bypass dedup and the
demand heatmap. The suggest matcher is literal — try more than one phrasing before
trusting "no duplicates". (BDFL directive 2026-07-05; see AGENTS.md §Core Principles.)

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

**AI governance boundaries.** AI may never set `approved: true`, `status: completed`,
or `gate_status: approved/waived` on governance documents. Never generate
`HUMAN_APPROVED=1` in commit commands for these changes — propose the command,
let the human add HUMAN_APPROVED=1 and run it themselves. The hook enforces this
in code. See [[policies/core/ai-governance-boundaries.md]].

**Governance lives at the AI workflow layer, not in git.** All plan mutations
go through MCP tools (`update_step`, `update_plan_status`, `append_history`,
`set_plan_field`, `write_plan`). The PreToolUse hook blocks direct writes to
`plans/*.md`. Git pre-commit handles git-native concerns only (commit format,
file placement, required fields). See [[policies/core/workflow-layer-governance.md]]
and [[docs/ai-governance-enforcement.md]].

**Versioning is phase-driven.** `0.MINOR.PATCH` — minor = phase number, patch =
completed plans in that phase. Version is bumped at **phase close** by
`scripts/phase-close.ts` (`npm run phase:close -- N`), which counts
`plans/completed/phase-N-*.md`, writes `0.{N+1}.0` to `VERSION` and
`package.json`, then commits, tags, and pushes. There is **no** per-commit
auto-bump hook. See [[policies/core/versioning.md]].

**Keep good ideas for later.** Every plan and proposal that sets something aside MUST
capture it as a deferred proposal before closing. Good ideas not captured are good ideas
lost. See [[policies/core/capture-deferred-ideas.md]].

**Code over memory — automate process enforcement.** When a rule can be enforced
by a pre-commit hook, MCP tool, dispatch validation, UI constraint, or CI check,
it must be. Relying on AI memory or human discipline to enforce a process is a
known failure mode. Ask constantly: "Can I enforce this with code?" If yes, do it.
See [[policies/core/code-over-memory.md]].

**One-off scripts must trigger formalization proposals.** When you run a one-off
bash script or multi-step command that operates on multiple files or handles a
recurring lifecycle event, stop and ask: "Have I done this before?" If yes —
create a `priority: 4` proposal for the formalized version (skill, MCP tool, npm
script, dispatch endpoint, or CI check) before moving on. One-offs are memory.
Formalized tools are code. See [[.opencode/rules/one-off-formalization.md]].

**Multiple perspectives produce better outcomes.** No single AI model, and no single
person, has complete knowledge or perfect judgment. DocWright was built by triangulating
between Claude, BigPickle (OpenCode's configured LLM), and the BDFL — each catching
what the others missed. This practice must be preserved and made easy for every
organization that adopts DocWright. See [[policies/core/multi-perspective-review.md]].

## Branching (trunk-based)

`main` is the trunk — always the latest integrated code. Branch features off it
and PR back into it; **never** base off or wait for a `develop` branch (retired
2026-06-30). Canonical: `git fetch origin && git checkout -b <prefix>/<slug> origin/main`,
then `gh pr create --base main`. Typed prefixes (CI-enforced): `feat|fix|docs|chore|refactor|test|policy|decision`.
Releases are cut as `release/v*.*.*` branches and tagged from `main`; `main` HEAD
is not guaranteed deployable — consume tagged releases. See CONTRIBUTING.md.

For guidelines on multi-agent/multi-session collaboration and sync, see [[AGENTS.md#multi-agent--multi-session-collaboration]].

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

## Phase history (0–3 complete)

Versioning is phase-driven (see above): `0.MINOR` = phase number. Full scope per
phase is in PROJECT.md §14; phase plans live in `plans/` and `plans/completed/`.

- **Phase 0 — `opencode serve` spike.** HTTP API validated (v1.15.13 stable, JS SDK
  sufficient); decision: iframe SPA embed. Web UI promoted to primary surface,
  VSCodium extension demoted/deferred.
- **Phase 1 — Web UI prototype.** SvelteKit web UI: CRUD + rename/delete with git
  undo, wikilinks, SSE live reload, 3-mode editor (preview/WYSIWYG/source),
  proposal templating, properties pane, vault status page, collation foundation,
  lifecycle compliance (pre-commit gate + MCP server + Claude Code hook), project
  registry/vault switching, containerization.
  See `plans/completed/phase-1-*.md`.
- **Phase 2 — Foundation, web-first (closed 2026-06-08).** Dispatch module CI (zero
  VS Code API leakage verified), `author-role:` in all bundled profile templates,
  GitHub Actions CI, FOSS hygiene files, Research Stage MVP, plan execution modes
  (mentor/guided/autonomous), plans-to-phases assignment. Profile engine and inbox
  capture deferred to Phase 4. See `plans/completed/phase-2-foundation.md`.
- **Phase 3 — Vault foundation, perception & real-world pilots (closed 2026-06-25).**
  TypeScript MCP server with `--mode vault|upstream`, vault portability +
  `docwright init`/adopt scaffolds, profile override merge, vault migration system,
  MSP pilot + Cascade STEAM early-access vaults, Web UI auth/multiuser, plugin
  system, knowledge graph. See `plans/completed/phase-3-vault-foundation.md`.

## Phase 4 (current) — Profile Engine, ACL & AI Integration

Phase plan: `plans/phase-4-profile-acl-ai.md` (draft — full profile engine
runtime, ACL controller, inbox capture, AI integration maturity).

Other active plans: `contribution-pipeline` (in-progress, carried from Phase 3),
`lifecycle-gates` (high), `collaboration-issue-model-and-roadmap-sync` (high),
`vscodium-extension` (still deliberately deferred until after alpha validation
by real users).

## Phase 5 (next) — Cascade STEAM Production Infrastructure

Production deployment of the reference implementation: Forgejo git server,
ai-stack/meshy AI backend, vault go-live. See `plans/phase-5-cascade-steam.md`.

## Repo structure

```
docwright/
├── CLAUDE.md                    ← this file (auto-read by Claude Code)
├── PROJECT.md                  ← full architecture spec (v0.8+)
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
