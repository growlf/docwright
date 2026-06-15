---
title: "Recursive Language Models (RLMs) — Integration Evaluation"
status: active
question: "Can RLMs address DocWright's context-window and token-burn problems, and what is the correct integration path?"
conclusion: recommends
author: NetYeti
created: 2026-06-15
author-role: contributor
tags:
  - research
  - ai
  - rlm
  - architecture
  - context-window
  - token-burn
  - python
linked_proposals: []
related_research: []
---

# Recursive Language Models (RLMs) — Integration Evaluation

## Questions Explored

- What are RLMs and how do they work?
- Is this a fundamental paradigm shift that requires reworking existing plans?
- Should DocWright switch back to Python given `rlms` is a Python library?
- What is the correct integration path given the TypeScript architecture?
- When is the right time to implement this?

---

## Source

- **Repo:** https://github.com/alexzhang13/rlm
- **Paper:** arxiv.org/abs/2512.24601 (MIT OASYS lab, Dec 2025)
- **Library:** `pip install rlms` (Python 3.11+)
- **Stars:** ~4,700 — adopted by DSPy, Google ADK, Ax

---

## What RLMs Are

RLMs replace the canonical `llm.completion(prompt)` call with `rlm.completion(prompt)`.
The difference: the LM gets a REPL environment and can write code that recursively calls
sub-LMs on smaller, focused slices of the problem. Instead of loading a 200-document
vault into a single context window, the RLM decides what to read, fetches only what's
relevant, and aggregates results recursively.

Supports any OpenAI-compatible backend — compatible with Meshy/Ollama as-is.

**Minimum viable model:** A model capable of writing reliable decomposition code.
`llama3.1:8b` is insufficient (too small for complex instruction + code generation).
`qwen2.5-coder:14b` is the practical minimum. See decisions-ledger F3, F6.

**Security note:** Default REPL executes code on the host process. Docker and cloud
sandbox environments are available for isolated execution — required for any
production-grade deployment per DocWright's security-first policy.

---

## Finding 1 — Not a Paradigm Shift

RLM does not change DocWright's architecture, data model, or plan direction.

The existing `AIEngine` interface (`findSimilar`, `fillProposal`, `critiqueDocument`,
`gatePreReview`, `estimateComplexity`) operates on one document at a time. These methods
don't hit context-window limits today. RLM would be a better *implementation* of the
multi-document methods that are currently stubs — it doesn't change the interface,
the dispatch module structure, or any plan's direction.

**What changes:** How the AI engine navigates to relevant documents in multi-doc tasks.
**What stays the same:** Every plan, every interface, every data model, every active proposal.

