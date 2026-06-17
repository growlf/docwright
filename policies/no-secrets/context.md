# no-secrets

## Rule

Never include plaintext passwords, API tokens, SSH private keys, or credentials in any committed file, commit message, or chat output.

- Use vault references: `Bitwarden: <item-name>`
- Use placeholders: `<vaultwarden:item-name>`
- Never hardcode credentials in scripts or configs
- The pre-commit hook scans staged files for common secret patterns

## Rationale

Secrets committed to git are permanently in the history even after deletion. They get synced to remote repos, CI logs, and clones. All secrets must live in Bitwarden/VaultWarden and be injected at runtime via environment variables or vault CLI lookups.

## Examples

Failing (SSH private key):
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXkAAAABAAAAMQ...
```

Failing (API token format):
```
sk-proj-abc123def456ghi789...
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Passing:
```
API_KEY=$(bw get password my-api-key)
```

## Scope

Applies to every `git commit` operation (`scope: git-commit`). The pre-commit hook provides mechanical enforcement for staged files; this atom is the AI-readable equivalent for session awareness.
