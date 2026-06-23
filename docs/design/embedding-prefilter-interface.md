# Embedding Prefilter Interface — Design Contract

## Purpose

Define the seam between the atom router's deterministic Pass-1 scope matching
and an optional embedding-based "tier 0.5" prefilter. This document is the
contract that `feat/policy-atom-checks`, `feat/embedding-prefilter`, and
`feat/knowledge-base-profile` all agree to — before any of them modify the
router.

## Context

The existing atom router (`src/policy-atoms-core/router.ts`) does deterministic
scope-match only:

```
query + actionScope  ──→  route(index, actionScope, opts)
                             │
                             ▼
                        matched atom IDs
```

The "tier 0.5" prefilter wedges in *before* the deterministic match, narrowing
candidates via semantic similarity:

```
query  ──→  semanticPrefilter(query, topN)
               │
               ▼        ┌──────────────────────────┐
          candidate IDs ─→ route(index, actionScope,  ─→ matched atom IDs
                           { filterByIds: candidates })
```

## Interface

### `SemanticPrefilterFn`

```typescript
// File: src/policy-atoms-core/prefilter.ts  (NEW)
// ISOLATION INVARIANT: same as router.ts — no imports outside policy-atoms-core.

export interface PrefilterOptions {
  /** Max candidate IDs to return. Default: 20 */
  topN?: number;
  /** Minimum similarity score (0–1) to include a result. Default: 0.0 */
  minScore?: number;
  /** Optional filter to restrict which atom kinds to consider. */
  kind?: AtomKind;
  /** Optional scope filter — only return atoms matching at least one scope. */
  scopeFilter?: string[];
}

export interface PrefilterResult {
  /** Atom IDs sorted by descending score. */
  atomIds: string[];
  /** Scores for each returned ID (0–1). */
  scores: Record<string, number>;
  /** Which embedding model produced these scores. */
  model: string;
  /** Vector store / index version identifier. */
  indexVersion: string;
}

export type SemanticPrefilterFn = (
  query: string,
  opts?: PrefilterOptions,
) => PrefilterResult | Promise<PrefilterResult>;
```

### Router integration

The existing `RouterOptions` gains one optional field:

```typescript
export interface RouterOptions {
  kind?: AtomKind;
  /** If provided, skip scope-match and use these pre-filtered IDs. */
  prefilteredIds?: string[];
}
```

When `prefilteredIds` is set, `route()` returns only atoms whose ID appears in
that list AND whose scope matches the action scope (intersection, not override).
This ensures the prefilter can widen or narrow but never bypass scope
governance.

### Olla embedder contract (external)

The embedding model runs on **Olla** (`http://olla.local:8080` or configured
`OLLA_BASE`). The endpoint:

```
POST /embed
{
  "model": "bge-small-en-v1.5",
  "input": [query, ...synopses]
}
→ { "embeddings": [[float]], "model": "bge-small-en-v1.5" }
```

Quantized model choice (in priority order):
1. `bge-small-en-v1.5` (Q4_0, ~33MB) — fast, small, good-enough for synopsis
2. `nomic-embed-text-v1.5` (Q4_0, ~137MB) — better, falls back if BGE unavailable
3. Any embedding model capable of 768-dim output

### Vector store contract (for caching)

Cached embeddings live in Olla's in-memory model context on first call.
Persistent cache is NOT required at tier 0.5 — synopsis index is small
(dozens to low-hundreds of entries, <1500 tokens total). Re-embed on every
route if needed; embedding 100 synopses is <500ms on Olla with BGE-small.

If/when the synopsis index grows to where re-embedding on every call is
measurable, add a write-through cache keyed by `(index.generated, atom.version)`:

```
.docwright/embed-cache/
  bge-small-en-v1.5/
    {atom-id}.json    ← { embedding: [float], version: number }
```

## Data flow — end to end

```
query ──→ semanticPrefilter(query, { topN: 20 })
             │
             ▼ POST /embed { model, input: [query, synopsis1, synopsis2, ...] }
             │
             ▼ cosine similarity: query_embedding × each synopsis_embedding
             │
             ▼ sort by score, take topN
             │
             ▼ return PrefilterResult { atomIds, scores, model, indexVersion }
                  │
                  ▼ route(index, actionScope, { prefilteredIds: result.atomIds })
                       │
                       ▼ RouterResult { atomIds: [...scoped intersection...] }
```

## What each branch owns

### `feat/policy-atom-checks`

- Write deterministic check functions (already exists: field-required,
  status-transition-allowed, regex-match, linked-artifact-exists)
- Decompose first 2-3 real plan-lifecycle rules into atom.yaml files
- **Does NOT touch** router.ts or add prefilter logic

### `feat/embedding-prefilter`

- Create `src/policy-atoms-core/prefilter.ts` with `SemanticPrefilterFn` type
- Add `prefilteredIds` to `RouterOptions`
- Wire the Olla `/embed` call in the prefilter (with configurable `OLLA_BASE`)
- Add cosine-similarity utility (pure math, no new deps)
- **Does NOT** modify any check function or atom definition
- **Does NOT** touch the knowledge-base profile

### `feat/knowledge-base-profile`

- Build the knowledge-base profile content (ingestion, lint, save-to-wiki)
- Define the LLM Wiki document types, templates, and OpenCode instructions
- Optionally prototype qmd integration as an external search backend
- **Does NOT** touch policy-atoms-core or the prefilter

## Entry points — files each branch touches

| File | `checks` | `prefilter` | `kb-profile` |
|------|----------|-------------|--------------|
| `src/policy-atoms-core/router.ts` | — | Adds `prefilteredIds` to `RouterOptions` | — |
| `src/policy-atoms-core/prefilter.ts` | — | **NEW** — full file | — |
| `src/policy-atoms-core/index.ts` | — | Adds `prefilter.ts` export | — |
| `src/policy-atoms-core/checks/*.ts` | May add new checks | — | — |
| `policies/**/atom.yaml` | Writes new atoms | — | — |
| `src/profiles/knowledge-base/**` | — | — | Full build |
| `docs/design/embedding-prefilter-interface.md` | — | — | — |

## Open questions (resolve before implementation)

1. **Synchronous or async?** The prefilter calls Olla over HTTP. `route()` is
   currently synchronous. Options: (a) make `route()` async, (b) add a separate
   `routeWithPrefilter()` async wrapper, (c) make the prefilter a sync
   cache-hit path with async cache-miss. Decision: **(b)** — keep `route()`
   sync, export an async `routeWithPrefilter()` that calls the prefilter then
   passes through to `route()`.

2. **Scope pre-filter in the prefilter?** Should the prefilter itself apply
   scope filters to reduce embedding calls, or should it embed everything and
   let the deterministic matcher winnow? Decision: **embed everything** — the
   point of the prefilter is to catch matches that deterministic scope
   expressions miss (e.g., conceptually related atoms in different scopes).
   Pre-filtering by scope would defeat the purpose.

3. **Model fallback chain?** If Olla is down or the model is missing, does the
   prefilter (a) fail open (return empty, fall through to deterministic only),
   (b) fail closed (block routing), or (c) retry with a different model?
   Decision: **(a) fail open** — deterministic routing works without the
   prefilter; the prefilter is an acceleration/quality improvement, never a
   hard dependency.
