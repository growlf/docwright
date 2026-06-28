---
title: Multi-User Auth and Concurrent Session Support
status: approved
author: NetYeti
created: 2026-06-27
type: plan
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
tests_defined: true
tests_human_reviewed: false
_path: plans/multiuser-auth-concurrent-sessions.md
total_steps: 15
completed_steps: 0
scenario_synthesis: "Happy path: hooks.server.ts intercepts every request, resolves session, attaches user to locals; Forgejo OAuth flow creates signed cookie; all git commits carry authenticated identity; concurrent writes return 409 with conflict UI. Failure path: AUTH_MODE=none bypasses all auth (local dev unchanged); Forgejo unreachable falls back to login error page with retry; OCC conflict shows diff dialog, never silently overwrites."
---

# Multi-User Auth and Concurrent Session Support

## Overview

_Plan generated from approved proposal: Multi-User Auth and Concurrent Session Support_

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
| **Phase 1 — Foundation** | | | |
| 1 | `app.d.ts` — extend App.Locals | Add `user: { login: string; name: string; email: string; role: 'operator' \| 'contributor' \| 'viewer'; avatarUrl?: string } \| null` to `App.Locals`. This is the single type that all routes and hooks read. | ⏳ Pending |
| 2 | `session.ts` — in-memory session store | `createSession(user)` → sessionId (crypto.randomUUID). `getSession(id)` → user or null. `deleteSession(id)`. TTL enforced on get (configurable via `SESSION_TTL_SECONDS`, default 86400). Redis adapter interface stubbed but not implemented. | ⏳ Pending |
| 3 | `hooks.server.ts` — session middleware | SvelteKit `handle()`: reads `dw_session` HttpOnly cookie, calls `getSession()`, sets `locals.user`. When `AUTH_MODE=none`, sets a synthetic local-admin user and skips all auth. When auth is required and user is null, redirects to `/login?next=<path>`. Passes through for public routes (`/login`, `/auth/callback`, `/api/brand`). | ⏳ Pending |
| **Phase 2 — Auth Providers** | | | |
| 4 | `forgejo-oauth.ts` — OAuth2 client | `buildAuthUrl(state)` → redirect URL. `exchangeCode(code, state)` → token response. `fetchUser(accessToken)` → user profile mapped to App.Locals user shape. Reads `FORGEJO_URL`, `FORGEJO_CLIENT_ID`, `FORGEJO_CLIENT_SECRET` from env. Role derived from Forgejo team membership (operators team → operator, else contributor). | ⏳ Pending |
| 5 | `local-auth.ts` — local auth fallback | Used when `AUTH_MODE=local`. Reads `LOCAL_ADMIN_PASSWORD` from env (bcrypt hash). Returns a single local-admin user on valid password. Intended for air-gapped / self-hosted installs without Forgejo. | ⏳ Pending |
| 6 | Login page | `src/webui/src/routes/login/+page.svelte` + `+page.server.ts`. When `AUTH_MODE=forgejo`: renders "Sign in with Forgejo" button that redirects to Forgejo OAuth. When `AUTH_MODE=local`: renders username/password form with POST action. When `AUTH_MODE=none`: server action immediately redirects to `/`. Preserves `?next=` param through the flow. | ⏳ Pending |
| 7 | OAuth callback route | `src/webui/src/routes/auth/callback/+server.ts`. Validates state param (CSRF). Exchanges code via `forgejo-oauth.ts`. Creates session via `session.ts`. Sets `dw_session` cookie (HttpOnly, SameSite=Lax, Secure in production). Redirects to `next` param or `/`. | ⏳ Pending |
| **Phase 3 — Identity Propagation** | | | |
| 8 | Identity badge in app toolbar | Add user avatar/login display to `+layout.svelte` header bar (top-right). Shows initials if no avatar URL. Clicking opens a popover with name, email, role, and "Sign out" button that calls `/auth/logout` (DELETE session, clear cookie). Hidden when `AUTH_MODE=none`. | ⏳ Pending |
| 9 | Authenticated git attribution | Update all routes that call `git commit` to pass `--author="Name <email>"` using `event.locals.user`. Affected: `/api/write`, `/api/rename`, `/api/delete`, `/api/git/commit`, `/api/git/undo`. Fallback to `DocWright Server <noreply@docwright>` when user is null (should not happen in authenticated deployments). | ⏳ Pending |
| 10 | `.env.example` — auth vars | Document all auth-related env vars with comments: `AUTH_MODE` (none/local/forgejo), `FORGEJO_URL`, `FORGEJO_CLIENT_ID`, `FORGEJO_CLIENT_SECRET`, `SESSION_SECRET` (used to sign cookies), `SESSION_TTL_SECONDS`, `LOCAL_ADMIN_PASSWORD`. | ⏳ Pending |
| **Phase 4 — Concurrent Write Safety (OCC)** | | | |
| 11 | ETag on file reads | `GET /api/read?path=` response includes `ETag: "<sha256-of-content>"` header. Frontend stores it when opening a document for editing. | ⏳ Pending |
| 12 | `If-Match` check on writes | `PUT /api/write` reads `If-Match` request header. If present, checks current file hash. Returns `409 Conflict` with body `{ conflict: true, currentEtag: "..." }` if mismatch. If `If-Match` absent, write proceeds (backward compat / new files). | ⏳ Pending |
| 13 | Conflict UI in editor | When editor receives `409` from save, shows a conflict dialog: "Someone else saved this document while you were editing." Options: "Discard my changes" (reload), "Keep my version" (force-write without If-Match), "Open diff" (side-by-side view of theirs vs mine). | ⏳ Pending |
| **Phase 5 — Hardening** | | | |
| 14 | Route protection audit | Verify every API route under `src/webui/src/routes/api/` checks `locals.user` when `AUTH_MODE != none`. Admin-only routes (`/api/config` writes) require `role === 'operator'`. Return 401 for unauthenticated, 403 for insufficient role. Add a CI-friendly lint check or test that enumerates routes and verifies they are covered. | ⏳ Pending |
| 15 | Session expiry + logout | Implement logout route (`POST /auth/logout`): deletes session, clears cookie, redirects to `/login`. Enforce TTL in `getSession()` — expired sessions return null and trigger re-auth. Add `session_expires_at` to session store for display in identity badge. | ⏳ Pending |

