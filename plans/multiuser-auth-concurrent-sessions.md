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
automated: full
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
| 1 | In `src/webui/src/app.d.ts`, add the `declare global { namespace App { interface Locals { user: { id: string; email: string; displayName: string; avatarUrl?: string } | null } } }` type. Done when `npm run check` passes — the `avatarUrl` field is `undefined` when absent from nullish users. | Add `user: { login: string; name: string; email: string; role: 'operator' \| 'contributor' \| 'viewer'; avatarUrl?: string } \| null` to `App.Locals`. This is the single type that all routes and hooks read. | ⏳ Pending |
| 2 | `createSession(user: User)` returns `Session { id, user, createdAt, expiresAt }`; `getSession(id)` returns `Session | null` (expired → null, never throws); `deleteSession(id)`. `User` type from Step 1's `App.Locals['user']`; `SESSION_TTL_SECONDS` read from `$env/static/private` with 86400 default. | `createSession(user)` → sessionId (crypto.randomUUID). `getSession(id)` → user or null. `deleteSession(id)`. TTL enforced on get (configurable via `SESSION_TTL_SECONDS`, default 86400). Redis adapter interface stubbed but not implemented. | ⏳ Pending |
| 3 | `src/hooks.server.ts` — implement session middleware that calls `getSession()` (defined in `src/lib/auth/session.ts` — create in this step), reads/writes cookie `dw_session` based on `AUTH_MODE` env var (`off`/`mock`/`live`), sets `event.locals.user` on every request (public routes too), redirects to `/login` with 302 when session is missing on a protected route per the `PUBLIC_ROUTES` constant (define in `src/lib/auth/constants.ts`). Success: `curl -v /api/protected-route` without cookie returns 302, with valid cookie returns 200+body, with `AUTH_MODE=off` always passes — all verified by test suite at `tests/auth/hooks.test.ts` (create passing tests in this step). | SvelteKit `handle()`: reads `dw_session` HttpOnly cookie, calls `getSession()`, sets `locals.user`. When `AUTH_MODE=none`, sets a synthetic local-admin user and skips all auth. When auth is required and user is null, redirects to `/login?next=<path>`. Passes through for public routes (`/login`, `/auth/callback`, `/api/brand`). | ⏳ Pending |
| **Phase 2 — Auth Providers** | | | |
| 4 | `forgejo-oauth.ts` — implement the full OAuth2 client: `buildAuthUrl` (returns valid Forgejo authorization URL), `exchangeCode` (token from real code), `fetchUser` (maps Forgejo user to `App.Locals['user']` shape), and role derivation from Forgejo team membership via `GET /api/v1/user/teams` — handle operator, contributor, and no-teams fallback (assigning Observer). Prerequisite: Forgejo OAuth application registered with callback URL, client ID and secret set in env. All four functions compile; role maps correctly for multi-team membership (highest wins) and zero-team edge case. | `buildAuthUrl(state)` → redirect URL. `exchangeCode(code, state)` → token response. `fetchUser(accessToken)` → user profile mapped to App.Locals user shape. Reads `FORGEJO_URL`, `FORGEJO_CLIENT_ID`, `FORGEJO_CLIENT_SECRET` from env. Role derived from Forgejo team membership (operators team → operator, else contributor). | ⏳ Pending |
| 5 | `local-auth.ts` — implement bcrypt password verification for local auth fallback using `LOCAL_AUTH_USER` and `LOCAL_AUTH_PASSWORD` env vars (aligning code with plan's stated bcrypt intent and fixing the env var name drift from `LOCAL_ADMIN_PASSWORD`). | Used when `AUTH_MODE=local`. Reads `LOCAL_ADMIN_PASSWORD` from env (bcrypt hash). Returns a single local-admin user on valid password. Intended for air-gapped / self-hosted installs without Forgejo. | ⏳ Pending |
| 6 | Implement `routes/auth/login/+page.svelte` with three rendering branches keyed to `AUTH_MODE` (`none` → redirect to `/`; `forgejo` → Forgejo OAuth button; `local` → credential form), pass through the `?next=` query param, and ensure the `AUTH_MODE` env var is plumbed via SvelteKit `$env` and backend credential validation exists for the `local` branch. | `src/webui/src/routes/login/+page.svelte` + `+page.server.ts`. When `AUTH_MODE=forgejo`: renders "Sign in with Forgejo" button that redirects to Forgejo OAuth. When `AUTH_MODE=local`: renders username/password form with POST action. When `AUTH_MODE=none`: server action immediately redirects to `/`. Preserves `?next=` param through the flow. | ⏳ Pending |
| 7 | OAuth callback route: with validated `oauth_state`, exchanges Forgejo code for session cookie (`SameSite=strict`), then redirects to `/`. | `src/webui/src/routes/auth/callback/+server.ts`. Validates state param (CSRF). Exchanges code via `forgejo-oauth.ts`. Creates session via `session.ts`. Sets `dw_session` cookie (HttpOnly, SameSite=Lax, Secure in production). Redirects to `next` param or `/`. | ⏳ Pending |
| **Phase 3 — Identity Propagation** | | | |
| 8 | Add user avatar/login display to `+layout.svelte` header bar (top-right). Shows initials if no avatar URL. Clicking opens a popover with name, email, role, and "Sign out" button that calls `POST /auth/logout` (wire the button here; route implementation deferred to Step 15). Hidden when `AUTH_MODE=none`. | Add user avatar/login display to `+layout.svelte` header bar (top-right). Shows initials if no avatar URL. Clicking opens a popover with name, email, role, and "Sign out" button that calls `/auth/logout` (DELETE session, clear cookie). Hidden when `AUTH_MODE=none`. | ⏳ Pending |
| 9 | Implement `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL` in `/api/git/commit` (done), add fallback `DocWright Server <noreply@docwright>` when `locals.user` is null, and verify via `git log` after saving through UI. Remove `/api/write`, `/api/rename`, `/api/delete` from scope — they don't call `git commit`. | Update all routes that call `git commit` to pass `--author="Name <email>"` using `event.locals.user`. Affected: `/api/write`, `/api/rename`, `/api/delete`, `/api/git/commit`, `/api/git/undo`. Fallback to `DocWright Server <noreply@docwright>` when user is null (should not happen in authenticated deployments). | ⏳ Pending |
| 10 | Add `SESSION_TTL_SECONDS=86400` to root `.env.example`, rename `LOCAL_AUTH_PASSWORD` → `LOCAL_ADMIN_PASSWORD` to match Step 5's naming, and list all local-auth vars: `LOCAL_ADMIN_PASSWORD`, `LOCAL_AUTH_EMAIL`, `LOCAL_AUTH_DISPLAY_NAME`. | Document all auth-related env vars with comments: `AUTH_MODE` (none/local/forgejo), `FORGEJO_URL`, `FORGEJO_CLIENT_ID`, `FORGEJO_CLIENT_SECRET`, `SESSION_SECRET` (used to sign cookies), `SESSION_TTL_SECONDS`, `LOCAL_ADMIN_PASSWORD`. | ⏳ Pending |
| **Phase 4 — Concurrent Write Safety (OCC)** | | | |
| 11 | Add SHA-256 prefix of raw file bytes to `GET /api/read` response as `ETag` header; frontend stores it in a reactive `$state() { path, content, etag }` record (shared contract for Step 12 If-Match). | `GET /api/read?path=` response includes `ETag: "<sha256-of-content>"` header. Frontend stores it when opening a document for editing. | ⏳ Pending |
| 12 | Add `If-Match` header validation to `POST /api/write`: reject with 409 if `currentEtag` (SHA-256 truncated to 16 hex chars) mismatches; include `currentContent` in 409 body for conflict UI. | `PUT /api/write` reads `If-Match` request header. If present, checks current file hash. Returns `409 Conflict` with body `{ conflict: true, currentEtag: "..." }` if mismatch. If `If-Match` absent, write proceeds (backward compat / new files). | ⏳ Pending |
| 13 | Ensure save endpoint supports `If-Match` and returns `409` with server's document content and version in the response body. Wire an editor save-error hook to catch `409` responses, then implement a conflict resolution panel (modal) showing a three-way merge: the editor's local version, the server's current version (from the `409` body), and a combined diff using `diff-match-patch`, with options to overwrite, review changes side-by-side in the modal, or discard local changes. | When editor receives `409` from save, shows a conflict dialog: "Someone else saved this document while you were editing." Options: "Discard my changes" (reload), "Keep my version" (force-write without If-Match), "Open diff" (side-by-side view of theirs vs mine). | ⏳ Pending |
| **Phase 5 — Hardening** | | | |
| 14 | Add a `requireRole(handler, ...roles)` wrapper and `isApiRequest` helper in `src/lib/server/auth.ts`. Apply to all existing API route handlers: wrap each handler, replacing `role === 'operator'` checks with `teams.includes()`. Add a Vitest test (`src/lib/server/auth.test.ts`) that imports every route module and asserts each has the wrapper applied. | Verify every API route under `src/webui/src/routes/api/` checks `locals.user` when `AUTH_MODE != none`. Admin-only routes (`/api/config` writes) require `role === 'operator'`. Return 401 for unauthenticated, 403 for insufficient role. Add a CI-friendly lint check or test that enumerates routes and verifies they are covered. | ⏳ Pending |
| 15 | Implement session expiry TTL enforcement with re-auth redirect in `hooks.server.ts` (distinct from Step 2's raw TTL — this wires the 302 to `/login` when `getSession()` returns null). Add `session_expires_at` display field driving the identity badge (Step 8). **Depends on:** Steps 2 (session store with TTL), 3 (hooks.server.ts `handle()`), 8 (badge), and 6/7 (login page as redirect target). | Implement logout route (`POST /auth/logout`): deletes session, clears cookie, redirects to `/login`. Enforce TTL in `getSession()` — expired sessions return null and trigger re-auth. Add `session_expires_at` to session store for display in identity badge. | ⏳ Pending |

---

## Testing Plan
### Step Verification
- [ ] Step 1: In `src/webui/src/app.d.ts`, add the `declare global { namespace App { interface Locals { user: { id: string; email: string; displayName: string; avatarUrl?: string }
- [ ] Step 2: `createSession(user: User)` returns `Session { id, user, createdAt, expiresAt }`; `getSession(id)` returns `Session
- [ ] Step 3: `src/hooks.server.ts` — implement session middleware that calls `getSession()` (defined in `src/lib/auth/session.ts` — create in this step), reads/writes cookie `dw_session` based on `AUTH_MODE` env var (`off`/`mock`/`live`), sets `event.locals.user` on every request (public routes too), redirects to `/login` with 302 when session is missing on a protected route per the `PUBLIC_ROUTES` constant (define in `src/lib/auth/constants.ts`). Success: `curl -v /api/protected-route` without cookie returns 302, with valid cookie returns 200+body, with `AUTH_MODE=off` always passes — all verified by test suite at `tests/auth/hooks.test.ts` (create passing tests in this step).
- [ ] Step 4: `forgejo-oauth.ts` — implement the full OAuth2 client: `buildAuthUrl` (returns valid Forgejo authorization URL), `exchangeCode` (token from real code), `fetchUser` (maps Forgejo user to `App.Locals['user']` shape), and role derivation from Forgejo team membership via `GET /api/v1/user/teams` — handle operator, contributor, and no-teams fallback (assigning Observer). Prerequisite: Forgejo OAuth application registered with callback URL, client ID and secret set in env. All four functions compile; role maps correctly for multi-team membership (highest wins) and zero-team edge case.
- [ ] Step 5: `local-auth.ts` — implement bcrypt password verification for local auth fallback using `LOCAL_AUTH_USER` and `LOCAL_AUTH_PASSWORD` env vars (aligning code with plan's stated bcrypt intent and fixing the env var name drift from `LOCAL_ADMIN_PASSWORD`).
- [ ] Step 6: Implement `routes/auth/login/+page.svelte` with three rendering branches keyed to `AUTH_MODE` (`none` → redirect to `/`; `forgejo` → Forgejo OAuth button; `local` → credential form), pass through the `?next=` query param, and ensure the `AUTH_MODE` env var is plumbed via SvelteKit `$env` and backend credential validation exists for the `local` branch.
- [ ] Step 7: OAuth callback route: with validated `oauth_state`, exchanges Forgejo code for session cookie (`SameSite=strict`), then redirects to `/`.
- [ ] Step 8: Add user avatar/login display to `+layout.svelte` header bar (top-right). Shows initials if no avatar URL. Clicking opens a popover with name, email, role, and "Sign out" button that calls `POST /auth/logout` (wire the button here; route implementation deferred to Step 15). Hidden when `AUTH_MODE=none`.
- [ ] Step 9: Implement `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL` in `/api/git/commit` (done), add fallback `DocWright Server <noreply@docwright>` when `locals.user` is null, and verify via `git log` after saving through UI. Remove `/api/write`, `/api/rename`, `/api/delete` from scope — they don't call `git commit`.
- [ ] Step 10: Add `SESSION_TTL_SECONDS=86400` to root `.env.example`, rename `LOCAL_AUTH_PASSWORD` → `LOCAL_ADMIN_PASSWORD` to match Step 5's naming, and list all local-auth vars: `LOCAL_ADMIN_PASSWORD`, `LOCAL_AUTH_EMAIL`, `LOCAL_AUTH_DISPLAY_NAME`.
- [ ] Step 11: Add SHA-256 prefix of raw file bytes to `GET /api/read` response as `ETag` header; frontend stores it in a reactive `$state() { path, content, etag }` record (shared contract for Step 12 If-Match).
- [ ] Step 12: Add `If-Match` header validation to `POST /api/write`: reject with 409 if `currentEtag` (SHA-256 truncated to 16 hex chars) mismatches; include `currentContent` in 409 body for conflict UI.
- [ ] Step 13: Ensure save endpoint supports `If-Match` and returns `409` with server's document content and version in the response body. Wire an editor save-error hook to catch `409` responses, then implement a conflict resolution panel (modal) showing a three-way merge: the editor's local version, the server's current version (from the `409` body), and a combined diff using `diff-match-patch`, with options to overwrite, review changes side-by-side in the modal, or discard local changes.
- [ ] Step 14: Add a `requireRole(handler, ...roles)` wrapper and `isApiRequest` helper in `src/lib/server/auth.ts`. Apply to all existing API route handlers: wrap each handler, replacing `role === 'operator'` checks with `teams.includes()`. Add a Vitest test (`src/lib/server/auth.test.ts`) that imports every route module and asserts each has the wrapper applied.
- [ ] Step 15: Implement session expiry TTL enforcement with re-auth redirect in `hooks.server.ts` (distinct from Step 2's raw TTL — this wires the 302 to `/login` when `getSession()` returns null). Add `session_expires_at` display field driving the identity badge (Step 8). Depends on: Steps 2 (session store with TTL), 3 (hooks.server.ts `handle()`), 8 (badge), and 6/7 (login page as redirect target).
- [ ] **Concurrency isolation**: Simultaneous writes from two authenticated users to different files succeed; concurrent writes to the same file fail with conflict; User A cannot read User B's session cookie or data.
- [ ] **OAuth error paths**: Forgejo unreachable returns readable "auth unavailable" error; user denying consent redirects gracefully; state nonce replay is rejected; expired token triggers refresh or clean re-auth.
## Rollback Procedures
If auth breaks local dev:
1. Set `AUTH_MODE=none` in `.env`
2. Restart the dev server — SvelteKit reads dotenv at startup only; a live server still holds the old value
3. `hooks.server.ts:16` checks for `none` first; no session/cookie code path runs

If a bad deploy locks out users in Docker:
1. Override at the deployment layer: `docker compose run -e AUTH_MODE=none` (editing `.env` inside the container is ignored when the env var is already set in the compose file)
2. Fix the issue, redeploy with the corrected config

If a bad deploy locks out users via systemd:
1. Stop the service, unset `AUTH_MODE` in the environment file or override with `Environment=AUTH_MODE=none`, restart the service
2. Fix the issue, restore the environment file, restart
## Risk Assessment
**HIGH — breaks local dev if AUTH_MODE default is wrong.** Mitigation: default to `AUTH_MODE=none`; require explicit opt-in to authenticated modes.

**MEDIUM — CSRF on OAuth callback.** Mitigation: state param generated server-side, validated on callback (Step 7).

**MEDIUM — session fixation.** Mitigation: `crypto.randomUUID()` for session IDs; regenerate on login.

**MEDIUM — weak or leaked `SESSION_SECRET`.** If under 32 bytes or exposed (env dump, `.env` in repo, logs), forged cookies bypass all auth. Mitigation: validate minimum 32-byte length on startup; `process.exit(1)` on failure; log a masked hint (`first 4 chars + "..."`).

**MEDIUM — brute-force on local auth login.** The `LOCAL_ADMIN_PASSWORD` endpoint (Step 5) has no rate limiting. Mitigation: rate-limit by IP (max 5 attempts/min); exponential backoff (double wait per failure, reset after 1 clean minute); log each failure with IP and timestamp.

**LOW — Redis adapter not implemented yet.** Single-process in-memory sessions are fine for Phase 2; horizontal scaling is deferred.
## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-29 | AI-improved via Review | NetYeti |
| 2026-06-28 | Wrote full implementation steps (15 steps across 5 phases), testing plan, rollback, risk assessment | NetYeti |
| 2026-06-27 | Created from approved proposal | NetYeti |
