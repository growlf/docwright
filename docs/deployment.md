---
title: "DocWright Deployment Scenarios"
status: active
author: NetYeti
created: 2026-06-03
tags:
  - documentation
  - deployment
  - architecture
---

# DocWright Deployment Scenarios

DocWright supports three deployment profiles. Each has different constraints
on networking, AI placement, authentication, and automation. The same codebase
covers all three — deployment profile selection controls behaviour.

---

## Scenario 1 — Standalone (Single Developer)

**Who:** One developer, one machine, local git workflow.

**Architecture:**
```
Developer's Machine
  ├── DocWright Web UI (SvelteKit, localhost:5173)
  ├── OpenCode (localhost:4096)
  ├── Git repository (local or Forgejo on same machine)
  └── Browser → http://localhost:5173
```

**Characteristics:**
- No HTTPS needed — everything is localhost
- No CORS friction — browser, DocWright, and OpenCode share the same origin context
- Git workflow: local commits, branches, direct push/pull
- AI: OpenCode runs locally, uses the developer's own API keys
- Auth: none required (trusted single-user)
- Chat panel: direct mode to `http://localhost:4096` works out of the box

**Key concerns:**
- Git status and branch awareness are the primary collaboration surface
- The developer IS the reviewer — phase gates and proposal approvals are self-managed
- CLAUDE.md and AGENTS.md are on the same filesystem as the AI

**Setup:** `npm run dev` + `opencode serve`. Nothing else required.

---

## Scenario 2 — Team Server (Shared DocWright, Individual AI)

**Who:** A team of 2–20 people, shared Forgejo server, each developer runs
their own OpenCode locally.

**Architecture:**
```
Server (e.g. server.cascade.steam)
  ├── DocWright Web UI (SvelteKit, HTTPS :443)
  ├── Forgejo (git server, HTTPS)
  └── No OpenCode on server

Each developer's machine:
  ├── OpenCode (localhost:4096)  ← personal AI, personal API keys
  └── Browser → https://server.cascade.steam
             ↘ http://localhost:4096 (direct OpenCode connection)
```

**Characteristics:**
- DocWright served over HTTPS — required for team access
- Each developer runs `opencode serve --cors https://server.cascade.steam`
  on their own machine
- AI traffic never touches the server — personal tokens, personal models
- Git: Forgejo handles branches, PRs, team permissions
- Auth: Forgejo OAuth (DocWright validates team membership for ACL)
- Chat panel: direct mode — each browser connects to its own OpenCode

**Key concerns:**
- CORS: OpenCode must be started with `--cors https://[docwright-server]`
  (the ChatPanel settings panel shows the exact command)
- Mixed content: HTTPS page → HTTP localhost. Modern Chrome/Edge allow
  this for localhost specifically; Safari may require additional config.
  Mitigation: document the browser requirements clearly.
- If a developer is away from their machine, AI chat is unavailable — that
  is acceptable and expected in this model. Vault access (read/write docs)
  works without OpenCode.
- Token usage is distributed — no shared API key, no single point of cost

**Setup:** DocWright on a server with TLS cert, Forgejo for git, each
developer runs opencode locally with the `--cors` flag.

---

## Scenario 3 — Enterprise (Server AI + Client AI + Automation)

**Who:** An organization with dedicated infrastructure, CI/CD workflows,
automated governance processing, and mixed online/offline operations.

**Architecture:**
```
Enterprise Server
  ├── DocWright Web UI (SvelteKit, HTTPS)
  ├── OpenCode (server-side, for automation)  ← NO personal keys
  ├── Forgejo + branch protection
  ├── Meshy / Ollama (local LLM inference, no external API calls)
  ├── Email intake processor
  ├── CI/CD webhook receiver
  └── Scheduled background jobs

Each developer's machine:
  ├── OpenCode (localhost:4096)  ← personal AI for interactive work
  └── Browser → https://docwright.enterprise.internal
             ↘ http://localhost:4096 (interactive AI)
             OR → /api/opencode (proxy to server AI for automation tasks)
```

**Characteristics:**
- Two AI layers: interactive (client OpenCode, personal) and automated (server OpenCode, shared)
- Server AI handles: CI/CD proposal generation, inbox email → issue conversion,
  scheduled compliance scans, phase gate reminders, offline processing
- Client AI handles: interactive document authoring, governance chat, reviews
- Forgejo handles auth + team membership + branch protection
- Local LLM via Meshy/Ollama keeps all AI traffic internal — no external API calls
- Automation workflows run even when no developer is logged in
- Both AI channels visible in the chat panel: a mode switch between
  "My OpenCode" and "Server OpenCode"

**Key concerns:**
- Server OpenCode needs its own API key / LLM config — separate from any
  individual developer's personal account
- The proxy mode in DocWright's chat panel routes to server OpenCode;
  direct mode routes to the developer's local instance
- CI/CD webhook handling requires a new dispatch integration
- Email intake (inbox.ts) requires SMTP/IMAP credentials on the server
- Offline processing (nightly scans, compliance checks) requires a job
  scheduler — cron or a lightweight queue
- Enterprise auth may require SAML/LDAP in addition to Forgejo OAuth

**Setup:** Full stack deployment. See proposals for each enterprise component.

---

## Comparison

| Concern | Standalone | Team Server | Enterprise |
|---|---|---|---|
| HTTPS | No | Yes | Yes |
| OpenCode location | Client = Server | Client only | Client + Server |
| Git server | Local | Forgejo | Forgejo + CI/CD |
| Auth | None | Forgejo OAuth | Forgejo + SAML/LDAP |
| Token usage | Personal | Personal (distributed) | Personal + Shared pool |
| Automation | None | None | Full |
| Offline AI | Yes (if local LLM) | No | Yes (Meshy/Ollama) |
| Multi-model | Dev choice | Dev choice | Governed by policy |
| CORS required | No | Yes | Yes |

---

## Mixed content (HTTPS + localhost HTTP)

In Team Server and Enterprise scenarios, the browser loads DocWright over
HTTPS but connects to OpenCode over HTTP on localhost. Browser behaviour:

- **Chrome / Edge**: allow HTTP requests to localhost from HTTPS pages as of
  Chrome 94+ (localhost is treated as a potentially trustworthy origin)
- **Firefox**: allows with a flag (`network.websocket.allowInsecureFromHTTPS`)
- **Safari**: restricts this. Mitigation: run opencode with a self-signed HTTPS
  cert on localhost, or use the server proxy mode

This is documented in the chat panel settings with browser-specific guidance.

---

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — three deployment scenarios defined | NetYeti |
