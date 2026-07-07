---
title: "Comprehensive User Management System for DocWright"
author: Claude (on behalf of user)
created: 2026-07-07
tags:
  - user-management
  - acl
  - multi-user
  - phase-4
  - backend
  - webui
approved: false
created_by: "claude@claude-code"
assigned_to: ""
---

## Problem

DocWright's current user and authentication system has significant gaps:

1. **Local auth is single-user only** — designed for air-gapped/dev deployments
   - Cannot accommodate multiple users on the same instance
   - No way to invite or manage additional accounts
   - Cascade STEAM and other production instances need multi-user support

2. **User tier management is manual** — no GUI
   - Tiers (observer, contributor, steward, governance) exist in code but are managed by editing `.docwright/contributors.json` directly
   - No audit trail for who changed whose permissions
   - No self-service way for admins to manage users
   - Inconsistent between local auth and Forgejo OAuth deployments

3. **Settings UI is incomplete** — currently just links
   - No user management section
   - No tier assignment interface
   - No user creation/deletion/editing flows

4. **Production OAuth (Forgejo) is separate from local workflow**
   - Development teams and air-gapped deployments have no good path to multi-user
   - Tiers are implicit in Forgejo team membership, not explicit
   - No uniform user management across deployment modes

## Proposed Solution

Build a complete, scoped User Management System with three components:

### 1. Backend User Storage & API

**Data Model:**
```typescript
interface DocWrightUser {
  id: string;                          // UUID
  username: string;                    // unique
  email: string;
  displayName: string;
  passwordHash?: string;               // bcrypt (local auth only; null for OAuth)
  tier: 'observer' | 'contributor' | 'steward' | 'governance';
  status: 'active' | 'suspended' | 'archived';
  createdAt: ISO8601;
  createdBy: string;                   // username of who created this user
  lastLogin?: ISO8601;
  lastModifiedAt?: ISO8601;
  lastModifiedBy?: string;
  metadata?: Record<string, unknown>;  // extensible for future use
}

interface UserAuditLog {
  id: string;
  userId: string;
  action: 'created' | 'modified' | 'tier_changed' | 'status_changed' | 'password_reset' | 'suspended' | 'activated' | 'archived';
  changedBy: string;
  changes: Record<string, [oldValue, newValue]>;
  timestamp: ISO8601;
  ipAddress?: string;
  userAgent?: string;
}
```

**Storage:**
- SQLite database (development/single-server)
- Optional: PostgreSQL adapter for scaling
- Schema migrations via `npm run db:migrate`
- Persisted in vault directory (`.docwright/users.db`)

**API Endpoints:**

**Users (require `steward` tier minimum):**
- `POST /api/admin/users` — Create new user
- `GET /api/admin/users` — List all users (paginated)
- `GET /api/admin/users/:id` — Get single user
- `PATCH /api/admin/users/:id` — Update user (username, email, displayName, status)
- `PUT /api/admin/users/:id/tier` — Change user tier
- `PUT /api/admin/users/:id/password-reset` — Force password reset (send reset link)
- `DELETE /api/admin/users/:id` — Archive user (soft-delete, not removable)

**Self-Service (all authenticated users):**
- `GET /api/auth/me` — Current user info
- `PUT /api/auth/me` — Update own profile (displayName, email)
- `PUT /api/auth/me/password` — Change own password
- `GET /api/auth/sessions` — List active sessions
- `DELETE /api/auth/sessions/:sessionId` — Revoke session

**Audit (require `governance` tier):**
- `GET /api/admin/audit-logs` — View all user management actions
- `GET /api/admin/audit-logs?userId=X&action=Y&since=Z` — Filter audit logs

### 2. Frontend UI Components

**Settings → User Management Section** (visible only to `steward`+):

**User List:**
- Table view: Username, Email, Tier, Status, Last Login, Actions
- Search/filter by username, email, tier
- Sort by created date, last login
- Pagination (20 users/page)
- Bulk actions: export CSV, change tier for multiple users

**Create User Dialog:**
- Fields: Username, Email, Display Name, Password (auto-generated or custom), Tier
- Validation: username uniqueness, email format, password strength
- Post-create: show one-time password or reset link
- Copy credentials to clipboard option

**Edit User Modal:**
- Display Name, Email, Status (active/suspended), Tier
- Password reset button (sends link)
- Audit log for this user (below)
- Delete button (archives user, soft-delete)

**User Profile Card** (self-service in Settings):
- Display Name, Email, Username, Tier (read-only)
- Change Password form
- Active Sessions list
- Account created date, last login

**Audit Log Viewer** (governance tier only):
- Filterable table: User, Action, Changed By, Timestamp
- Search by username, action type, date range
- Export to CSV
- Detail view for each action

### 3. Authentication & Security

