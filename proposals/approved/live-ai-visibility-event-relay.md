---
title: "Live AI Visibility — Authenticated /event Relay into Native Panels"
author: NetYeti
created: 2026-07-09
tags:
  - webui
  - ai-integration
  - security
  - architecture
  - phase-4
approved: true
created_by: "NetYeti@cluster-llm"
assigned_to: NetYeti
priority: high
complexity: high
_path: proposals/approved/approved/live-ai-visibility-event-relay
consumed_by: plans/live-ai-visibility-event-relay.md
---

## Problem

Every AI surface in the Web UI (plan review, chat panel, Improve, Synthesize, plan
executor) shows only **finished** AI responses. During generation — minutes on local
models — the user sees nothing and is left to guess whether work is happening.
This is a known systemic failure, already captured from another angle in the open
proposal *"Plan Executor Panel Has No Feedback During BigPickle Session — Humans
Panic and Interrupt."*

Root cause (established 2026-07-08 debugging session): `opencodeComplete()` uses the
**blocking** `POST /session/:id/message` endpoint and discards OpenCode's real-time
feed entirely. Meanwhile `opencode serve` exposes a global SSE event bus at
`GET /event` that emits `message.part.delta` (token-by-token, including reasoning),
`step-start`/`step-finish`, tool activity, and `session.status` busy/idle — verified
locally: one short prompt produced 31 delta events. The full "terminal experience"
exists on the wire; we throw it away.

A related security finding was filed during the same investigation:
[[issues/bug-opencode-serve-exposed-unauthenticated-on-00004096.md]] — the agent
server (shell + edit access) listens unauthenticated on `0.0.0.0:4096`.

## Research Basis

Deep-research sweep (2026-07-08, 23 sources, 23 claims verified 3-0 by adversarial
panels) on how the industry builds "watch the agent work live" UIs:

- **Universal convergence on typed event-stream relay into custom components.**
  No surveyed project iframes the agent's own UI. Examples with OpenCode
  specifically: `chriswritescode-dev/opencode-manager` (browser → its own
  authenticated backend → proxied OpenCode SSE; raw server never browser-exposed),
  `joelhooks/opencode-vibe` (SSE-only, token-by-token, official SDK), and
  assistant-ui's official `@assistant-ui/react-opencode` runtime (subscribes to
  `/event`, projects into components).
- **AG-UI protocol** (adopted by Google, LangChain, AWS, Microsoft) formalizes the
  pattern: ~16 typed events — `TEXT_MESSAGE_CONTENT` deltas, `TOOL_CALL_*`,
  `STEP_STARTED/FINISHED`, run lifecycle — a ready-made vocabulary for our renderer.
- **Security consensus:** OpenHands docs: *"Do not expose an unauthenticated Agent
  Server on a public network. It can execute commands and read or write files."*
  Recommended topology everywhere: agent server behind an authenticated
  backend/reverse proxy.
- **Iframe embed disqualified empirically:** the OpenCode web app served at :4096
  pulls its UI assets from the remote origin `app.opencode.ai` (verified in the
  binary: `new URL("https://app.opencode.ai")`) — breaking air-gapped deployment,
  loading governance-tool UI code from a third party at runtime, and offering no
  per-user session isolation.
- **OpenCode provides the right primitives:** `POST /session/:id/prompt_async`
  (fire-and-forget trigger) + `GET /event` (display), and native hardening
  (`OPENCODE_SERVER_PASSWORD`, `--cors`).

## Proposed Solution

One live-visibility architecture for **all** AI surfaces:

```
Browser ── authenticated SSE (existing Web UI auth + keepalives) ──▶ SvelteKit server
                                                                         │  single persistent GET /event subscription
                                                                         │  session registry: sessionID → {owner, feature, doc}
                                                                         │  filters + relays only sessions the user owns
                                                                         ▼
                                                  opencode serve (password-set, CORS-restricted, never browser-exposed)
```

Components:

1. **Hardening (prerequisite):** basic-auth support in all `OPENCODE_URL` clients,
   then `OPENCODE_SERVER_PASSWORD` + `--cors` on the server. Browser never contacts
   :4096 — permanently, as an invariant.
2. **Event relay backbone:** one server-side `/event` subscription with reconnect;
   a session-ownership registry stamped at session creation; an authenticated
   `/api/ai/stream` SSE endpoint per session with keepalives (pattern already
   proven in the review-panel fix, commit 0eb42d4).
