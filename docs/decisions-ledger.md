---
title: Decisions Ledger
status: active
author: NetYeti
created: 2026-06-14
tags: decisions, failures, patterns, cross-session-memory
---

# Decisions Ledger — Proven, Failed, and Speculative Approaches

## Purpose

Persistent cross-session memory. Every time a pattern is tried and it fails,
or a pattern is proven to work, it goes here. Agents starting a new session
read this before proposing changes — no more repeating past failures.

## How to use

- Before proposing a change that touches infrastructure, model config, or routing:
  **search this ledger for related entries first.**
- If a new approach fails: add the failure here so the next session avoids it.
- If an approach succeeds: record the conditions so the pattern can be replicated.

---

## Section 1: Failed Approaches (Dead Ends)

### F1 — Docker Ollama + SYCL/BigDL for Intel Arc GPU

**Date:** 2026-06-14
**Tried by:** NetYeti @ phoenix
**Symptom:** SYCL backend reports 0 VRAM on Meteor Lake UMA (shared memory). Docker ollama crashes under load.
**Root cause:** SYCL/BigDL project for Intel GPU was archived January 2026. Not maintained. Meteor Lake Arc integrated GPU has 0 dedicated VRAM — all model data shares system RAM.
**Evidence:** `ext_intel_free_memory is not supported` in Docker logs. GPU falls back to CPU → thermal event.
**Verdict:** DO NOT attempt. Use native Ollama + Vulkan instead.

### F2 — qwen2.5-coder:14b on Local Intel Arc (Direct)

**Date:** 2026-06-14
**Tried by:** NetYeti @ phoenix
**Symptom:** 51 seconds latency, 26/49 layers on GPU, rest CPU. System hits swap. Unusable for interactive tool calling.
**Root cause:** 14B model needs ~8-16GB. Only ~7GB system RAM available on phoenix. GPU fallback to CPU → swap storm → thermal.
**Evidence:** Latency table in `docs/ai-inference-routing-research.md`. `ollama ps` showed 26/49 GPU layers.
**Verdict:** DO NOT run 14B models directly on phoenix Arc. Route to remote Nvidia node via Olla instead.

### F3 — Llama 3.1 8B on Local Intel Arc

**Date:** 2026-06-14
**Tried by:** NetYeti @ phoenix
**Symptom:** 22-27s latency. Raw JSON tool output instead of executing tool calls. T3 model tier — draft/query only.
**Root cause:** Model too small (8B params) for complex instruction sets + tool calling in opencode's agent workflow. Cannot handle the DocWright instruction payload (~5000+ tokens).
**Evidence:** Session output showed 7m27s Build phase, generic "User input is too general" response. Research doc at `docs/ai-inference-routing-research.md`.
**Verdict:** DO NOT use Llama 3.1 8B for agentic tool-calling tasks. Acceptable only for lightweight chat or as emergency fallback.

### F4 — Swapping Model String in opencode.json Without Fixing Routing

**Date:** Multiple sessions (recurring pattern)
**Tried by:** Multiple agents
**Symptom:** Change `"model"` in `opencode.jsonc` to a different model string. Model is slow or broken. Change it back. Repeat.
**Root cause:** Treats the symptom (slow response) not the cause (model hitting local CPU-only Ollama instead of being routed through Olla → remote Nvidia). The model string is irrelevant if the routing infrastructure is missing.
**Evidence:** The `opencode.jsonc` has been flipped between `llama3.1` and `qwen2.5-coder` multiple times. Each time the underlying routing was still pointing at local port 11434 directly.
**Verdict:** DO NOT change model strings in isolation. Always verify: (1) Is Olla running? (2) Is remote Nvidia node reachable? (3) Is the model string using the Olla provider endpoint?

### F5 — Docker ollama in ai-stack docker-compose (Intel Arc SYCL)

**Date:** 2026-06-14
**Tried by:** NetYeti @ phoenix
**Symptom:** Port 11434 conflict between Docker ollama and native ollama. SYCL crashes on Meteor Lake UMA.
**Root cause:** Docker ollama was initially set up with SYCL/BigDL for Intel Arc. This was removed when native Ollama+Vulkan proved to be the correct path.
**Evidence:** `docker-compose.arc.yml` was modified to remove the ollama service. `ollama.service` (Docker systemd) is inactive. `ollama-native.service` (Vulkan systemd) is active.
**Verdict:** Docker ollama for Arc was intentionally removed. Do not re-add. Native Ollama + Vulkan is the correct local path.

### F6 — Running 14B Models on Phoenix Arc at All

