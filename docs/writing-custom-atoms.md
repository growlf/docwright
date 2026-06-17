# Writing Custom Policy Atoms

How to add project-specific governance rules to an adopted vault.

## Overview

Every adopted vault has a `policies/` directory seeded with DocWright's pilot atoms. You can add your own project-specific atoms to the same directory. They run through the same `policy-atoms-core` engine with no changes to DocWright itself.

## Atom directory structure

```
policies/
  my-custom-rule/
    atom.yaml     ← frontmatter (required)
    context.md    ← rule prose (required for judgment atoms, recommended for deterministic)
    check.js      ← compiled check function (required for deterministic atoms)
```

**Do not create `check.ts` in a vault-specific atom.** A `check.ts` that imports from `../../src/policy-atoms-core/` will only work inside the DocWright installation directory — the path breaks in any adopted vault. Write `check.js` directly instead.

## Writing `check.js` for a vault-specific atom

Because `check.js` must be self-contained (no external imports), write it as plain JavaScript with the check logic inlined:

```javascript
// policies/my-custom-rule/check.js
export function check(ctx) {
  // ctx.filePath    — relative path of the file being checked
  // ctx.frontmatter — parsed YAML frontmatter as an object
  // ctx.content     — full file content as a string
  // ctx.vaultRoot   — absolute path to the vault root

  const val = ctx.frontmatter['my-field'];
  if (!val || String(val).trim() === '') {
    return {
      pass: false,
      message: "'my-field' is required",
      atom_id: 'my-custom-rule',
    };
  }
  return { pass: true, message: "'my-field' present", atom_id: 'my-custom-rule' };
}
```

If you want to write `check.ts` for authoring convenience (type safety, IDE support):
1. Set up your vault as a Node project (`npm init`)
2. Install `policy-atoms-core` as a local dependency pointing at your DocWright install:
   ```json
   { "dependencies": { "policy-atoms-core": "file:/path/to/docwright/src/policy-atoms-core" } }
   ```
3. Write `check.ts` with proper imports
4. Compile with esbuild: `npx esbuild check.ts --bundle --format=esm --outfile=check.js`

## Writing `atom.yaml`

```yaml
id: my-custom-rule          # kebab-case, unique within this vault
kind: deterministic         # or: judgment
scope: [plan, proposal]     # scope expressions — see scope grammar
synopsis: "One or two sentences describing the rule for the synopsis index."
version: 1                  # increment when rule meaning changes
ai_category: none           # none | classification | generation | reasoning
distributable: false        # false = project-specific; true = can be seeded to other vaults
tags: [my-project, infra]
```

Set `distributable: false` for project-specific rules that should never be copied to other vaults. DocWright's `adopt-vault.ts` skills bridge only copies atoms with `distributable: true`.

## Verify your atom

From the DocWright installation directory:

```bash
npm run atoms:check -- --vault /path/to/your/vault
```

This runs the sync-checker and shows your atom's synopsis index entry, token count, and any structural errors.

## Token budget

The synopsis index has a hard limit of **1,500 tokens** (soft warning at 1,200). A typical atom synopsis is 10–50 tokens. The `atoms:check` output shows your vault's current token count.

## Example: project-specific infrastructure rule

See `bms-ai-cluster/policies/ansible-vault-refs/` for a complete example of a vault-specific deterministic atom with a self-contained `check.js`.

## Related

- [[docs/vault-portability.md]] — how atoms are seeded into vaults during adoption
- [[docs/policy-atom-scope-routing.md]] — which MCP tools fire which atoms
- [[src/policy-atoms-core/schema.ts]] — `AtomFrontmatter`, `CheckContext`, `CheckResult` types
