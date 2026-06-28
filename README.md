# DocWright

**Organizational operating system for policy-driven teams.**

DocWright is a governance layer — not just an editor — that connects an organization's
values, decisions, and daily work through a policy-grounded document hierarchy. All state
lives in plain Markdown files with YAML frontmatter, in a git repository, accessible from
multiple client surfaces without vendor lock-in.

**Design philosophy:** Security first. Policy driven. Test verified at every stage.

## What it is

```
Inbox (ideas, issues, observations)
  → Issues → Proposals → Plans → Policies / Decisions
                                       → Work Items → Code (OpenCode)
```

- **Web UI** — primary interface for all contributors (SvelteKit, rendered Markdown,
  wikilinks, CRUD, live file-change detection via SSE, proposal templating, git commit)
- **VSCodium extension** — power tool for developers (deferred to Phase 2)
- **Logseq** — optional graph explorer (opens the same vault folder, read-only)

## Status

Pre-alpha — Phase 1 (Web UI) largely complete and functional.

| Capability | Status |
|---|---|
| SvelteKit Web UI with dark theme, file tree sidebar | ✅ |
| Markdown rendering (TOC anchors, wikilinks, external link targets) | ✅ |
| CRUD + rename + delete with git undo | ✅ |
| SSE live reload (file tree + page auto-refresh on change) | ✅ |
| 3-mode editor: preview / WYSIWYG / source | ✅ |
| Proposal templating system | ✅ |
| Document properties pane (frontmatter form, action buttons) | ✅ |
| Authentication: none / local / Forgejo OAuth | ✅ |
| Optimistic Concurrency Control (ETag-based conflict detection) | ✅ |
| Vault status page (`/status`) — default home | ✅ |
| Smart 404: moved-document redirect + not-found inline state | ✅ |
| Project registry + vault switching | ✅ |
| Knowledge graph view (ForceGraph) | ✅ |
| MCP server (TypeScript, lifecycle governance tools) | ✅ |
| Docker deployment | ✅ |
| VSCodium extension | ⏳ Phase 2 |

## Quick start

### Single developer (no auth)

```bash
git clone https://github.com/growlf/docwright.git
cd docwright
cp .env.example .env           # edit with your name, email, and vault path
npm install
cd src/webui && npm install
npm run dev                    # starts at http://localhost:5173
```

By default `AUTH_MODE=none` — no login required, full access.

### Enable local auth (personal deployment)

Add to `.env`:

```env
AUTH_MODE=local
SESSION_SECRET=$(openssl rand -hex 32)
LOCAL_AUTH_USER=admin
LOCAL_AUTH_PASSWORD=yourpassword
LOCAL_AUTH_EMAIL=you@example.com
LOCAL_AUTH_DISPLAY_NAME="Your Name"
```

### Enable Forgejo OAuth (team deployment)

See [docs/authentication.md](./docs/authentication.md) for step-by-step instructions.

## Governance architecture

DocWright enforces lifecycle rules at the **AI workflow layer**, not in git hooks.

```
AI attempts a plan write
        ↓
PreToolUse hook — fires before Write/Edit; blocks direct plan mutations
        ↓
MCP tools — update_step, update_plan_status, append_history, set_plan_field
            validates, recounts steps, logs audit trail on every call
        ↓
Web UI — PropertiesPane disables Complete button when steps pending
        ↓
Behavioral contract — AGENTS.md / CLAUDE.md tells AI to self-check first
```

Git pre-commit handles git-native concerns (commit format, file placement, required fields).
Lifecycle governance lives in the tool layer where it can actually intercept AI actions
before they land.

See [docs/ai-governance-enforcement.md](./docs/ai-governance-enforcement.md)
and [policies/core/workflow-layer-governance.md](./policies/core/workflow-layer-governance.md).

## Deployment

Three scenarios are documented in [docs/deployment.md](./docs/deployment.md):

| Scenario | Auth | Git | Use case |
|---|---|---|---|
| Standalone | `AUTH_MODE=none` | Local / any | One developer, local vault |
| Team server | `AUTH_MODE=forgejo` | Forgejo | 2–20 people, shared server |
| Enterprise | Forgejo + SAML/LDAP | Forgejo + CI/CD | Org-wide, automated governance |

Docker: `docker compose up` — reads `.env` automatically.

## For AI agents and Claude Code

See [CLAUDE.md](./CLAUDE.md) — read this first when starting a new session.
Full project context and decision log: https://drive.google.com/drive/folders/1XMK0Cxil65xzpXFWdMABp5i-5BHDgaZ-

## License

MIT — see [LICENSE](./LICENSE)
