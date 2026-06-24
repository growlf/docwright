# Policy Atom Model Routing Reference

Routing guide for the `judgment_dispatch_hook` in `policy-atoms-core`. Maps
`ai_category` values to the best-fit models given DocWright's hardware, validated
failure modes, and efficiency requirements.

## `ai_category` Values

| Value | Description | LLM needed? | Typical token budget |
|-------|-------------|-------------|----------------------|
| `none` | Deterministic code check | No | 0 |
| `classification` | Fast yes/no or pick-from-list | Yes — cheap, fast | 50–200 out |
| `generation` | Structured content generation | Yes — capable | 200–2,000 out |
| `reasoning` | Judgment, nuance, ambiguity | Yes — deepest capable | 200–1,000 out |
| `coding` | Code generation, review, debugging | Yes — code-specialist | 200–4,000 out |
| `agentic` | Multi-step orchestration, tool use, executor coordination | Yes — large context + tools | 500–8,000 out |

---

## Model Routing Table

> **Reading the table:** Primary = use this first. Fallback = use when primary is unreachable (offline, cluster down). Avoid = known failure mode from decisions ledger.

### `none` — No model

| Tier | Model | Notes |
|------|-------|-------|
| All | — | Pure code execution. Pre-commit hook or MCP server. Zero tokens, zero latency. |

Special consideration: The check function must be **deterministic** — same input always produces identical output. No LLM call, no caching needed.

---

### `classification` — Fast, cheap, deterministic output

**Settings:** `temperature: 0.0` · `max_tokens: 100` · Keep prompt under 2k tokens.

| Tier | Model | Latency | Why |
|------|-------|---------|-----|
| Primary | `cluster-nvidia/qwen2.5:14b` | <1s | Fast, general-purpose, good classification |
| Primary | `cluster-nvidia/qwen2.5-coder:14b` | <1s | Code-tuned — good for field/format checks |
| Fallback | `opencode/big-pickle` | 2–5s | Free, 128k context, reliable online |
| Fallback | `anthropic/claude-haiku-4-5` | 1–2s | Fastest Claude, 200k, excellent classifier |
| Offline only | `phoenix-local/qwen2.5:7b` | 3–8s | 4GB RAM, acceptable simple classification |
| **Avoid** | `llama3.1:8b` (any) | 22–27s | T3 tier — raw JSON output, cannot handle 5k token payloads (F3) |
| **Avoid** | Any 14b+ on `ollama/` (Phoenix direct) | >2min | Phoenix Arc: 0 VRAM, 14b → swap storm (F6) |

---

### `generation` — Structured content, templates, proposals

**Settings:** `temperature: 0.2` · `max_tokens: 2000` · Prompt budget: 4–8k tokens (includes profile context + document).

| Tier | Model | Latency | Why |
|------|-------|---------|-----|
| Primary | `cluster-nvidia/mistral-small3.2:24b` | 2–5s | Verified tools, 131k context, strong structured generation |
| Primary | `cluster-nvidia/qwen2.5-coder:14b` | <1s | Excellent for YAML/JSON/policy atom skeleton generation |
| Secondary | `opencode/big-pickle` | 3–8s | Free, 128k context — good for longer-form generation |
| Cloud | `anthropic/claude-sonnet-4-6` | 2–4s | 200k context, highest quality generation |
| Offline | `phoenix-local/qwen2.5:7b` | 5–15s | Acceptable for short generation (<500 tokens out) |
| **Avoid** | `cluster-nvidia/qwen3.5:27b` for tool-calling generation | — | Tool support unproven; use mistral-small for any generation that calls MCP tools |

---

### `reasoning` — Judgment atoms, gate evaluations, nuanced decisions

**Settings:** `temperature: 0.5` · `max_tokens: 800` · Prompt budget: 8–16k (needs full document + relevant atom context).

Reasoning atoms that call MCP tools (to fetch related docs for comparison) **require** a model with verified tool support. `qwen3.5:27b` cannot be used here without verification.

| Tier | Model | Latency | Why |
|------|-------|---------|-----|
| Primary | `cluster-nvidia/mistral-small3.2:24b` | 3–8s | Only verified local tool-calling model at 24B; 131k context |
| Secondary | `anthropic/claude-sonnet-4-6` | 2–5s | 200k context, excellent judgment, proven tool use |
| High-stakes | `anthropic/claude-opus-4-7` | 4–10s | Reserve for critical gate evaluations — phase gate, org-policy floor |
| Thinking (no tools) | `cluster-nvidia/qwen3.5:27b` | 8–20s | 131k, thinking model — **only for pure-text judgment** (no tool calls); enable thinking mode |
| Offline | `cluster-olla/mistral-small3.2:24b` | 3–8s | Same model via Olla load balancer — use when cluster-nvidia is unreachable |
| **Avoid** | `llama3.1:8b` for reasoning | — | Cannot handle DocWright's instruction payload (F3) |