---

## Testing Plan

### Step Verification

- [ ] Step 1: App.Locals type compiles; all existing routes typecheck with `locals.user`
- [ ] Step 2: Session store get/set/delete; TTL expiry returns null
- [ ] Step 3: `AUTH_MODE=none` — no redirect, synthetic user in locals; `AUTH_MODE=forgejo` — unauthenticated request redirects to `/login`
- [ ] Step 4: OAuth URL builds correctly; user fetch maps to correct role
- [ ] Step 5: Local auth accepts correct password, rejects wrong password
- [ ] Step 6: Login page renders correct form per AUTH_MODE; `?next=` preserved
- [ ] Step 7: Callback validates state, sets cookie, redirects to `next`
- [ ] Step 8: Identity badge shows login/initials; sign-out clears session and cookie
- [ ] Step 9: Git commits after save carry authenticated user's name/email in git log
- [ ] Step 10: All env vars documented in `.env.example`
- [ ] Step 11: GET /api/read response includes ETag header
- [ ] Step 12: PUT /api/write with stale If-Match returns 409
- [ ] Step 13: Conflict dialog appears on 409; discard/keep/diff all function
- [ ] Step 14: Unauthenticated API call returns 401; contributor calling operator route returns 403
- [ ] Step 15: Logout clears cookie; expired session triggers re-auth

### Integration & Regression

- [ ] `AUTH_MODE=none` — existing e2e suite passes without any login prompts
- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions in `AUTH_MODE=none` (local dev must be unaffected)

## Rollback Procedures

If auth breaks local dev:
1. Set `AUTH_MODE=none` in `.env` — bypasses all auth, restores previous behavior
2. The hook checks this first; no code path for session/cookie runs in none mode

If a bad deploy locks out users:
1. Restart server with `AUTH_MODE=none` to restore access
2. Fix the issue, redeploy with correct `AUTH_MODE`

## Risk Assessment

**HIGH — breaks local dev if AUTH_MODE default is wrong.** Mitigation: default to `AUTH_MODE=none`; require explicit opt-in to authenticated modes.

**MEDIUM — CSRF on OAuth callback.** Mitigation: state param generated server-side, validated on callback (Step 7).

**MEDIUM — session fixation.** Mitigation: `crypto.randomUUID()` for session IDs; regenerate on login.

**LOW — Redis adapter not implemented yet.** Single-process in-memory sessions are fine for Phase 2; horizontal scaling is deferred.

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-28 | Wrote full implementation steps (15 steps across 5 phases), testing plan, rollback, risk assessment | NetYeti |
| 2026-06-27 | Created from approved proposal | NetYeti |