3. **`AgentActivityView` renderer:** a single Svelte component rendering the full
   spew — token deltas, reasoning blocks, tool calls, step boundaries, busy/idle —
   mapped to an AG-UI-style taxonomy. Recorded real event-log fixtures become
   replayable test assets.
4. **Surface migrations:** review → chat → improve/synthesize → executor, each
   switching from blocking-POST rendering to trigger (`prompt_async` where
   suitable) + live event rendering.

### Requirements this must satisfy (agreed 2026-07-08)

Security-first (no new unauthenticated surface); safety via validation + audit, not
restriction; AI governance boundaries intact on the new surface; policy/profile-
configurable exposure; test-verified per step; provider-agnostic; multi-surface-
ready (VSCodium later); per-user session isolation; container/proxy deployment
reality (SSE buffering, idle timeouts — keepalives + `X-Accel-Buffering` lessons
retained); reconciles existing deferred proposals; systemic (one architecture for
every AI panel); delivered through proposal → plan lifecycle.

### Reconciliation with existing proposals

- **Supersedes** the 2026-07-08 review-panel streaming prototype (dogfood branch) —
  its keepalive fix and captured event fixtures carry forward.
- **Addresses** *Plan Executor Panel Has No Feedback* at the root (executor
  migration step).
- **Absorbs** *External AI Watcher Presence Indicator* — trivial busy/idle chip on
  the relay.
- **Keeps deferred** *Chat Panel Terminal/PTY (xterm.js)* and *Chat Panel
  Enterprise Dual-Mode* — PTY remains a valid power-user add-on with known prior
  art (247-claude-code-remote), out of scope here.
- **Feeds** *AI Model Indicator* — model metadata is on the bus.

## Plan Decomposition (Haiku-executable, per 2026-07-08 directive)

Three plans, strictly ordered; every step small, self-contained, with its own
verification command; no step requires architectural judgment beyond this document.

**Plan A — Harden the OpenCode server (small, ships first)**
A1. Basic-auth header support in `opencode-complete.ts` + all `OPENCODE_URL`
    fetches, via env var; unit test asserts Authorization header with stubbed fetch.
A2. Set `OPENCODE_SERVER_PASSWORD`/`--cors` on host service; `.env.example`,
    docker docs, deployment.md updated; verify `curl` unauth → 401, auth → 200.
A3. Regression: all existing AI features green against the hardened server (e2e).

**Plan B — Event relay backbone**
B1. `src/webui/src/lib/server/opencode-events.ts`: persistent `/event` consumer
    with reconnect/backoff; parser unit-tested against recorded fixture log.
B2. Session registry module + ownership stamping at session creation; unit tests.
B3. `/api/ai/stream` authenticated SSE endpoint: per-session filter, owner check,
    15s keepalives; integration test against a fake OpenCode fixture server,
    including the owner-mismatch 403 case.
B4. Capture + commit canonical event-log fixtures (delta/reasoning/tool/step) as
    test assets.

**Plan C — Renderer and surface migrations**
C1. `AgentActivityView.svelte` + fixture-playback test (replay recorded log →
    assert rendered sequence: prompt, reasoning stream, deltas, step banners).
C2. Migrate plan-review (trigger + live render; remove prototype code); Playwright
    e2e on a real plan.
C3. Migrate chat panel; e2e.
C4. Migrate Improve + Synthesize; e2e.
C5. Migrate plan executor; closes the "no feedback" proposal; e2e.
C6. Busy/idle presence chip (absorbs watcher-indicator proposal).

## Alternatives Considered

- **Iframe/reverse-proxy the OpenCode web app:** rejected — remote asset origin
  (`app.opencode.ai`) breaks air-gap and supply-chain posture; shows all sessions
  to all viewers; zero industry prior art.
- **xterm.js PTY embed of the TUI:** viable but heavier and security-sensitive
  (full interactive tool access from the browser); stays a deferred proposal.
- **Per-panel incremental patches** (the 2026-07-08 prototype approach): rejected
  by direct experience — three iterations still produced a filtered, non-live view
  and left every other AI surface broken.

## Future

- VSCodium extension consumes the same relay (or the bus directly, host-side).
- PTY terminal panel for power users (existing deferred proposal).
- AG-UI protocol adoption as a formal boundary if DocWright ever supports
  non-OpenCode agent backends.
- Multi-perspective review integration: parallel model sessions rendered
  side-by-side from the same bus.
