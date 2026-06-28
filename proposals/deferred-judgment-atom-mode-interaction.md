---
title: "Deferred: Judgment Atom Mode Interaction — advisory/staged/blocking per plan execution mode"
author: NetYeti
author-role: contributor
created: 2026-06-17
tags:
  - policy-atoms
  - judgment
  - execution-mode
  - mcp
  - governance
complexity: medium
estimated_effort: S
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - plans/completed/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
  - research/plan-execution-mode-enforcement.md
  - docs/policy-atom-hooks.md
---

## Problem

`evaluateJudgmentAtom()` in `src/policy-atoms-core/resolver.ts` returns a
`JudgmentResult` with `pass: true | false | null`. It has no awareness of the
calling plan's `mode:` field (mentor/guided/autonomous). As a result, there is
currently no mechanism to make judgment atom evaluation results:

- **advisory-only** in `mode: mentor` (surface finding, do not block)
- **staged for human review** in `mode: guided` (queue the finding, await human Apply/Dismiss)
- **blocking** in `mode: autonomous` (halt the operation if `pass: false`)

This is consistent with how the execution-mode enforcement research defines
the two soft layers (AI preamble + linter) vs. the two hard layers (MCP write
intercept + MCP hard blocks). Judgment atom evaluation at MCP gate points should
follow the same write-intercept pattern.

## Why deferred

This requires judgment atoms to actually be wired into MCP gate points — `transition_to_approved`, `transition_to_completed`, and similar lifecycle transitions. That wiring is part of the **Step 3 retirement phase**: old enforcement paths are only retired once atoms are fully equivalent. Judgment atoms cannot be retired until:

1. The MCP gate call sites exist
2. The mode-aware routing (advisory/staged/blocking) is implemented
3. Human review of judgment atom quality is certified

None of those pre-conditions are met yet. Implementing mode interaction before the gate call sites exist would be building middleware with no consumer.

## Proposed Solution

### Where it lives

In the MCP tool handlers that call judgment atoms at lifecycle gates. Specifically, the mode-aware dispatch lives in `src/mcp/tools/atom-routing.ts` (the coexistence shim) or a new `src/mcp/tools/judgment-gate.ts`.

### Implementation sketch

```typescript
// When a lifecycle gate fires (e.g. transition_to_approved):
const judgmentAtoms = atoms.filter(a => a.frontmatter.kind === 'judgment');
for (const atom of judgmentAtoms) {
  const result = await evaluateJudgmentAtom(atom, ctx, judgmentHook);
  if (result.pass === false) {
    const planMode = extractFrontmatterField(planContent, 'mode') ?? 'mentor';
    if (planMode === 'autonomous') {
      return `ERROR: [${atom.frontmatter.id}] ${result.response}`;  // blocking
    } else if (planMode === 'guided') {
      // stage the finding for human review — Web UI write-intercept pattern
      logTransition('JUDGMENT_STAGED', `[${atom.frontmatter.id}]: ${result.response}`);
    } else {
      // mentor — advisory only
      logTransition('JUDGMENT_ADVISORY', `[${atom.frontmatter.id}]: ${result.response}`);
    }
  }
}
```

### Pre-conditions before implementing

1. At least one judgment atom is wired into a live MCP gate call site (not just in `DOCWRIGHT_ATOM_ROUTING` coexistence mode)
2. Judgment atom quality has been validated by human review (the `tests_human_reviewed` gate)
3. The execution-mode enforcement research recommendation is confirmed to apply: judgment evaluation output follows the same write-intercept pattern as AI direct writes

## Related

- [[research/plan-execution-mode-enforcement.md]] — enforcement contract: mode interaction lives in Web UI write-intercept layer, not in the atom engine itself
- [[docs/policy-atom-hooks.md]] — `evaluateJudgmentAtom()` call site and hook wiring
- [[plans/completed/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md]] — parent plan; Step 3 retirement phase is the trigger for this work