**Thinking mode for qwen3.5:27b** (when used for pure-text reasoning):
```json
{ "options": { "temperature": 0.6, "num_predict": 2048 } }
```
May require explicit thinking-mode prompt prefix depending on Ollama version. Validate before relying on in production.

---

### `coding` — Code generation, review, debugging

**Settings:** `temperature: 0.1` · `max_tokens: 4000` · Prompt budget: 8–16k (include file context + instructions).

Routes to code-specialist models, not general-purpose. `mistral-small3.2:24b` is a general model that handles code adequately but is not the primary choice here.

| Tier | Model | Latency | Why |
|------|-------|---------|-----|
| Primary | `cluster-nvidia/qwen2.5-coder:14b` | <1s | Code-specialist, verified tools, excellent TypeScript/bash |
| Secondary | `cluster-nvidia/mistral-small3.2:24b` | 2–5s | Fallback if coder model unavailable; 131k context |
| Cloud | `anthropic/claude-sonnet-4-6` | 2–4s | 200k context, excellent code quality |
| Offline | `phoenix-local/qwen2.5:7b` | 5–15s | Acceptable for short code snippets only |
| **Avoid** | `llama3.1:8b` for coding | — | Cannot handle DocWright's instruction payload (F3) |

---

### `agentic` — Multi-step orchestration, tool use, executor coordination

**Settings:** `temperature: 0.3` · `max_tokens: 8000` · Prompt budget: 16–32k (needs full context + tool definitions + plan state).

Requires verified tool-calling support — `qwen3.5:27b` cannot be used here (tool support unproven). Large context is critical; the agent needs to hold full plan state across many steps.

| Tier | Model | Latency | Why |
|------|-------|---------|-----|
| Primary | `cluster-nvidia/mistral-small3.2:24b` | 3–10s | Only verified local tool-calling model at 24B; 131k context |
| Cloud | `anthropic/claude-sonnet-4-6` | 2–5s | 200k context, excellent tool use, proven in DocWright sessions |
| High-stakes | `anthropic/claude-opus-4-7` | 4–10s | Reserve for critical multi-step plans with irreversible actions |
| **Avoid** | `cluster-nvidia/qwen3.5:27b` for agentic | — | Tool support unproven — do not use for plans with tool calls |
| **Avoid** | `llama3.1:8b` | — | Cannot handle 5k+ token instruction payloads (F3) |

---

## Fallback Chain

When a preferred model is unreachable, follow this chain:

```
cloud (Anthropic) → cluster-nvidia → cluster-olla → phoenix-local → FAIL (clear error)
```

The `judgment_dispatch_hook` should implement this chain with a timeout per tier
(suggested: 10s before falling back). Never silently degrade — if fallback is used,
log which model ran and why.

---

## Offline Operation

When "No internet route" (as confirmed by pre-commit identity check), cloud models
are unavailable. The viable local-only stack:

| Category | Best offline model | Caveats |
|----------|--------------------|---------|
| `classification` | `cluster-nvidia/qwen2.5:14b` (if cluster reachable on LAN) | LAN-only; RTX node at `10.10.0.201` |
| `generation` | `cluster-nvidia/mistral-small3.2:24b` | LAN-only |
| `reasoning` | `cluster-nvidia/mistral-small3.2:24b` | LAN-only; verified tools |
| All (true offline) | `phoenix-local/qwen2.5:7b` | Classification only; not for reasoning |

The BMS cluster RTX node (`10.10.0.201`) is LAN-accessible even without internet — this covers 95% of offline scenarios. Pure offline (no LAN) is the exception; `qwen2.5:7b` is the only safe fallback.

---

## Cache Key (Design Decision Q4)

```
(atom_id, document_hash, atom_version, model_id)
```

All four components required. When switching models (e.g., cluster maintenance → cloud fallback), cached judgments from the prior model are **not reused** — `model_id` differs. Expect cache warmup after a model change. This is correct behavior; serving a weaker model's judgment to a stronger caller (or vice versa) is a silent quality regression.

---

## Synopsis Index Context Budget

The atom router always loads the full synopsis index before routing. The 1,500-token hard limit exists specifically to accommodate the most constrained realistic surface:

| Surface | Practical context | Index headroom |
|---------|------------------|----------------|
| `qwen2.5:7b` local | ~4k usable | 2.5k left after 1.5k index ✅ |
| `qwen2.5-coder:14b` | 32k | ample |
| `mistral-small3.2:24b` | 131k | ample |
| Claude Sonnet | 200k | ample |

The 1,500-token limit is enforced by the sync-checker. Do not increase it — the 7b local case is the binding constraint and must always have working context remaining.

---

## Related

- [[docs/decisions-ledger.md]] — F3 (8b tool failure), F6 (14b on Phoenix Arc), P3 (cluster GPU status)
- [[research/rlm-recursive-language-models.md]] — RLM for multi-atom cross-reference
- [[research/plan-execution-mode-enforcement.md]] — how mode:mentor/guided/autonomous gates judgment outputs
- [[plans/completed/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md]] — parent plan
