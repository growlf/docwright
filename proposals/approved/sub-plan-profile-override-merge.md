---
title: "Sub-Plan: Profile Override Merge"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - profile
  - merge
  - engine
approved: true
created_by: NetYeti@phoenix
assigned_to: netyeti
priority: medium
complexity: low
parent_plan: plans/phase-3-vault-foundation.md
parent_deliverable: 4
_path: proposals/sub-plan-profile-override-merge.md
consumed_by: plans/completed/sub-plan-profile-override-merge.md
---

## Problem

DocWright ships bundled profiles (e.g., `org-operations`), but vaults need to customize them — add required fields, extend schemas, override templates. Currently there's no merge mechanism; a vault either uses the bundled profile verbatim or forks it entirely.

## Proposed Solution

Implement a profile override merge engine in `src/dispatch/profile-merge.ts`. This module reads a vault-root `profile.json` (if present) and merges it onto the bundled profile using these rules:

- **Scalar fields:** vault value replaces bundled value
- **Objects:** deep-merge (vault keys supplement bundled keys)
- **Arrays:** `+array` prefix → append to bundled array; unprefixed → replace entirely

### Where the merge lives

The merge engine is a pure function in `src/dispatch/profile-merge.ts` — no VS Code API deps, importable anywhere:

```
function mergeProfiles(bundled: Profile, vaultOverride: Partial<Profile>): Profile
```

The existing `src/webui/src/routes/api/profile-config/+server.ts` (which currently reads bundled profile) will call `mergeProfiles()` instead, passing the vault-root `profile.json` if it exists. This means the Web UI, MCP tools, and any other consumer get the merged result automatically — single entry point, consistent behavior.

### Live merge, no cache

The merge runs on every `profile-config` API call. The vault-root `profile.json` is small (< 10KB) and the merge is O(n) over keys — negligible overhead. Caching would introduce staleness bugs when the vault override changes. **No cache file written.** The merged result never touches disk.

### Merge rule validation

Before merging, the engine validates the vault override against the bundled schema to catch misconfigurations:

1. **Prefix consistency:** If a vault value uses the `+` prefix, the corresponding bundled field must be an array. If it's not, the engine throws a `MergeError` with a message like: `"Field 'requiredFrontmatter' uses '+' prefix but bundled value is not an array"`
2. **Unknown fields:** Vault fields that don't exist in the bundled profile produce a warning (not an error) so vaults can add future profile keys without waiting for a bundled update
3. **Type mismatch:** If a vault scalar overrides a bundled object (or vice versa), the engine throws: `"Field 'gates': vault value is string but bundled value is object"`
4. **`+field` is not supported yet:** The `+` prefix only applies to arrays. Using `+` on a non-array field is a validation error

### Error handling

Validation errors surface as HTTP 400 with a descriptive message in the `profile-config` API response, so the Web UI can display them. In MCP mode, errors are returned as tool error messages.

### Scope boundary: what the merge does NOT touch

- **`schema.json`** — Not merged. The JSON Schema for frontmatter validation is out of scope for this sub-plan. Vaults that need custom schema should use a separate proposal.
- **`opencode-instructions.md`** — Not merged. AI instructions are per-installation, not per-vault.
- **`templates/`** — Not merged. Vaults that need custom templates should place them in `<vault-root>/templates/` (automatic fallback in the Web UI, or a separate proposal).

### Tests

- **Unit:** All three merge modes have isolated test coverage
- **Validation:** Each validation rule (prefix consistency, type mismatch, unknown field warning) has a test case
- **Integration:** MSP vault `profile.json` adds one custom `requiredFrontmatter` field; verify merged result retains all bundled defaults plus the new field
- **Error path:** Vault override with `+` prefix on a scalar field returns `MergeError`, not a silent bug

## Parent Reference

This is sub-plan **#4** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-3-vault-foundation.md`, Step 7). It enables vaults to extend DocWright's governance model without forking.

## Dependencies

- **No hard prerequisite** — can be developed in parallel with sub-plans #1–#3 and #5–#6
- **Required by:** MSP Pilot (sub-plan #7) needs custom fields for service-catalog policies

## Future

- **`--diff` mode** — Show what a vault overrides vs the bundled default, useful for auditing vault configurations
- **`schema.json` merge** — Extend the merge rules to frontmatter JSON Schemas so vaults can add custom document fields validated at commit time
- **Template merge** — Merge vault templates with bundled templates for custom document scaffolding
