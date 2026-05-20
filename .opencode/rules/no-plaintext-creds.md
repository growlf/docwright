# Rule: No Plaintext Credentials in Documents

All credentials in plans, proposals, and documentation MUST reference your secrets vault (e.g., VaultWarden/Bitwarden).

- Right: `Password: Stored in Bitwarden as "service-credential"`
- Wrong: `Password: admin123`
- Right: `API token: Bitwarden api-service-token`
- Wrong: `API token: sk-abc123def456`
