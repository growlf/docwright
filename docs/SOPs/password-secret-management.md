---
title: "SOP: Password & Secret Management"
category: security
created: "2026-05-19"
author: "DocWright"
tags: [security, passwords, bitwarden, secrets]
reviewed_by: ""
status: approved
---

# SOP: Password & Secret Management

## Purpose
Establish mandatory standards for password complexity, storage, and usage across all managed infrastructure.

## Scope
All systems: routers, servers, services, APIs, and any other credential-protected resources.

## Standards

### 1. Password Complexity
- **Minimum length:** 24 characters for all infrastructure passwords
- **Character set:** Mixed case, numbers, special characters
- **Generation:** Use `secrets.token_urlsafe(18)` or `pwgen -s 24 1` or your vault's generator
- **Prohibited:** Dictionary words, repeated characters, personal info

### 2. Secret Storage (MANDATORY)
- **Primary vault:** VaultWarden or Bitwarden (self-hosted or cloud)
- **CLI access:** `bw` CLI — retrieve at runtime, never store in files
- **Organization:** Use folders/collections to separate environments (production, staging, personal)
- **Naming convention:** `service-host` (e.g., `router-config`, `database-admin`, `api-service-token`)

### 3. NEVER Store Secrets In:
- ❌ Code repositories (even private repos)
- ❌ `.env` files committed to git (use `<vaultwarden:item-name>` placeholders)
- ❌ Documentation files (use vault references only)
- ❌ Chat logs, emails, tickets

### 4. Runtime Secret Retrieval
```bash
# Fetch password from vault
bw get password "service-name"

# Fetch full item (username, password, notes)
bw get item "service-name"
```

### 5. API Tokens & SSH Keys
- **API tokens:** Store in vault as login items with `api-token` custom field
- **SSH keys:** Private keys stored in vault secure notes; public keys in deployment config
- **Key rotation:** Rotate SSH keys annually; API tokens on compromise or annually

### 6. Enforcement
- Pre-commit hook rejects commits containing potential secrets
- `.gitignore` excludes common secret file patterns
- All plans must reference vault items, never contain plaintext credentials

## References
- Bitwarden CLI docs: `bw --help`
- VaultWarden: self-hosted or cloud instance

## Agent Instructions

<agent-instructions mode="skill+rule" triggers="credential,password,vaultwarden">

### Rules
- No secrets in repos (blocked by pre-commit hook)
- Min 24-char passwords, mixed case, no dictionary words
- Secrets vault is the primary credential store

### Actions
- Always use: `bw get item <name>`
- Store new credentials in vault immediately

</agent-instructions>
