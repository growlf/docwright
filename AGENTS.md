# AGENTS.md — Agent Guidelines for DocWright

## Core Principles

**ALWAYS VERIFY, never assume docs are up to date.** Before acting on any documented IP, credential, role, or topology, verify against the live system.

**One-off tasks are prohibited.** All work must flow through the document lifecycle. See the `order-of-work-lifecycle` SOP for details.

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

## Available Subagents

| Subagent | Triggers | Source SOP |
|----------|----------|------------|
| `@docwright-lifecycle` | lifecycle transitions, proposal→plan→completed | order-of-work-lifecycle SOP |
| `@docwright-incident` | incident, breach, outage, P1-P4 | incident-response SOP |

## Available Rules (auto-enforced, no context load)
- `commit-format.md` — `<type>: <description>` format enforcement
- `no-secrets.md` — Never output plaintext credentials
- `no-plaintext-creds.md` — Always reference your secrets vault
- `frontmatter-validate.md` — Required fields per document type

## Getting Started

1. `cp .env.example .env` and set `OPCODE_USER_NAME` and `OPCODE_USER_EMAIL`
2. `bash scripts/install-hooks.sh` to install pre-commit hooks
3. Create your first proposal in `proposals/`
4. See `docs/SOPs/order-of-work-lifecycle.md` for the full lifecycle guide
