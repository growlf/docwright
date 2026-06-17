# no-plaintext-creds

## Rule

All credentials in plans, proposals, and documentation must reference a secrets vault. Never write plaintext credentials.

- ✅ `Password: Stored in Bitwarden as "service-credential"`
- ✅ `API token: <bitwarden:api-service-token>`
- ❌ `Password: admin123`
- ❌ `API token: sk-abc123def456`

## Rationale

Plaintext credentials in governance documents are a security incident waiting to happen. They get committed to git, synced to remote repos, and can appear in session logs. All secrets live in the vault; documents reference the vault.

## Examples

Passing content:
```
Database password: stored in Bitwarden under "prod-db-password"
```

Failing content (triggers pattern match):
```
password: mysecret123
```

## Scope

Applies during commit (`git-commit`), and when writing proposals or plans that might include service configuration details.
