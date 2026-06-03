---
title: Dispatch module — surface-agnostic engine for DocWright
author: NetYeti
created: 2026-06-03
tags:
  - engine
  - dispatch
  - ai
  - phase-2
category:
  - ENGINE
complexity: L
estimated_effort: L
depends_on: []
approved: true
created_by: NetYeti@phoenix
assigned_to: ""
---
## Problem

All AI features in the Web UI (overlap detection, collation panel, proposal
fill-in) run on keyword-similarity stubs that were built deliberately to define
the engine's API surface before the real engine existed. The API surface is now
defined and proven in the UI. What's missing is the actual engine.

Additionally there is no profile engine loading `profile.json` rules into the
running application, no maintained vault index, no frontmatter linter running
outside of the pre-commit hook, and no ACL controller. Every governance
invariant is currently enforced only at commit time, not at write time.

The stubs are the right design — they just need a real engine behind them.

## Proposed Solution

Build `src/dispatch/` as a surface-agnostic TypeScript module with zero VS Code
API dependencies. It sits between any client surface (Web UI, VSCodium extension,
CLI) and the vault files. Every public function is unit-testable with a plain
filesystem mock.

```
Web UI API routes  →  src/dispatch/  →  vault files on disk
                           │
                    OpenCode SDK (AI calls)
```

### Components

**1. Profile engine (`src/dispatch/profile.ts`)**

Loads `profile.json` from the vault root. Falls back to `org-operations` if
missing. Exposes the active profile config (documentTypes, states, categories,
hiddenDirectories, sidebarExcludePatterns, etc.) to all API routes. Profile
changes are picked up on next request — no restart needed.

**2. Index manager (`src/dispatch/index.ts`)**

Scans the vault, reads frontmatter from every lifecycle file, and builds/updates
`index.json` — a derived cache keyed by relative file path. Re-runs on SSE
file-change events. The index is the authoritative source for:
- Vault status queries (replaces the scan-on-every-request in `/api/status`)
- Backlink resolution
- Overlap candidate lists

**3. Frontmatter linter (`src/dispatch/linter.ts`)**

Validates frontmatter against the active profile schema. Returns structured
errors and warnings. Called by:
- The web UI properties pane on save (real-time feedback)
- The pre-commit hook (already has its own bash linter; this provides the
  TypeScript equivalent with richer errors)

**4. AI integration interface (`src/dispatch/ai.ts`)**

Defines the TypeScript interface that all AI features call:

```typescript
interface AIEngine {
  findSimilar(targetPath: string, candidates: string[]): Promise<SimilarityResult[]>
  fillProposal(frontmatter: Record<string, any>, body: string): Promise<string>
  critiqueDocument(content: string): Promise<string>
}
```

Two implementations ship:
- `KeywordEngine` — current Jaccard stub (default when OpenCode not running)
- `OpenCodeEngine` — real LLM calls via `@opencode-ai/sdk`

The Web UI API routes import `getAIEngine()` which returns whichever is
configured. **Swapping to real AI requires zero UI changes.**

**5. Wikilink resolver (`src/dispatch/wikilinks.ts`)**

Resolves `[[path]]`, `[[path#section]]`, `[[path|alias]]` against the index.
Returns the canonical file path or null. Used by the web UI renderer and the
rename endpoint (to update wikilinks on rename).

**6. ACL controller (`src/dispatch/acl.ts`)**

Reads team membership from `.docwright/contributors.json` (populated from
Forgejo OAuth in production; editable file for prototyping). Enforces the four
tiers: Observer / Contributor / Steward / Governance. Returns allowed actions
for a given user+document combination.

### Web UI integration

Once the dispatch module exists, the following API routes are updated to use it:

| Route | Current | With dispatch |
|-------|---------|---------------|
| `/api/status` | Full filesystem scan per request | Index manager cache |
| `/api/overlap` | Jaccard keyword stub | `AIEngine.findSimilar()` |
| `/api/list` | Raw filesystem scan | Index manager + profile filters |

### Invariants (non-negotiable)

From CLAUDE.md — these apply to every file in `src/dispatch/`:
1. Zero VS Code API imports
2. Every public function testable with a plain filesystem mock
3. State in frontmatter and `index.json` only — no in-memory state between calls
4. All AI writes carry `ai-last-action:` frontmatter stamp
