# MIGRATION.md

This file documents schema-breaking changes to the DocWright vault configuration.
Each section describes what changed and how to migrate existing vaults.

The vault migration script (`npm run vault:migrate`) reads this file to apply
pending migrations automatically.

## Format

```markdown
## v{version} (BREAKING)

Changes:
- {description of the breaking change}

Run: `npm run vault:migrate -- --vault /path/to/vault --to {version}`
```

## Migration Entries

## v1 (BREAKING)

Phase 3 establishes the vault-portable schema. All vaults created before or
without `docwright init` need this migration to set up the versioned config.

Changes:
- Introduced `.docwright/config.json` with `schema_version` tracking
- `profile.json` requires `docwrightProfileVersion: "1"` field
- `.env` must set `DOCWRIGHT_VAULT_ROOT` pointing to the vault root
- `.mcp.json` must reference `$DOCWRIGHT_PATH` for the server binary
- `brand.json` is now a standalone file (was previously embedded elsewhere)

Run: `npm run vault:migrate -- --vault /path/to/vault --to v1`

