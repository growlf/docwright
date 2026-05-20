---
name: docwright-security
description: Security practices for credential management, network access, and system hardening
---

# DocWright Security Skill

## Credential Rules
- No secrets in repos (blocked by pre-commit hook)
- Min 24-char passwords, mixed case, no dictionary words
- Secrets vault (VaultWarden/Bitwarden) is the primary credential store
- Always use `bw get item <name>` for retrieval
- Store new credentials in vault immediately

## Network Security Principles
- Default deny firewall posture
- Segment networks by trust level (guest, IoT, infrastructure)
- SSH key authentication only (ED25519 preferred)
- Disable password-based SSH login

## SSH Access
- ED25519 keys preferred
- Private keys in vault secure notes; public keys in deployment config
- Rotate annually or on compromise

## API Tokens
- Create restricted tokens with minimum required permissions
- Store token ID and secret in vault as login items with `api-token` custom field
- Rotate on compromise or annually

## Account Lifecycle
1. Create with minimum required access
2. 24-char password stored in vault
3. SSH key generated, public key deployed
4. On removal: revoke keys, delete vault entry, remove from systems
