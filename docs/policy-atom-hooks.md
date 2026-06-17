# Policy Atom Pluggable Hooks

Reference for `OrgSourceHook` and `JudgmentDispatchHook` — the two extension points in `policy-atoms-core`. Both are defined in `src/policy-atoms-core/resolver.ts` and ship as stub implementations that return `null`.

## Why two hooks

The atom framework enforces governance two ways:

| Kind | Enforcement | Hook needed |
|------|-------------|-------------|
| `deterministic` | Code check (`check.js`) — zero AI cost | `OrgSourceHook` (to override enforcement parameters) |
| `judgment` | LLM evaluation of context prose | `JudgmentDispatchHook` (to route to the right model) |

---

## `OrgSourceHook`

**Location:** `src/policy-atoms-core/resolver.ts` → `OrgSourceHook` type

**Signature:**
```typescript
type OrgSourceHook = (atomId: string) => Promise<AtomOverride | null>;
```

**`AtomOverride` type** (`src/policy-atoms-core/schema.ts`):
```typescript
interface AtomOverride {
  scope?: string[];
  synopsis?: string;
  version?: number;
  distributable?: boolean;
  tags?: string[];
  related?: string[];
}
```

**What it does:** Called by `resolve()` for each atom before the atom is returned. If the hook returns a non-null `AtomOverride`, those fields are merged into the atom's frontmatter. This lets an org-level policy bundle raise or narrow an atom's scope, update its synopsis, or change its version (invalidating caches) without modifying DocWright's source atoms.

**What it cannot change:** `id`, `kind`, `ai_category`. These are enforcement-semantic fields — changing them would silently reclassify a deterministic check as judgment (or vice versa), which would bypass code enforcement.

**Stub behavior:** `nullOrgSourceHook` always returns `null` (no overrides applied).

**When to implement:** When an org ships a signed policy bundle that tightens base-DocWright atoms for their compliance requirements. Example: a financial services org narrows `frontmatter-validate`'s scope to also cover `docs/SOPs/`.

**Extension pattern:**
```typescript
import { OrgSourceHook, AtomOverride } from './policy-atoms-core/resolver.js';

const myOrgHook: OrgSourceHook = async (atomId) => {
  const overrides = await fetchFromOrgBundle(atomId); // your transport layer
  return overrides ?? null;
};

const { atoms } = await resolve(atomIds, { policiesDir }, { orgSource: myOrgHook });
```

---

## `JudgmentDispatchHook`

**Location:** `src/policy-atoms-core/resolver.ts` → `JudgmentDispatchHook` type

**Signature (frozen per Design Decision Q5):**
```typescript
type JudgmentDispatchHook = (
  ai_category: AiCategory,
  payload: string,
) => Promise<string | null>;
```

**What it does:** Called by `evaluateJudgmentAtom()` when a judgment atom needs LLM evaluation. The hook receives the atom's `ai_category` (e.g., `'reasoning'`, `'classification'`) and the rendered prompt, and returns the model's response as a string. Returning `null` signals that the hook is not configured — the caller falls back to a default model.

**Stub behavior:** `nullJudgmentDispatchHook` always returns `null`.

**`evaluateJudgmentAtom()` call site:**
```typescript
const result = await evaluateJudgmentAtom(atom, ctx, judgmentDispatchHook, modelId);
// result.pass: true | false | null (inconclusive)
// result.skipped: true if hook returned null
// result.response: raw model response string
// result.modelUsed: model id for cache key construction
```

**Cache key (Design Decision Q4):** `(atom_id, document_hash, atom_version, model_id)` — all four required. The `modelUsed` field in `JudgmentResult` provides the `model_id` component.

**When to implement:** When integrating LiteLLM as the routing layer between DocWright's MCP server and AI backends.

---

## LiteLLM Integration Path

This is the natural next implementation when the LiteLLM microservice is ready (see `research/rlm-recursive-language-models.md` for the Python microservice pattern).

```typescript
// Future implementation — not built in this plan
import { JudgmentDispatchHook } from './policy-atoms-core/resolver.js';

const liteLLMHook: JudgmentDispatchHook = async (ai_category, payload) => {
  // ai_category → model selection:
  //   'classification' → cheapest capable model (qwen2.5:14b)
  //   'generation'     → cluster mistral-small3.2:24b
  //   'reasoning'      → claude-sonnet-4-6 or mistral-small3.2:24b
  const model = selectModel(ai_category); // see docs/policy-atom-model-routing.md
  const response = await liteLLM.complete({ model, prompt: payload });
  return response.text;
};
```

The hook signature is frozen so the LiteLLM integration can slot in without touching `resolver.ts` again. See `docs/policy-atom-model-routing.md` for the model selection table per `ai_category`.

---

## Hook wiring in practice

```typescript
import { resolve, evaluateJudgmentAtom, nullOrgSourceHook, nullJudgmentDispatchHook } from './policy-atoms-core/resolver.js';
import { route } from './policy-atoms-core/router.js';

// Pass-1: route
const { atomIds } = route(synopsisIndex, actionScope);

// Pass-2: resolve (with org override hook)
const { atoms } = await resolve(atomIds, { policiesDir }, { orgSource: orgHook ?? nullOrgSourceHook });

// Run deterministic checks
for (const atom of atoms.filter(a => a.frontmatter.kind === 'deterministic')) {
  if (atom.check) {
    const result = await atom.check(ctx);
    // handle result...
  }
}

// Run judgment evaluations (at gate points only — not on every write)
for (const atom of atoms.filter(a => a.frontmatter.kind === 'judgment')) {
  const result = await evaluateJudgmentAtom(atom, ctx, judgmentHook ?? nullJudgmentDispatchHook);
  // cache result by (atom.frontmatter.id, documentHash, atom.frontmatter.version, result.modelUsed)
  // handle result...
}
```

## Related

- `src/policy-atoms-core/resolver.ts` — hook type definitions and `evaluateJudgmentAtom()`
- `src/policy-atoms-core/schema.ts` — `AtomOverride`, `AiCategory`, `JudgmentResult`
- [[docs/policy-atom-model-routing.md]] — model selection per ai_category
- [[docs/policy-atom-scope-routing.md]] — which MCP tools fire which atoms
