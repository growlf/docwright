---
title: "UI Test Before Submit"
status: active
author: NetYeti
created: 2026-06-22
author-role: governance
tags:
  - policy
  - ui
  - testing
  - quality
---

## Statement

Every UI change must be visually verified before the plan is marked ready for
human review. A passing typecheck alone is insufficient — the browser-rendered
state must be confirmed to work.

## Rationale

TypeScript and unit tests validate logic, not layout. Svelte reactive
declarations, SCSS cascade, and DOM structure failures all pass `tsc --noEmit`
but produce broken UI. Visual verification catches:

- **Import resolution failures** (Vite serving, cross-root module access)
- **Undefined variable references** in SCSS (silent compile warnings)
- **Broken reactivity** (`$state`/`$derived` cycles that don't update)
- **Missing elements** (conditionals that render nothing due to falsy state)
- **Layout regressions** (overflow, misalignment, collapsed containers)

## Scope

This policy applies to every session that modifies:
- `.svelte` files (templates, components, layouts)
- `.scss` / `.css` files consumed by Svelte components
- Vite or SvelteKit config (`vite.config.ts`, `svelte.config.js`)
- `chat-utils.ts` or any shared module imported by UI code

## Procedure

1. **Before** marking a plan `ready-to-review` or moving to a new task:
   - Run `npm run typecheck` (baseline: no errors)
   - Run the relevant test suite (e.g. `npm run test:webui`, `npm run test:dispatch`)
   - Open the browser UI and visually confirm: the affected panel/component
     renders, interacts, and does not throw console errors

2. **Visual baseline tests (human-verified on first run):**
   - Chat panel opens without overlay errors
   - Session sidebar renders rows grouped by time
   - Messages send and display correctly
   - @-mention dropdown appears on `@` and closes on escape/selection
   - Model picker opens and shows grouped options
   - Usage badges render in sidebar rows and header

3. **New feature checklist (add per feature):**
   - Append a row to the feature's section below documenting the manual
     verification steps (one person-minute maximum per step)

4. **If the UI is broken:**
   - Fix the root cause. Do not work around it.
   - If the fix is non-trivial (more than one file or >5 lines), create
     a bug-fix plan or proposal rather than hiding the issue.
   - Add a regression test for the fix.

5. **If the UI cannot be loaded (headless CI, no display):**
   - Add the missing baseline test as a unit/integration test instead
   - Document why visual verification was skipped in the plan
   - The next visual session must verify what CI could not

## Enforcement

AI agents must treat this policy as blocking: do not proceed past a UI change
without visual verification. The pre-commit hook cannot enforce this
automatically (no headless browser in the current toolchain), so agent
self-enforcement is the gate.

## Exceptions

The only exception is a CI-only change (no `.svelte`, `.scss`, or Vite config
touched). Documentation-only changes to UI files (e.g. adding a JSDoc comment)
are not exceptions — the rendered output is unchanged so visual check is
trivially satisfied.

## Related

- Core philosophy: [[CLAUDE.md]]
- Bugs before features: [[policies/core/bugs-before-features.md]]
