---
title: "Deferred: RLM Python Microservice — Multi-Document AI via Recursive Language Models"
author: NetYeti
author-role: contributor
created: 2026-06-17
tags:
  - ai
  - rlm
  - python
  - microservice
  - multi-document
  - collation
  - policy-atoms
  - research-ai
complexity: medium
estimated_effort: M
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - research/rlm-recursive-language-models.md
  - plans/completed/plan-policy-atom-framework-generic-tiered-policy-engine-for-docwright-governance.md
  - docs/collation.md
  - plans/phase-4-profile-aware-features.md
---

## Problem

DocWright's multi-document AI tasks — overlap detection across proposals, policy atom
cross-reference analysis, knowledge-base ingest/lint — cannot scale using the current
single-shot `AIEngine` call pattern. Loading 20+ documents into one context window
burns tokens, hits limits, and produces shallow results because the model is forced to
skim rather than reason.

**Affected features (currently stubs):**
- Collation / overlap detection — `docs/collation.md` stub; scales to ~5 proposals today
- Policy atom cross-reference — multi-atom analysis chokes past ~20 atoms
- Knowledge-base profile `Ingest` stage — large documents need manual chunking

All three are blocked by the same root cause: no recursive navigation strategy.

## Research Basis

See [[research/rlm-recursive-language-models.md]] for full findings. Summary:

- **RLM** (Recursive Language Models, MIT OASYS lab, arxiv 2512.24601): replaces a
  single `llm.completion(prompt)` call with an agent that writes decomposition code,
  recursively calls sub-LMs on focused slices, and aggregates results. Stars: ~4,700.
  Adopted by DSPy, Google ADK, Ax.
- Policy atom frontmatter (`tags:`, `scope:`, `related:`) acts as the navigation index
  the RLM uses to traverse the vault — the data structure and the query paradigm are
  complementary.
- RLM does **not** change DocWright's architecture, interfaces, or any active plan.
  It is a better implementation of methods that are currently stubs.

## Why Deferred

Two pre-conditions must be met before this is actionable:

1. **ai-stack GPU fix** — RLM requires a model capable of writing reliable decomposition
   code. Minimum: `qwen2.5-coder:14b` with GPU acceleration. Phoenix Arc cannot run it
   (thermal/VRAM constraints, decisions-ledger F6). The remote NVIDIA node GPU is
   currently broken (decisions-ledger P3). This is an `ai-stack` project dependency.

2. ~~**Policy atom framework**~~ — ✅ **Met.** The atom framework (tags, scope, related
   frontmatter, resolver, hub file) is complete as of v0.3.x. This pre-condition is done.

When the GPU fix lands, this proposal is immediately actionable.

## Proposed Solution

Build a small Python HTTP microservice (~50 lines) that wraps `rlms` and exposes an
OpenAI-compatible `/chat/completions` endpoint. Point a new `OLLA_RLM_BASE` environment
variable at it. The existing `OllamaEngine` already calls OpenAI-compatible endpoints —
the only code change is routing multi-document tasks to `OLLA_RLM_BASE` instead of
`OLLA_BASE`.

**What this is not:**
- Not a language change. TypeScript stays. No Python in the dispatch module.
- Not a subprocess bridge. The microservice is a standalone HTTP server — cleaner than
  FFI or child_process.
- Not a rewrite of any existing AI feature. Single-document calls (`critiqueDocument`,
  `gatePreReview`, `fillProposal`) stay on `OllamaEngine` unchanged.

**Security note:** Default `rlms` REPL executes code on the host process. The microservice
must run in a Docker sandbox for any production deployment. This is a hard requirement per
DocWright's security-first policy.

### Implementation sketch

```python
# ~50 lines — rlm_service.py
from flask import Flask, request, jsonify
from rlms import RLM

app = Flask(__name__)
rlm = RLM(model="qwen2.5-coder:14b", base_url=os.environ["OLLAMA_BASE"])

@app.post("/v1/chat/completions")
def chat():
    body = request.json
    result = rlm.completion(
        messages=body["messages"],
        sandbox="docker"  # required
    )
    return jsonify(result.to_openai_response())
```

```typescript
// In OllamaEngine — route multi-doc calls:
const endpoint = isMultiDoc ? process.env.OLLA_RLM_BASE : process.env.OLLA_BASE;
```

### Files affected

| File | Change |
|------|--------|
| `src/dispatch/ai.ts` | Route multi-doc methods to `OLLA_RLM_BASE` |
| `src/webui/.env.example` | Add `OLLA_RLM_BASE` |
| `docs/collation.md` | Note RLM as the implementation strategy |
| `scripts/rlm-service/rlm_service.py` | New ~50-line Python microservice |
| `scripts/rlm-service/Dockerfile` | Docker sandbox per security requirement |

### Where it lands in the roadmap

Phase 5 — Research AI Tooling (step alongside 4g in current numbering). Depends on:
- Phase 4 profile engine runtime (for context injection into decomposition prompts)
- ai-stack GPU fix (external dependency — not DocWright's gate to close)

## Interim Approach

Until the GPU fix lands: apply the RLM *pattern* manually in OpenCode prompts — scan
the atom index first, fetch only relevant documents, then analyze. This captures most
of the token savings without any integration work.

## Related Work

**TRM / TR-mamba2attn** (arxiv 2602.12078, Wang & Reid, ICLR 2026): latent recursion
via SSM operators rather than inference-time token emission. Research-stage only (7M
params, not NLP-scale). 12–24 month horizon. Primary home: ai-stack `docs/models.md`
Emerging Architecture Watch. DocWright relevance is indirect through the inference
layer dependency. Do not act on this until SSM-based production LLMs mature.
