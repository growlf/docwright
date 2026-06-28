---
title: Multi-User Auth and Concurrent Session Support
status: approved
author: NetYeti
created: 2026-06-27
tags:
  - auth
  - security
  - multiuser
  - web-ui
  - phase-2
  - infrastructure
proposal_source: proposals/approved/multiuser-auth-concurrent-sessions.md
priority: critical
complexity: high
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/multiuser-auth-concurrent-sessions.md
scenario_synthesis: "Happy path: hooks.server.ts intercepts every request, resolves session, attaches user to locals; Forgejo OAuth flow creates signed cookie; all git commits carry authenticated identity; concurrent writes return 409 with conflict UI. Failure path: AUTH_MODE=none bypasses all auth (local dev unchanged); Forgejo unreachable falls back to login error page with retry; OCC conflict shows diff dialog, never silently overwrites."
---

# Multi-User Auth and Concurrent Session Support

## Overview

_Plan generated from approved proposal: Multi-User Auth and Concurrent Session Support_

### Overview

# Multi-User Auth and Concurrent Session Support

### Summary

DocWright is designed to run as a service for multiple concurrent users. Currently
every API endpoint is open, git commits are attributed to the server process, and
there is no identity in the audit trail. This proposal adds SvelteKit session middleware,
Forgejo OAuth as the primary auth provider, per-request identity, authenticated git
attribution, and concurrent-write safety — before any further API surface is added.

### Problem Statement

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

### Expected Outcomes

- DocWright is safe to run as a shared service on a network
- Every git commit is attributed to the correct user
- The governance audit trail has verifiable identity
- Concurrent writers see conflict prompts instead of silent data loss
- Forgejo team membership drives ACL (already designed, now wired)
- Local / air-gapped deployments work without an external auth provider
- Auth is invisible when `AUTH_MODE=none` (single-user local dev unchanged)

### Resources Required

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

### Alternatives Considered

**JWT stored in localStorage** — rejected. XSS-vulnerable. HttpOnly cookie is safer.

**Always-on Forgejo** — rejected. Air-gapped orgs and local-dev users need `AUTH_MODE=local`
or `AUTH_MODE=none`. The middleware is provider-agnostic.

**Database-backed sessions** — deferred to Phase 3. In-memory sessions with TTL are
sufficient for single-process deployments. Redis adapter is stubbed now, implemented when
horizontal scaling is needed.

**Per-route auth guards** — rejected. Single `hooks.server.ts` handle() is the SvelteKit
idiomatic approach and keeps all auth logic in one place.

### Future

- Redis session store for multi-process / load-balanced deployments (Phase 3)
- Per-vault ACL (a user can read vault A but not write vault B) — depends on project registry work
- Passkey / WebAuthn support — deferred
- LDAP/AD adapter — deferred (community contribution welcome)
- Audit log viewer in the Governance Engine VC (reads `.docwright/audit.jsonl`)


## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | | | ⏳ Pending |

## Testing Plan

_Testing plan TBD_

## Rollback Procedures

_Rollback procedures TBD_

## Risk Assessment

_Risk assessment TBD_

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-27 | Created from approved proposal | NetYeti |
