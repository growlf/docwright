# AGENTS.md — Agent Guidelines for DocWright

## Core Principles

**Security first. Policy driven. Test verified at every stage.**
Every action must be safe before it is useful. Every behavior must be governed by
policy, not hardcoded logic. Every change must be verifiable through tests before
it ships. This applies to the engine, the UI, and the governance documents themselves.
It also applies outward: when DocWright is used to govern a project or organization,
this philosophy is actively transmitted into that work — prompting security thinking,
policy grounding, and verification at every stage of the documents it helps produce.

**Bugs before features.** Check for open bug issues before beginning any feature
implementation. If bugs exist that affect the feature's area, resolve them first
or declare an explicit exception in the plan. See `policies/core/bugs-before-features.md`.

**ALWAYS VERIFY, never assume docs are up to date.** Before acting on any documented IP, credential, role, or topology, verify against the live system.

**One-off tasks are prohibited.** All work must flow through the document lifecycle. See the `order-of-work-lifecycle` SOP for details.

**No active work before plan approval.** Gathering data and evaluating feasibility is fine from a proposal. Implementation code, infrastructure changes, or any system state mutation is STRICTLY FORBIDDEN until a plan has `status: approved` or `status: in-progress` and non-empty `assigned_to`. See `.opencode/rules/no-work-before-approval.md`.

**Multi-system operation.** This repo may operate from many machines. NEVER assume any specific host. Check connectivity before infrastructure operations.

**User identity & accountability.** The `.env` file (gitignored) supplies the HUMAN identity. The MACHINE identity is ALWAYS `$(hostname)`. Agents MUST use `OPCODE_USER_NAME@$(hostname)` for `created_by` in proposals/plans. See `.env.example`.

### Identity Resolution Protocol (automated)
1. Read `.env` from repo root — fall back to `git config user.name` / `user.email` if missing
2. If `.env` conflicts with git config, prefer `.env` but flag the discrepancy
3. Machine identity is ALWAYS `$(hostname)` — never user-supplied
4. Run `traceroute -n 8.8.8.8` at session start to fingerprint the network path
5. Log resolved identity: `Human: <name> <email> | Machine: <hostname> | Network: <network hint>`

## Document Lifecycle (Overview)

```
proposals/  →  proposals/approved/  →  plans/  ─→  plans/completed/ (completed → docs/)
(proposal)      (approved)              (exec)     ↘  plans/completed/ (canceled, no docs)
```

1. **Proposals** (`proposals/`) — `approved: false`, any author. Duplicate check required before creation.
2. **Approved Proposals** (`proposals/approved/`) — Only humans set `approved: true`. Requires non-empty `assigned_to`.
3. **Plans** (`plans/`) — Created from approved proposals. Requires `status: approved|in-progress` + non-empty `assigned_to` for execution.
4. **Completed Plans** (`plans/completed/`) — Set `status: completed`, move file, generate docs in `docs/`.
5. **Canceled Plans** (`plans/completed/`) — Set `status: canceled`, `canceled_date`, `cancellation_reason`, move file, NO docs.

**Critical:** Agents must NEVER set `approved: true` on proposals. Only humans can approve.

## Available Skills

| Skill | Triggers | Source SOP |
|-------|----------|------------|
| `docwright-lifecycle` | lifecycle, plan, proposal, workflow | order-of-work-lifecycle SOP |
| `docwright-git` | commit, git | git-commit-standards SOP (embedded) |
| `docwright-security` | credential, password, vaultwarden, vlan, firewall, ssh, access | password-secret-management SOP |
| `docwright-backup` | backup, recovery, restore | backup-recovery SOP |
| `docwright-infra` | deployment, placement, service | infrastructure-placement SOP |
| `docwright-project` | switch to, resume, project, registry, vault | project-registry SKILL |
| `docwright-proposal` | new proposal, create proposal, template, draft | proposal-template SKILL |

## Available Subagents

| Subagent | Triggers | Source SOP |
|----------|----------|------------|
| `@docwright-lifecycle` | lifecycle transitions, proposal→plan→completed | order-of-work-lifecycle SOP |
| `@docwright-incident` | incident, breach, outage, P1-P4 | incident-response SOP |
| `@docwright-project` | switch to, resume, project, registry, vault | project-registry SKILL |

## Available Rules (auto-enforced, no context load)
- `commit-format.md` — `<type>: <description>` format enforcement
- `no-secrets.md` — Never output plaintext credentials
- `no-plaintext-creds.md` — Always reference your secrets vault
- `frontmatter-validate.md` — Required fields per document type
- `no-work-before-approval.md` — No implementation before plan approval
- `bugs-before-features.md` — Resolve known bugs before starting feature work

## Getting Started

1. `cp .env.example .env` and set `OPCODE_USER_NAME` and `OPCODE_USER_EMAIL`
2. `bash scripts/install-hooks.sh` to install pre-commit hooks
3. Create your first proposal in `proposals/`
4. See `docs/SOPs/order-of-work-lifecycle.md` for the full lifecycle guide

---

## Architectural Context (added 2026-06-01)

docwright has been reframed as an **organizational operating system** — a governance
layer with multiple client surfaces. Read CLAUDE.md for full context.

### Invariants — never violate these

1. **dispatch module has zero VS Code API deps** — `src/dispatch/` must be importable
   outside the extension host. The CI pipeline enforces this via `npm run test:dispatch`.
   If you import `vscode` in `src/dispatch/`, the build breaks. Fix the import.

2. **Frontmatter is audit record, not enforcement** — `author-role:` records who did
   what. Enforcement is Forgejo team membership + branch protection + Web UI OAuth.
   Do not use `author-role:` to make permission decisions in code.

3. **Git is the canonical store** — no auxiliary database. index.json is a derived
   cache rebuilt from frontmatter. _backlinks.json is rebuilt from wikilinks.
   If these files are deleted, rebuild them — don't restore from backup.

4. **No telemetry, ever** — do not add any analytics, tracking, or phone-home code.

5. **`author-role:` field required in all templates** — every profile template must
   include `author-role:` with default value `contributor`. This is non-negotiable.
   See CONTRIBUTING.md.

### Profile structure

Profiles live in `src/profiles/[name]/` and contain:
- `profile.json` — manifest (states, document types, features, required frontmatter)
- `schema.json` — frontmatter JSON Schema for validation
- `opencode-instructions.md` — AI context injected on profile activation
- `templates/[type].md` — scaffolding templates (ALL must include `author-role:`)

### ACL model

Four tiers: Observer / Contributor / Steward / Governance
Source of truth: Forgejo team membership (not frontmatter)
Frontmatter `author-role:` is an audit record of the tier at time of action.
Web UI enforces via Forgejo OAuth + team API.
VSCodium uses `docworkbench.userRole` workspace setting (honor system for devs).
