# Policy Atom Scope Routing — MCP Tool Map

How the MCP server determines `actionScope` when evaluating policy atoms.
Used by Step 3 to wire `DOCWRIGHT_ATOM_ROUTING` into specific tool handlers.

## Scope derivation rules

The MCP server derives `actionScope` from two inputs:
1. **Which tool was called** — determines the operation class
2. **The target file path** — narrows to the specific document type

```
actionScope = <operation>.<document-type>
```

When the document type can be inferred from the file path, use the full dotted scope
(`plan.approved`). When only the operation is known, use the bare scope (`plan`).

## MCP Tool → actionScope map

| MCP Tool | File pattern | actionScope | Atoms that fire |
|----------|-------------|-------------|-----------------|
| `write_plan` | `plans/*.md` | `plan` | frontmatter-validate, no-work-before-approval |
| `update_plan_status` | `plans/*.md` → `approved` | `plan.approved` | no-work-before-approval |
| `update_plan_status` | `plans/*.md` → `in-progress` | `plan.approved` | no-work-before-approval |
| `update_plan_status` | `plans/*.md` → `completed` | `plan.completing` | (none yet) |
| `update_step` | `plans/*.md` | `plan` | (none yet — step updates don't trigger governance atoms) |
| `set_plan_field` | `plans/*.md` | `plan` | frontmatter-validate (on field write) |
| `append_history` | `plans/*.md` | `plan` | (none — history appends are unconstrained) |
| `transition_to_approved` | `plans/*.md` | `plan.approved` | no-work-before-approval |
| `transition_to_completed` | `plans/*.md` | `plan.completing` | (none yet) |
| `transition_to_canceled` | `plans/*.md` | `plan` | (none yet) |
| `approve_sub_plan` | `plans/*.md` | `plan.approved` | no-work-before-approval |
| Pre-commit hook | commit message | `git-commit` | commit-format |
| Pre-commit hook | `proposals/*.md` | `proposal` | frontmatter-validate |
| Pre-commit hook | `plans/*.md` | `plan` | frontmatter-validate, no-work-before-approval |
| `get_plan`, `list_active_plans`, `get_status`, `get_facts`, `get_session_context`, `collate`, `next_action`, `run_dry_run`, `audit_log`, `session_context` | — | — | **Read-only tools — no atoms fire** |

## Implementation pattern for Step 3

```typescript
// In the MCP tool handler, before executing the operation:
if (process.env.DOCWRIGHT_ATOM_ROUTING === '1') {
  const scope = deriveScope(toolName, filePath, newStatus);
  const { atomIds } = route(synopsisIndex, scope, { kind: 'deterministic' });
  const { atoms } = await resolve(atomIds, { policiesDir });
  for (const atom of atoms) {
    if (!atom.check) continue;
    const result = await atom.check({ filePath, frontmatter, content, vaultRoot });
    if (!result.pass) {
      // Log alongside old-path result for comparison (Step 3 mode)
      // Do NOT block yet — both paths run until old-path is retired (Step 3 completion)
    }
  }
}
```

## Scope for rules NOT yet in the MCP layer (pre-commit only)

These rules fire only in the pre-commit hook today. Step 3 migration maps each to atoms;
MCP wiring is not needed unless the rule is relevant to AI-assisted writes:

| Rule | Current enforcement | Step 3 atom scope |
|------|-------------------|-------------------|
| `commit-format` | `.githooks/commit-msg` | `git-commit` (hook only — MCP doesn't commit) |
| `no-plaintext-creds` | pre-commit staged file scan | `git-commit` |
| `no-secrets` | pre-commit staged file scan | `git-commit` |
| `ci-watch-on-tag-push` | pre-commit on tag push | `git-commit` |
| `hook-failure-feedback` | AI preamble/guidance only | judgment, `git-commit` |

## Related

- [[plans/completed/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md]] — parent plan
- [[docs/policy-atom-model-routing.md]] — model routing per ai_category
