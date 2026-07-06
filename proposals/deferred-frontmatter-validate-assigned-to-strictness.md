---
title: "Deferred: frontmatter-validate atom too strict on assigned_to for unapproved proposals"
author: NetYeti
author-role: contributor
created: 2026-06-17
tags:
  - policy-atoms
  - frontmatter-validate
  - calibration
complexity: low
estimated_effort: XS
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - policies/frontmatter-validate/atom.yaml
  - plans/completed/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
milestone: backlog
---

## Problem

Discovered during real-world testing of the `frontmatter-validate` atom against
`proposals/ai-task-category-taxonomy.md` (2026-06-17).

The `frontmatter-validate` atom uses `fieldRequired('assigned_to')` which fails
when `assigned_to` is an empty string. But the actual pre-commit hook
(`validate_required_fields` in `scripts/pre-commit.sh`) only checks that the key
EXISTS in the frontmatter — not that it has a non-empty value:

```bash
if (!fm || !(field in fm)) process.exit(1);
```

For an unapproved proposal, `assigned_to: ""` is legitimate — the proposal is in
the pool of ideas with no current owner. The atom produces a false positive here.

## Divergence table

| Scenario | Actual hook | frontmatter-validate atom |
|----------|-------------|--------------------------|
| `assigned_to: "NetYeti"` | ✅ Pass | ✅ Pass |
| `assigned_to: ""` on unapproved proposal | ✅ Pass (key present) | ❌ Fail (empty string) |
| `assigned_to:` missing entirely | ❌ Fail | ❌ Fail |

## Proposed Fix

Option A (preferred): Make `frontmatter-validate`'s check for `assigned_to` on proposals
conditional — only require non-empty if `approved: true`:

```typescript
if (field === 'assigned_to' && isProposal) {
  const approved = ctx.frontmatter['approved'];
  if (!approved || approved === 'false' || approved === false) {
    // Unapproved proposals may have empty assigned_to — key presence only
    if (ctx.frontmatter['assigned_to'] === undefined) {
      return { pass: false, message: "...", atom_id: 'frontmatter-validate' };
    }
    continue; // Empty string is fine for unapproved
  }
}
```

Option B: Accept the stricter behavior and require proposals to always have an
assignee at creation time (opinionated but defensible as a governance choice).

## Why deferred

Low priority — workaround is easy (set `assigned_to` to the author on creation).
Fix requires updating the `frontmatter-validate` check.ts, rebuilding check.js,
and re-running equivalence tests. Acceptable to handle in a normal bug fix commit
rather than a dedicated plan.