**Password Requirements:**
- Minimum 12 characters
- Uppercase + lowercase + number + special char
- No reuse of last 5 passwords
- Expiry optional (configurable)

**Session Management:**
- Current: httpOnly cookie + in-memory (stateless)
- Upgrade: Add session table for audit trail
- Track: creation time, IP, user agent, last activity
- TTL: configurable (default 24h)
- Logout clears session

**Password Reset Flow:**
- Admin generates reset link (valid 24h)
- User clicks link, sets new password
- Old password not required (but can optionally be)
- Audit log: "password_reset initiated by $admin"

**Tier-Based Access Control:**
- `observer` — read all docs, no write/create
- `contributor` — observer + write + create documents (default for new users)
- `steward` — contributor + delete + approve + manage users (tier change, creation, suspension)
- `governance` — steward + view audit logs + system settings

## Scope & Deliverables

### Phase 4.1 — Multi-User Local Auth Backend
- [ ] User storage schema (SQLite)
- [ ] Password hashing/validation (bcryptjs)
- [ ] Session management API
- [ ] User CRUD endpoints
- [ ] Tier validation in ACL layer
- [ ] Audit logging for all user actions
- [ ] Tests: 80%+ coverage for auth/user APIs

### Phase 4.2 — User Management UI
- [ ] Settings → User Management section
- [ ] User list, create, edit modals
- [ ] Profile card (self-service)
- [ ] Audit log viewer
- [ ] E2E tests for common flows (create user, change tier, reset password)

### Phase 4.3 — Production Readiness
- [ ] Forgejo OAuth user tier sync (map Forgejo teams → DocWright tiers)
- [ ] Database migrations tooling
- [ ] Documentation: user management guide, admin handbook
- [ ] Security audit (password reset flow, session management, ACL enforcement)
- [ ] Deployment guide for instances 2-4

### Phase 4.4 — Advanced Features (deferred)
- [ ] User invitation/self-service registration (invite link, email verification)
- [ ] LDAP/Active Directory integration
- [ ] SAML SSO
- [ ] User groups/roles (beyond flat tiers)
- [ ] Activity dashboard (logins, document edits by user)

## Alternatives Considered

### 1. Keep single-user local auth, use Forgejo OAuth for everything
**Rejected:** Contradicts requirement to support air-gapped deployments (Cascade STEAM). OAuth requires external git server.

### 2. Store users in frontmatter (like plans/proposals)
**Rejected:** Files would be constantly modified, git history polluted. Users are system metadata, not vault content. Database is cleaner.

### 3. Use postgres-only, require external database
**Rejected:** Violates "no auxiliary database" principle in CLAUDE.md. SQLite allows single-box deployment; PostgreSQL available as optional scale-up.

### 4. Use JWT tokens instead of httpOnly cookies for sessions
**Rejected:** Tokens can't be revoked quickly (attack response). httpOnly cookies + session table is more secure.

## Migration Path

**For instances running v0.4.9 with local auth:**
1. `npm run db:init` — Create users table
2. `npm run db:migrate:old-auth` — Import existing `.docwright/contributors.json` → users table
3. Restart instances
4. UI appears automatically (Settings → User Management)

**For Forgejo OAuth instances:**
1. Sync happens automatically on first login (tier pulled from Forgejo teams)
2. No data loss; .docwright/contributors.json becomes read-only cache

## Testing Strategy

- Unit: User CRUD, password validation, tier checks, ACL enforcement (80%+)
- Integration: Create user → login → access protected resource
- E2E: Admin flow (create/edit/suspend user), user flow (change password), audit log
- Security: Password reset links, session revocation, tier boundary testing
- Performance: 1000 users, concurrent logins, audit log query speed

## Success Criteria

- [ ] Multi-user local auth works on all instances (dogfood, csdocs, erp-images, msp)
- [ ] User list loads in <500ms (1000 users)
- [ ] Password reset link valid for exactly 24h
- [ ] Tier changes reflected immediately (no cache lag)
- [ ] All user management actions audit-logged
- [ ] Zero security vulnerabilities (password reset, session, ACL)
- [ ] Documentation complete and tested

## Future

- Integration with Cascade STEAM operational dashboards (user activity)
- User groups for bulk tier assignment
- Deferred user invitations (email, SMS)
- Account lockout after N failed logins
- Optional: 2FA support (TOTP)

## Notes

This proposal is framework-agnostic regarding which phase it enters. It is scoped and isolated enough to be:
- Developed independently of other Phase 4 work (profile engine, etc.)
- Deployed to instances 2-4 as soon as Phase 4.1 + 4.2 complete
- Incrementally: Phase 4.1 backend can be API-tested before UI lands

The user management system is foundational for production multi-user deployments and should be prioritized accordingly.
