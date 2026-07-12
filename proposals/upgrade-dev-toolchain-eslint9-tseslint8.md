---
title: "Upgrade dev toolchain: ESLint 10 + @typescript-eslint v8 + TypeScript 6"
author: NetYeti
created: 2026-06-17
tags:
  - toolchain
  - eslint
  - typescript
  - security
  - phase-2
approved: false
priority: medium
created_by: "NetYeti@phoenix"
assigned_to: ""
milestone: backlog
---

## Problem

The root dev toolchain is two major versions behind on ESLint and `@typescript-eslint`,
and one major version behind on TypeScript:

| Package | Current | Latest |
|---|---|---|
| `eslint` | 8.57.1 | 10.5.0 |
| `@typescript-eslint/parser` | 6.21.0 | 8.61.1 |
| `@typescript-eslint/eslint-plugin` | 6.21.0 | 8.61.1 |
| `typescript` | 5.9.3 | 6.0.3 |
| `mocha` | 10.8.2 | 11.7.6 |

This leaves open Dependabot alerts for `minimatch` ReDoS (high, 3 alerts) and
`serialize-javascript` RCE/DoS (high, 2 alerts) — both transitive via the old
toolchain. All are dev/build-only deps with zero production exposure, but the
alerts are noise and the toolchain is genuinely stale.

## Proposed Solution

Upgrade in one coordinated pass during Phase 2:

1. **ESLint 8 → 10**: migrate `.eslintrc.json` to `eslint.config.js` flat config
   format (required — ESLint 9+ dropped the legacy format).
2. **`@typescript-eslint` 6 → 8**: update config to match new flat-config API;
   review any new/renamed rules that affect the dispatch module guard.
3. **TypeScript 5 → 6**: verify no breaking changes in dispatch and webui; update
   `tsconfig.json` as needed.
4. **`mocha` 10 → 11**: straightforward; clears the `serialize-javascript` alerts.
5. Run full typecheck + lint + tests after each step before moving to the next.

## Alternatives Considered

- **`npm audit fix --force`**: rejected — would downgrade `mocha` to 8.1.3, a
  regression in test runner capability.
- **Ignore indefinitely**: acceptable short-term since all vulns are dev-only, but
  the toolchain gap grows harder to close the longer it waits.

## Future

Once on ESLint 10 + `@typescript-eslint` v8, enable stricter type-aware rules
(e.g. `@typescript-eslint/recommended-type-checked`) to catch more dispatch module
errors at lint time without needing test runs.
