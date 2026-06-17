---
title: Phoenix Arc GPU Acceleration + Local AI Reliability
status: canceled
author: NetYeti
created: 2026-06-14
tags:
  - phoenix
  - gpu
  - arc
  - ollama
  - ai-stack
  - infra
proposal_source: none
priority: high
mode: guided
assigned_to: NetYeti@phoenix
reviewed_by: NetYeti
reviewed_date: 2026-06-14
_path: plans/phoenix-arc-gpu-ai-stack-reliability.md
---

## Overview

Phoenix (this workstation, Intel Meteor Lake-P Arc Graphics) runs Ollama at
100% CPU — GPU acceleration is broken. The BigDL-embedded Ollama runs as an
orphaned process and can't use the Arc GPU. Local model tool-calling (e.g.,
Llama 3.1 8B) fails: models output raw JSON tool schemas instead of executing
function calls.

This makes the `profile-full-local/auto` path unreliable when cloud tokens are
unavailable. Fix GPU acceleration so larger tool-capable models can run, then
update knowledge repos with known-good config.

## Implementation Steps

| # | Step | Status |
|---|------|--------|
| 1 | Stop broken BigDL-embedded Ollama process | ⏳ Pending |
| 2 | Update systemd ollama.service to point at ai-stack with Arc overlay | ⏳ Pending |
| 3 | Pull latest ipex-llm Docker image and start ollama container | ⏳ Pending |
| 4 | Verify GPU acceleration (ollama ps shows GPU %) | ⏳ Pending |
| 5 | Test tool-calling with qwen2.5-coder:14b | ⏳ Pending |
| 6 | Verify profile-full-local/auto routing through smart router | ⏳ Pending |
| 7 | Update ai-stack docs with standalone-node Arc pattern | ⏳ Pending |
| 8 | Update intel_nuc_skullcanyon_ollama_with_gpu with Meteor Lake Arc + xe driver notes | ⏳ Pending |

## Risks

- **ipex-llm Docker image**: `intelanalytics/ipex-llm-inference-cpp-xpu` was archived 2026-01-28. If the image is removed from Docker Hub, we need a fallback path (native Ollama + Vulkan).
- **0 VRAM bug**: Meteor Lake Arc uses shared memory. Previous attempts documented 0 VRAM in Docker. The whole-`/dev/dri` passthrough may fix this (added 2026-05-18 after prior attempts failed with per-card passthrough).
- **Port conflict**: Local BigDL process holds port 11434. Must kill it before Docker ollama can bind.

## Testing Plan

### Step Verification

- [ ] Step 1: Stop broken BigDL-embedded Ollama process
- [ ] Step 2: Update systemd ollama.service to point at ai-stack with Arc overlay
- [ ] Step 3: Pull latest ipex-llm Docker image and start ollama container
- [ ] Step 4: Verify GPU acceleration (ollama ps shows GPU %)
- [ ] Step 5: Test tool-calling with qwen2.5-coder:14b
- [ ] Step 6: Verify profile-full-local/auto routing through smart router
- [ ] Step 7: Update ai-stack docs with standalone-node Arc pattern
- [ ] Step 8: Update intel_nuc_skullcanyon_ollama_with_gpu with Meteor Lake Arc + xe driver notes

### Integration & Regression

- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Phoenix Arc GPU Acceleration + Local AI Reliability functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-14 | Plan created — GPU fix for Phoenix Arc | NetYeti@phoenix |
