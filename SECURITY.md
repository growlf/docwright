# Security Policy

## Supported Versions

docwright is currently in pre-alpha. Security fixes will be applied to the
latest version only.

| Version | Supported |
|---------|-----------|
| 0.x.x   | ✅        |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Email: garth.johnson@cascadesteam.org

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive a response within 48 hours. If the vulnerability is confirmed,
we will work with you on a coordinated disclosure timeline.

## Scope

Security concerns relevant to docwright include:
- The Web UI server (localhost by default — binds to 127.0.0.1 only)
- The Forgejo OAuth integration (`AUTH_MODE=forgejo`)
- Session management — HttpOnly `dw_session` cookie, 8-hour TTL, in-memory store
- Optimistic Concurrency Control — ETag / `If-Match` conflict detection on file writes
- The AI dispatch layer and trust tier enforcement
- The `author-role:` ACL model
- Pre-receive hook scripts
- The MCP server endpoints (lifecycle governance tools)

Out of scope: vulnerabilities in upstream dependencies (OpenCode, Forgejo,
SvelteKit, markdown-it). Please report those to their respective projects.

## Authentication notes

`AUTH_MODE=none` (the default) provides no access control. Do not expose a DocWright
instance running in `none` mode on a network. Use `local` or `forgejo` for any
deployment accessible beyond localhost.

`SESSION_SECRET` must be a cryptographically random value (minimum 32 bytes hex).
Generate with `openssl rand -hex 32`. Changing it invalidates all active sessions.

See [docs/authentication.md](./docs/authentication.md) for the full auth setup guide.
