---
title: Multi-User Auth and Concurrent Session Support
author: NetYeti
created: 2026-06-27
tags:
  - auth
  - security
  - multiuser
  - web-ui
  - phase-2
  - infrastructure
complexity: high
priority: critical
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to: []
depends_on: []
blocks:
  - proposals/governance-engine-view-container.md
---

# Multi-User Auth and Concurrent Session Support

## Summary

DocWright is designed to run as a service for multiple concurrent users. Currently
every API endpoint is open, git commits are attributed to the server process, and
there is no identity in the audit trail. This proposal adds SvelteKit session middleware,
Forgejo OAuth as the primary auth provider, per-request identity, authenticated git
attribution, and concurrent-write safety — before any further API surface is added.

## Problem Statement

The current system has no authentication. This means:

- Any user on the network can read and write any document
- Git commits say "DocWright Server" instead of the user who made the change
- The governance audit trail (`ai-last-action:`, `approved: true`, hook events) cannot
  be trusted because there is no verified identity behind it
- Concurrent writes from two users to the same document will silently corrupt each other
- The Governance Engine's "who approved this / who acted on this hook" is meaningless
  without authenticated identity
- Deploying DocWright as a shared service (the primary use case) is not safe

Adding auth after the fact means touching every API route. The right time is now,
before the API surface grows further.

## Proposed Solution

### Layer 1 — SvelteKit session middleware (`hooks.server.ts`)

A single `handle()` function in `src/webui/src/hooks.server.ts` intercepts every
request before it reaches any route or API endpoint.

- Reads a signed session cookie (`dw-session`)
- Resolves the session to a `User` object (`{ id, username, email, displayName, avatarUrl, role }`)
- Attaches the user to `event.locals.user`
- Redirects unauthenticated requests to `/login` (except `/login`, `/auth/callback`, and `/api/health`)
- API routes read `event.locals.user` — no per-route auth boilerplate

### Layer 2 — Forgejo OAuth flow

```
User → /login → Forgejo OAuth authorize → /auth/callback → session cookie → redirect
```

- `/login` renders a "Sign in with Forgejo" button (brand-able: Gitea, Codeberg, etc.)
- `/auth/callback` exchanges the code for a Forgejo access token, fetches user profile,
  creates a signed session, sets `dw-session` cookie (HttpOnly, Secure, SameSite=Lax)
- Session store: server-side map in memory (single-process) with TTL; Redis adapter for
  multi-process deployments (Phase 3)
- Forgejo team membership resolves the user's `role` (`admin`, `contributor`, `viewer`)
  matching the existing ACL design

### Layer 3 — Local auth fallback

For local/air-gapped deployments without a Forgejo instance:

- `AUTH_MODE=local` in `.env` enables a simple username/password flow
- Credentials stored in `config/users.json` (bcrypt hashed), managed via CLI
- Same `User` shape, same session middleware — routes are auth-provider-agnostic
- `AUTH_MODE=none` disables auth entirely (trusted-network / single-user local dev)

Default: `AUTH_MODE=forgejo` (requires `FORGEJO_URL`, `FORGEJO_CLIENT_ID`,
`FORGEJO_CLIENT_SECRET` in `.env`).

### Layer 4 — Authenticated git attribution

Every git write operation (create, rename, delete, commit, push) uses the authenticated
user's identity:

```typescript
// In git API handlers
const { username, email } = event.locals.user;
await git.commit({
  message,
  author: { name: username, email },
});
```

This replaces the current server-process attribution. The audit trail becomes trustworthy.

### Layer 5 — Concurrent write safety (OCC)

The dispatch module already defines the OCC pattern. This proposal wires it into the
write API endpoints:

- `PUT /api/write` accepts an optional `etag` header (SHA of the file content at read time)
- If the file has changed since the etag was issued, the server returns `409 Conflict`
  with the current content
- The UI shows a merge conflict resolution dialog (accept theirs / accept mine / diff)
- Document properties pane sends the etag on every save

This prevents silent overwrites when two users edit the same file concurrently.

### Layer 6 — Identity in the governance audit trail

Every governance action (proposal create/approve, plan step update, hook fire) records
the authenticated user:

```yaml
ai-last-action: "step-done"
ai-last-action-by: "NetYeti"          # human or AI identity
ai-last-action-at: "2026-06-27T21:00"
```

The Governance Engine VC surface this trail in the Hook Status and Lifecycle sub-views.

### Configuration (`.env` additions)

```bash
AUTH_MODE=forgejo          # forgejo | local | none
FORGEJO_URL=https://git.example.com
FORGEJO_CLIENT_ID=...
FORGEJO_CLIENT_SECRET=...
SESSION_SECRET=...         # random 32-byte hex string
SESSION_TTL_HOURS=8        # default 8h
```

### UI changes

- `/login` — brand-aware sign-in page (DocWright/Forgejo logos, "Sign in" button)
- `/auth/callback` — server route only, no UI
- User identity badge in `.app-toolbar` (avatar, username, sign-out link)
- `AUTH_MODE=none` hides the identity badge entirely

## Expected Outcomes

- DocWright is safe to run as a shared service on a network
- Every git commit is attributed to the correct user
- The governance audit trail has verifiable identity
- Concurrent writers see conflict prompts instead of silent data loss
- Forgejo team membership drives ACL (already designed, now wired)
- Local / air-gapped deployments work without an external auth provider
- Auth is invisible when `AUTH_MODE=none` (single-user local dev unchanged)

## Resources Required

- `src/webui/src/hooks.server.ts` (new — the session middleware)
- `src/webui/src/routes/login/+page.svelte` + `+page.server.ts`
- `src/webui/src/routes/auth/callback/+server.ts`
- `src/webui/src/app.d.ts` — extend `App.Locals` with `user`
- `src/webui/src/lib/server/session.ts` — session store (in-memory + Redis adapter stub)
- `src/webui/src/lib/server/forgejo-oauth.ts` — OAuth client
- `src/webui/src/lib/server/local-auth.ts` — local auth fallback
- All git API handlers updated to use `event.locals.user` for attribution
- `PUT /api/write` — etag support
- `app-toolbar` — identity badge component
- `.env.example` updated with auth vars

## Alternatives Considered

**JWT stored in localStorage** — rejected. XSS-vulnerable. HttpOnly cookie is safer.

**Always-on Forgejo** — rejected. Air-gapped orgs and local-dev users need `AUTH_MODE=local`
or `AUTH_MODE=none`. The middleware is provider-agnostic.

**Database-backed sessions** — deferred to Phase 3. In-memory sessions with TTL are
sufficient for single-process deployments. Redis adapter is stubbed now, implemented when
horizontal scaling is needed.

**Per-route auth guards** — rejected. Single `hooks.server.ts` handle() is the SvelteKit
idiomatic approach and keeps all auth logic in one place.

## Future

- Redis session store for multi-process / load-balanced deployments (Phase 3)
- Per-vault ACL (a user can read vault A but not write vault B) — depends on project registry work
- Passkey / WebAuthn support — deferred
- LDAP/AD adapter — deferred (community contribution welcome)
- Audit log viewer in the Governance Engine VC (reads `.docwright/audit.jsonl`)