**Date:** 2026-06-14
**Tried by:** NetYeti @ phoenix
**Symptom:** All 14B models (qwen2.5:14b, qwen2.5-coder:14b) degrade to CPU fallback → swap → system instability.
**Root cause:** Phoenix Arc iGPU has 0 VRAM. Only ~7GB system RAM free. 14B models need 8-16GB. Physics limitation — cannot be fixed with config changes.
**Evidence:** Research doc shows qwen2.5:14b at ~2m+ latency hitting swap.
**Verdict:** Phoenix Arc is incapable of running 14B models. Do not attempt. Route all 14B+ inference to remote Nvidia node (10.10.0.201).

---

## Section 2: Proven Approaches (Known Good)

### P1 — Routing Through Olla to Remote Nvidia Node

**Date:** 2026-06-14
**Tried by:** NetYeti @ phoenix
**Result:** ✅ Working — tool calling confirmed, ~1s latency
**Config:**
- Olla endpoint: `http://100.123.141.125:40114/olla/ollama/v1`
- Model string: `openai/qwen2.5-coder:14b` (or any model available on the remote node)
- Olla load balancer: `priority` — remote Nvidia at 90, local at 70
- Remote Nvidia node: `10.10.0.201:11434` (24GB VRAM, RTX 3090 Ti)
- **Prerequisite:** Olla container must be running
**Evidence:** Session note `2026-06-14 13:44` — "Tool calling confirmed working with llama3.1:8b through Olla's OpenAI-compatible endpoint (~1s vs 22-27s local)"
**Verdict:** USE THIS. It's the only proven fast path for tool-calling inference from phoenix.

### P2 — Native Ollama + Vulkan for Local Fallback

**Date:** 2026-06-14
**Tried by:** NetYeti @ phoenix
**Result:** ✅ Working — GPU detected, partial offload
**Config:**
- Service: `ollama-native.service` (systemd, enabled, running)
- Binary: `/usr/local/bin/ollama-native`
- Port: 11434
- Env: `OLLAMA_VULKAN=1`, `OLLAMA_IGPU_ENABLE=1`
- Models: 7B and smaller work (25/25 GPU layers). 14B models partial (26/49 GPU layers).
**Limitations:** 7B models at 22-27s. 14B models at 51s+. Not suitable for interactive use.
**Verdict:** Good emergency fallback if remote Nvidia is unreachable. Acceptable for lightweight tasks with small models.

### P3 — Remote Nvidia Node Standalone Direct Connection

**Date:** 2026-06-14
**Tried by:** NetYeti @ phoenix
**Result:** ⚠️ Reachable at ~7ms via NetBird VPN, but GPU NOT working
**Config:**
- Host: `10.10.0.201`
- Port: `11434`
- Network: NetBird VPN (100.123.x.x/16)
- GPU: RTX 3090 Ti, 24GB VRAM (reported, but inference is CPU-speed)
- Latency: 6.75-7.10ms ping
**Updated 2026-06-14:** Benchmarked qwen2.5-coder:14b at 0.5 tok/s, llama3.2:3b at 10.5 tok/s. These are CPU-level speeds despite the RTX 3090 Ti. Remote node's GPU acceleration is broken — needs investigation on the remote host.
**Verdict:** NOT currently a fast path. Falls back to CPU inference. Routing here gives no speed benefit over local Vulkan Ollama.

---

## Section 3: Conditional / Speculative

### S1 — qwen2.5-coder:14b on Remote Nvidia via Olla

**Status:** Should work (proven for llama3.1:8b, same path)
**Reasoning:** The routing path (Olla → remote Nvidia) was confirmed working with llama3.1:8b at ~1s. qwen2.5-coder:14b on the same path should work similarly fast because both models run on the same remote Nvidia hardware. The model itself supports tools.
**Prerequisite:** Olla container must be running. Remote Nvidia node must be up.
**Blocked by:** Olla container is currently down (not started after last reboot or compose restart).

### S2 — Using opencode directly against remote Nvidia Ollama (bypass Olla)

**Status:** ❌ Tested — remote node also CPU-bound
**Date tested:** 2026-06-14
**Result:** 24-28s latency for qwen2.5-coder:14b at 0.5 tok/s. Same as local.
**Reasoning:** Added `cluster-nvidia` provider to global opencode config. Direct connection to `http://10.10.0.201:11434/v1` works but is not faster than local because the remote GPU is also broken.
**Verdict:** Configured but not beneficial until remote node GPU is fixed. Use local Vulkan path instead.

---

## Section 4: Operational Checklist (Session Start)

Before changing ANY infrastructure, model, or routing config, verify:

- [ ] Is Olla running? (`docker ps | grep olla` or `curl :40114`)
- [ ] Is remote Nvidia node reachable? (`ping 10.10.0.201`)
- [ ] Is native Ollama running? (`systemctl status ollama-native.service`)
- [ ] What does `opencode.jsonc` `"model"` currently point to?
- [ ] Have I checked the decisions-ledger for related failures?
- [ ] Am I changing the model string in isolation without the routing? (Never — see F4)
