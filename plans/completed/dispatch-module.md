---
title: Dispatch module — engine foundation
status: completed
completed_date: 2026-06-03
author: NetYeti
created: 2026-06-03
tags:
  - engine
  - dispatch
  - ai
  - phase-2
proposal_source: proposals/approved/dispatch-module.md
priority: high
automated: off
assigned_to: NetYeti
scenario_synthesis: Pure TypeScript module with filesystem and OpenCode SDK calls; no shell or deployment steps in plan tasks
depends_on:
  - phase-1-opencode-embed
---

## Overview

Build `src/dispatch/` — the surface-agnostic TypeScript engine that all AI
features, governance enforcement, and profile-driven behaviour plug into.
Zero VS Code API deps. Every function unit-testable with a filesystem mock.

Once this lands, the Jaccard keyword stubs in `/api/overlap` are replaced by
real LLM calls and the Web UI requires no changes at all.

## Tasks

### 1. Project scaffolding

- Add `tsconfig.json` at repo root (if not present) covering `src/dispatch/`
  with `strict: true`, `noImplicitAny: true`, `esModuleInterop: true`
- Add `test/dispatch/` directory with a minimal Jest/Vitest config that runs
  **outside the extension host** (pure Node, no browser, no VS Code)
- Add `npm run test:dispatch` script to root `package.json`
- Add CI step (`.github/workflows/ci.yml`) to run `test:dispatch` on every push

### 2. Profile engine (`src/dispatch/profile.ts`)

```typescript
export interface ProfileConfig { /* mirrors profile.json shape */ }
export function loadProfile(vaultRoot: string): ProfileConfig
export function getActiveProfile(vaultRoot: string): ProfileConfig  // with org-ops fallback
```

- Reads `profile.json` from vault root
- Falls back to bundled `src/profiles/org-operations/profile.json` if missing
- No caching — reads fresh per call (caller caches if needed)
- Unit test: mock filesystem with a custom profile, verify fields; mock missing
  file, verify fallback

### 3. Index manager (`src/dispatch/index.ts`)

```typescript
export interface VaultEntry { path: string; fm: Record<string,any>; mtime: number }
export function buildIndex(vaultRoot: string): Record<string, VaultEntry>
export function readIndex(vaultRoot: string): Record<string, VaultEntry>
export function writeIndex(vaultRoot: string, index: Record<string, VaultEntry>): void
export function rebuildIfStale(vaultRoot: string): Record<string, VaultEntry>
```

- Scans all lifecycle directories, parses frontmatter, writes `index.json`
- `rebuildIfStale`: compares file mtimes against index; rebuilds only changed entries
- Unit test: build index from mock vault, verify entry count and frontmatter fields
- **Update `/api/status`** to call `readIndex()` instead of scanning on every request
- **Update `/api/list`** to optionally use index for `.md` file listing

### 4. Frontmatter linter (`src/dispatch/linter.ts`)

```typescript
export interface LintResult { field: string; severity: 'error'|'warn'; message: string }
export function lintDocument(path: string, fm: Record<string,any>, profile: ProfileConfig): LintResult[]
```

- Checks required fields per directory (from profile `requiredFrontmatter`)
- Checks enum values (status, complexity, automated)
- Checks `approved` location invariant (proposals/approved/ → approved: true)
- Unit test: lint a proposal missing `assigned_to`, verify error; lint a valid
  plan, verify no errors
- **Wire into properties pane save**: call linter before writing, surface results
  as inline warnings in the pane

### 5. AI integration interface (`src/dispatch/ai.ts`)

```typescript
export interface SimilarityResult { path: string; title: string; score: number; sections: Section[] }
export interface AIEngine {
  findSimilar(targetPath: string, candidates: string[], vaultRoot: string): Promise<SimilarityResult[]>
  fillProposal(fm: Record<string,any>, body: string): Promise<string>
  critiqueDocument(content: string): Promise<string>
}
export class KeywordEngine implements AIEngine { /* current Jaccard stub */ }
export class OpenCodeEngine implements AIEngine { /* real LLM via @opencode-ai/sdk */ }
export function getAIEngine(vaultRoot: string): AIEngine
  // Returns OpenCodeEngine if OPENCODE_URL env is set and reachable, else KeywordEngine
```

Move the Jaccard logic from `/api/overlap/+server.ts` into `KeywordEngine`.
Implement `OpenCodeEngine.findSimilar()` with a real LLM prompt:

```
Given this document: <content>
Rank these candidates by semantic relevance: <candidate list>
Return JSON: [{path, score, reason}]
```

**Update `/api/overlap`** to call `getAIEngine().findSimilar()` — this is the
stub-to-real swap. The endpoint response shape is unchanged; UI changes nothing.

Unit tests:
- `KeywordEngine.findSimilar()`: mock vault, verify Jaccard scores
- `OpenCodeEngine`: skip in unit tests (requires live OpenCode); add integration
  test in `test/dispatch/ai.integration.test.ts` guarded by `OPENCODE_URL` env

### 6. Wikilink resolver (`src/dispatch/wikilinks.ts`)

```typescript
export function resolveWikilink(link: string, fromPath: string, index: Record<string,VaultEntry>): string | null
export function findBacklinks(targetPath: string, index: Record<string,VaultEntry>): string[]
```

- `[[path]]` → looks up `path.md` in index
- `[[path#section]]` → resolves path, returns anchor hint
- `[[path|alias]]` → resolves path, ignores alias (display handled by renderer)
- **Update rename endpoint** (`/api/rename`) to call `findBacklinks()` and update
  wikilinks in referring files (best-effort; log unresolved)
- Unit test: index with 3 files, verify backlink resolution

### 7. ACL controller stub (`src/dispatch/acl.ts`)

```typescript
export type Tier = 'observer' | 'contributor' | 'steward' | 'governance'
export interface ACLContext { user: string; tier: Tier }
export function resolveACL(vaultRoot: string, user: string): ACLContext
export function canPerform(ctx: ACLContext, action: string, documentPath: string): boolean
```

- Reads `.docwright/contributors.json` (format: `{ "user": "tier" }`)
- Falls back to `contributor` tier if file missing or user not listed
- `canPerform`: checks action against tier (approve = steward+; write = contributor+)
- Stub for now — Forgejo OAuth enforcement comes when the Web UI adds auth
- Unit test: contributors.json with mixed tiers, verify canPerform results

### 8. Tests / verification

All tests in `test/dispatch/` must pass with `npm run test:dispatch`:
- Profile engine: fallback, custom profile, field access
- Index manager: build, stale detection, entry count
- Linter: required fields, enum validation, location invariant
- AI (KeywordEngine): similarity scores, section parsing
- Wikilinks: resolution, backlinks
- ACL: tier resolution, canPerform matrix

Integration smoke test (requires running OpenCode):
```bash
OPENCODE_URL=http://localhost:3000 npm run test:dispatch:integration
```
