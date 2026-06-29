---
title: "Authentication Setup"
status: active
author: NetYeti
created: 2026-06-28
tags:
  - documentation
  - authentication
  - deployment
---

# Authentication Setup

DocWright supports three authentication modes, selected by the `AUTH_MODE` environment
variable. All modes use HttpOnly session cookies (8-hour TTL) once authenticated.

---

## Mode overview

| Mode | Use case | Users |
|---|---|---|
| `none` | Single-developer local work | No login — full access |
| `local` | Personal or air-gapped deployments | One admin account |
| `forgejo` | Team deployments | Any Forgejo user with server access |

---

## AUTH_MODE=none (default)

No login required. The server creates a synthetic local-dev identity from
`LOCAL_AUTH_USER` / `LOCAL_AUTH_EMAIL` / `LOCAL_AUTH_DISPLAY_NAME` (all optional,
fall back to `dev` / `dev@localhost` / `Dev User`). Git commits are attributed to
this identity. Do not expose this mode on a network.

```env
AUTH_MODE=none
```

No other variables are required.

---

## AUTH_MODE=local

A single admin account defined in `.env`. Suitable for personal VPS deployments or
air-gapped systems where Forgejo is not available.

```env
AUTH_MODE=local
SESSION_SECRET=<generate with: openssl rand -hex 32>
SESSION_TTL_SECONDS=86400
LOCAL_AUTH_USER=admin
LOCAL_AUTH_PASSWORD=<bcrypt hash — see below>
LOCAL_AUTH_EMAIL=admin@example.com
LOCAL_AUTH_DISPLAY_NAME="Admin"
```

Generate a bcrypt hash for your password:
```bash
node -e "require('bcryptjs').hash('yourpassword', 10).then(console.log)"
```

**Adding users:** Local mode supports exactly one account. If you need multiple users,
switch to `AUTH_MODE=forgejo`. There is no user database — credentials live in `.env`.

**Changing the password:** Edit `LOCAL_AUTH_PASSWORD` in `.env` and restart the server.
Existing sessions remain valid until they expire (8 hours).

---

## AUTH_MODE=forgejo

Forgejo OAuth2 — any Forgejo user with access to your instance can log in. Team
membership determines ACL role (Observer / Contributor / Steward / Governance).

### Step 1 — Create an OAuth2 application in Forgejo

1. Log in to Forgejo as an admin
2. Go to **Site Administration → Applications → Manage OAuth2 Applications**
   (or any user's **Settings → Applications** for a user-scoped app)
3. Click **Create OAuth2 Application**
4. Set the redirect URI: `https://<your-docwright-host>/auth/callback`
   - For local testing: `http://localhost:5173/auth/callback`
5. Note the **Client ID** and **Client Secret**

### Step 2 — Configure DocWright

```env
AUTH_MODE=forgejo
SESSION_SECRET=<generate with: openssl rand -hex 32>
FORGEJO_URL=https://git.example.com
FORGEJO_CLIENT_ID=<from step 1>
FORGEJO_CLIENT_SECRET=<from step 1>
```

### Step 3 — Restart the Web UI

```bash
cd src/webui
npm run dev   # or restart your Docker container
```

### Adding users

Any Forgejo account that can authenticate to your Forgejo instance can log in to
DocWright. Access control is managed through Forgejo team membership:

| Forgejo team | DocWright role |
|---|---|
| `observers` | Observer — read-only |
| `contributors` (default) | Contributor — read/write |
| `stewards` | Steward — can approve proposals |
| `governance` | Governance — full lifecycle authority |

To add a user:
1. Create a Forgejo account (or have them self-register if Forgejo allows it)
2. Add the account to the appropriate team in Forgejo
3. The user logs into DocWright via the **Sign in with Forgejo** button

**Revoking access:** Remove the Forgejo account from the team or disable the account.
Existing sessions expire after 8 hours; to force immediate revocation, restart the
DocWright server (all in-memory sessions are cleared on restart).

---

## Session management

Sessions are stored in memory on the DocWright server process. Consequences:

- Sessions are lost when the server restarts (users must log in again)
- No cross-process session sharing — single-process only in the current implementation
- TTL: configurable via `SESSION_TTL_SECONDS` (default: 86400s / 24h)
- Cookie: `dw_session`, HttpOnly, SameSite=Strict, Secure flag set when served over HTTPS

**Generating a secure SESSION_SECRET:**
```bash
openssl rand -hex 32
```

Keep this value secret. Changing it invalidates all active sessions.

---

## Optimistic Concurrency Control

When `AUTH_MODE != none`, file edits include ETag-based conflict detection:

- `GET /api/read` returns an `ETag` header (SHA-256 prefix of the file content)
- `POST /api/write` with `If-Match: <etag>` fails with `409 Conflict` if the file
  was modified since it was last read
- The editor shows a three-pane dialog: **Your version / Server version / Changes diff** (highlighted with diff-match-patch), with actions: Cancel / Take server version / Overwrite with mine

This protects against two users (or a user + an AI agent) writing conflicting edits
to the same file simultaneously. It is active for all users regardless of auth mode.

---

## Docker deployment with auth

```yaml
# docker-compose.yml excerpt
services:
  docwright:
    environment:
      AUTH_MODE: forgejo
      SESSION_SECRET: "${SESSION_SECRET}"
      FORGEJO_URL: "${FORGEJO_URL}"
      FORGEJO_CLIENT_ID: "${FORGEJO_CLIENT_ID}"
      FORGEJO_CLIENT_SECRET: "${FORGEJO_CLIENT_SECRET}"
```

All values are read from the `.env` file at the project root. See [docs/deployment.md](./deployment.md)
for full Docker setup instructions.

---

## Troubleshooting

**Login button does nothing / redirect fails:**
- Check that `FORGEJO_URL` has no trailing slash
- Verify the redirect URI in Forgejo exactly matches `<your-docwright-url>/auth/callback`
- Ensure `SESSION_SECRET` is set (required when `AUTH_MODE != none`)

**"invalid_grant" error on callback:**
- OAuth codes are single-use and expire quickly. Do not reload the callback URL.
- Check the Forgejo application's redirect URI matches exactly (http vs https, port)

**User logged in but gets 403 on actions:**
- Check Forgejo team membership — the user must be in a team with Contributor or higher role

**Sessions not persisting after server restart:**
- Expected behavior — in-memory sessions clear on restart. Persistent session storage
  is planned for a future phase.

---

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-28 | Created — auth modes, Forgejo OAuth setup, user management, OCC | NetYeti |