Plans that benefit from an RLM implementation note (but don't need rewrites):
- `plans/plan-policy-atom-framework-...md` — multi-atom cross-reference analysis
- `docs/collation.md` — overlap detection across N proposals

---

## Finding 2 — Keep TypeScript; Don't Switch Back to Python

The language question was explored as a prerequisite to the integration question.

**Why TypeScript was chosen:**
The Web UI is SvelteKit — TypeScript is non-negotiable there (12,138 lines of
Svelte/TS). The dispatch module is TypeScript so it can be imported directly by
SvelteKit `+server.ts` routes without an HTTP boundary. The Python `mcp-server.py`
was already identified as technical debt and deliberately replaced with the TypeScript
MCP server. That migration cost has been paid.

**Would switching back to Python help?**
No. SvelteKit cannot be rewritten in Python. The dispatch module being co-located with
the web UI routes is a real simplicity win — a Python dispatch layer would require an
HTTP boundary between the web UI and the engine, undoing that benefit.

**The RLM integration path that avoids the language mismatch entirely:**
Build a small Python HTTP microservice (~50 lines) that wraps `rlms` and exposes an
OpenAI-compatible `/chat/completions` endpoint. Point `OLLA_BASE` at it. The existing
`OllamaEngine` already calls OpenAI-compatible endpoints — zero other code changes
needed. This is cleaner than a subprocess bridge AND cleaner than converting the
dispatch layer.

---

## Finding 3 — Where RLM Adds Real Value in DocWright

### High value (multi-document, currently stubs):

| Feature | Without RLM | With RLM |
|---------|-------------|----------|
| Collation / overlap detection | Load N proposals into one context | RLM scans atom index, fetches only candidates, compares |
| Policy atom cross-reference | Can't scale past ~20 atoms | RLM navigates the atom index recursively — scales to 200+ |
| Knowledge-base Ingest/Lint | Large doc → manual chunking | RLM decomposes doc recursively into atoms |

### No immediate value (single-document operations):

`findSimilar`, `critiqueDocument`, `gatePreReview`, `fillProposal`, `estimateComplexity`
all operate on one document. No context-window problem exists today. RLM adds nothing
for these — keep the current `OllamaEngine` path.

### The key architectural fit:

Policy atom frontmatter (`tags:`, `scope:`, `related:`) acts as the navigation index
the RLM uses to traverse the vault without loading full document bodies. The atom
structure and RLM decomposition are complementary — the atoms are the data structure,
RLM is the query paradigm that scales across them.

---

## Pre-requisites Before Implementing

1. **ai-stack GPU fix** — RLM requires a model capable of writing decomposition code.
   `qwen2.5-coder:14b` with GPU acceleration is the minimum. Phoenix Arc cannot run it
   (decisions-ledger F6). Remote Nvidia node GPU is currently broken (decisions-ledger P3).
   This is an `ai-stack` project dependency, not a DocWright dependency.

2. **Policy atom framework** — The atom frontmatter index (tags, scope, related) needs
   to exist before RLM can navigate it. The policy atom framework plan must reach a
   working state first.

3. **Python microservice** — ~50-line Python service wrapping `rlms`, exposing
   `/chat/completions`. Standalone; no changes to DocWright's TypeScript codebase.

---

## Related Work

### TRM / TR-mamba2attn — Latent Recursion via SSMs (arxiv 2602.12078)

**Paper:** "Tiny Recursive Reasoning with Mamba-2 Attention Hybrid" — Wang & Reid, ICLR 2026 Latent & Implicit Thinking Workshop.

A parallel development in the recursive reasoning space, but at the model architecture level rather than the inference framework level.

**How it differs from RLM:**
- RLM = inference-time recursion — the model emits tokens, writes code, and calls sub-LMs explicitly
- TRM = latent recursion — reasoning happens in hidden representation space, no intermediate tokens emitted

TRM maintains two latent states (`zH`, `zL`) updated via recursive equations through the same operator stack, repeated up to 66 inner × 3 outer passes. The Mamba-2 variant replaces Transformer blocks in the recursive scaffold with SSM operators, achieving linear-time (rather than quadratic) inference.

**Benchmarks:** ARC-AGI-1 (~46% pass@2), Sudoku, Maze — abstract visual/pattern reasoning only. 7M parameters. Not an NLP production model; cannot handle DocWright's instruction payloads (~5,000+ tokens) at this scale.

**Why it matters for DocWright's direction:**

1. Validates the recursive reasoning bet — two independent research threads (RLM from MIT OASYS, TRM from the same lab) are converging on recursion, not scale, as the right lever for reasoning under compute constraints.
2. SSM/Mamba-2 linear-time inference — as SSM-based production LLMs mature (Mamba, RWKV successors, hybrid models), they become candidates for local deployment without the GPU memory pressure of attention-heavy Transformers. Directly relevant to Phoenix's thermal constraints and the ai-stack GPU fix dependency.
3. Latent recursion efficiency — if the pattern scales to NLP models, it removes the intermediate token cost of chain-of-thought, making policy atom analysis cheaper at inference time.

**Current applicability:** None in production. Research-stage only. Monitor as SSM-based models mature to NLP scale (12–24 month horizon).

**Primary home:** ai-stack/Meshy (`docs/models.md` Emerging Architecture Watch). DocWright's relevance is indirect — through the inference layer dependency — not direct.

---

## Conclusion

**RLM is the correct long-term implementation strategy for multi-document AI tasks in DocWright.**

Stay the course on the current architecture and active plans. No rewrites needed.

Specific actions when pre-requisites are met:
1. Create deferred proposal: "RLM Python microservice for multi-document AI analysis"
2. Add implementation note to the policy atom framework plan: "multi-atom cross-reference
   should use RLM-style decomposition (recursive index scan + targeted fetch)"
3. Add implementation note to the collation plan: same guidance
4. Build and wire the microservice; update `OLLA_BASE` to point at it for multi-doc tasks

Until pre-requisites are met: apply the RLM *pattern* manually in OpenCode prompts —
scan index first, fetch only relevant docs, then analyze. Captures most of the token
savings without integration work.
