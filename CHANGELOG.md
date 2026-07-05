# Changelog

All notable changes to docwright will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.8] — 2026-07-05

### Fixed
- Docker image installs `openssh-client` so SSH git remotes / mounted deploy keys work — the entrypoint documented SSH-key auth but the client was absent, so all SSH git ops failed (#134)
- Plugin loader falls back to `DOCWRIGHT_ROOT` (then cwd) instead of reading `DOCWRIGHT_VAULT_ROOT` only, so vault plugins load in the container without an override (#131)

## [0.4.7] — 2026-07-04

### Added
- Env-driven `DOCWRIGHT_ALLOWED_HOSTS` for the Vite dev server so reverse-proxied deployments aren't 403'd on their `Host` header (#124)

### Fixed
- `/api/watch` no longer crashes the server on `.git` watcher races — the `FSWatcher` `error` event is handled and `.git/` events are filtered out (#121)
- `release-tag.sh` repo-slug regex no longer keeps the `.git` suffix, which had silently broken the post-tag CI watch on every release (#125)

## [0.4.6] — 2026-07-03

### Added
- Git sidebar panel — commit history + interactive file actions
- Search view container (consolidates the former Tags panel) with reactive navigation routing
- `contribute_upstream` MCP tool (environment-gated) + WebUI contribution workflow
- Interactive status tiles and executor-panel live feedback

### Changed
- First tagged release consumed by the BMS dev-cloud release-pinned instances

## [0.4.5] — 2026-06-29

### Added
- Multi-user auth layer: SvelteKit session middleware, in-memory session store with configurable `SESSION_TTL_SECONDS`, bcrypt local auth, Forgejo OAuth with CSRF state and `returnTo` preservation
- `requireAuth` / `requireRole` wrappers applied to all 7 mutable API routes
- `AUTH_MODE=none` now sets a synthetic dev user so git commits are attributed in local dev
- Session expiry display in UserBadge toolbar popover
- `src/lib/server/auth.ts` and `src/lib/auth/constants.ts` — new files
- `bcryptjs` and `diff-match-patch` added to webui dependencies

### Changed
- `GET /api/read` now returns an `ETag` header (SHA-256 prefix)
- `POST /api/write` validates `If-Match` header; returns 409 on conflict with `currentContent` in body
- Conflict resolution modal upgraded to three-pane view: your version / server version / diff-match-patch highlighted changes
- Both `.env.example` files fully documented with all auth variables
- `docs/authentication.md` updated: bcrypt requirement, `SESSION_TTL_SECONDS`, three-pane diff

### Fixed
- Stray `/**` in `opencode.ts` was silently commenting out `getSessionMessages` function
- Time-dependent `dayGroup` tests replaced with deterministic midnight-anchored assertions
- `forkSession` export in `opencode-bridge.ts` was missing `async function` keyword (Vite/OXC parse error)

## [Unreleased]

### Added
- Initial repository structure
- PROJECT.md v0.8 — full architecture specification
- CLAUDE.md — AI agent context for Claude Code sessions
- Bundled profile stubs: org-operations, doc-lifecycle, infra-topology, knowledge-base
- Example vault with Cascade STEAM seed documents
- Phase 0 spike directory for opencode serve validation
