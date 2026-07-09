---
title: Live AI Visibility — Authenticated /event Relay into Native Panels
status: approved
author: NetYeti
created: 2026-07-09
tags:
  - webui
  - ai-integration
  - security
  - architecture
  - phase-4
proposal_source: proposals/approved/live-ai-visibility-event-relay.md
priority: high
complexity: high
automated: full
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
total_steps: 14
completed_steps: 0
scenario_synthesis: "Happy path: user triggers any AI feature and watches the live token/reasoning/tool stream in the panel via the authenticated relay. Failure paths: opencode serve down → panel shows 'connecting…' while the bus consumer reconnects with jittered backoff; non-owner requests a session stream → 403; 6th concurrent stream → 429; per-surface flag OFF → legacy blocking render (until 3.7). Host-service config change only in step 1.2 (password/CORS), gated on 1.1 running in the container and instantly reversible."
---

# Live AI Visibility — Authenticated /event Relay into Native Panels

## Overview

Replace blocking-POST AI rendering with a live event relay: DocWright's SvelteKit
server holds one persistent subscription to OpenCode's `GET /event` SSE bus and
relays per-session, ownership-filtered event streams to browsers over the existing
authenticated Web UI SSE layer. A single `AgentActivityView` renderer displays the
full activity stream (token deltas, reasoning, tool calls, step boundaries,
busy/idle) for every AI surface. Full rationale, research citations, and
alternatives: [[proposals/approved/live-ai-visibility-event-relay.md]].

```
Browser ── authed SSE (existing auth + keepalives) ──▶ SvelteKit server
                                                          │ one GET /event subscription
                                                          │ session registry {owner, feature, doc}
                                                          ▼
                                     opencode serve (password + CORS, never browser-exposed)
```

## Constraints & Invariants (read before executing ANY step)

1. **Never expose :4096 to browsers.** All browser traffic goes through DocWright's
   authenticated endpoints. This is permanent, not transitional.
2. **Dogfood UI must stay usable throughout.** Phases 1–2 are purely additive (new
   modules, new endpoint; existing behavior untouched). Phase 3 migrations each ship
   behind a per-surface env flag (`LIVE_AI_REVIEW`, `LIVE_AI_CHAT`,
   `LIVE_AI_IMPROVE`, `LIVE_AI_EXECUTOR`), default OFF, old code path retained until
   the step's e2e passes and the step is marked Done; flag flips default ON in the
   same PR only after e2e evidence is in the PR description. Flags are REMOVED only
   in step 3.7 after the soak period.
3. **Plan mutations via MCP tools only** (update_step / append_history /
   update_plan_status). Direct writes to `plans/*.md` are blocked.
4. **Provider-agnostic:** consume only generic `/event` types (message.part.delta,
   message.part.updated, message.updated, step-start/finish, session.status/idle).
   No provider-specific fields.
5. **SSE through proxies:** every streaming endpoint sends 15s `: keepalive`
   comments and `X-Accel-Buffering: no` (lessons from commit 0eb42d4).
6. **Git flow:** one branch + PR per step off `main` (`feat/live-ai-<step>`), merge
   each PR when CI is green before starting the next (no stacking). Commit format
   `feat|fix|docs|test|chore: ...`.
7. **Secrets:** credentials only via env vars; never commit values. Update
   `.env.example` with names + comments only.
8. **Single-instance assumption (declared):** the session registry (2.2) assumes
   exactly one SvelteKit server instance. Horizontal scaling requires a shared
   store — explicitly out of scope; recorded as a Phase-5 hardening item.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1.1 | Basic-auth support in OpenCode clients | In `src/webui/src/lib/server/opencode-complete.ts` add shared helper `opencodeHeaders()` returning `Authorization: Basic base64((OPENCODE_SERVER_USERNAME||"opencode")+":"+OPENCODE_SERVER_PASSWORD)` when `OPENCODE_SERVER_PASSWORD` is set (else no header); apply to every fetch there AND to all other `OPENCODE_URL` consumers found via `grep -rn "OPENCODE_URL" src/ scripts/ --include="*.ts" --include="*.js"` (list them in the PR). Unit test with stubbed global fetch asserting header present when env set, absent when not. Verify: `npm run test:webui` green. | ⏳ Pending |
| 1.2 | Enable auth + CORS on the host service | **Precondition (hard gate):** 1.1 merged AND running in the dogfood container — verify with `docker exec docwright-docwright-1 grep -c opencodeHeaders /app/src/webui/src/lib/server/opencode-complete.ts` ≥ 1. Then set `OPENCODE_SERVER_PASSWORD` on the cluster-llm opencode service, add `--cors` restricted to Web UI origins, restart, and IMMEDIATELY smoke-test one AI feature in the dogfood UI (an Improve run) before doing anything else. Update `.env.example`, `docs/docker.md`, `docs/deployment.md` (names only). Verify: `curl -s -o /dev/null -w '%{http_code}' http://localhost:4096/session` → 401; with `-u opencode:$OPENCODE_SERVER_PASSWORD` → 200; record both in the PR. Rollback: unset env + restart (documented in PR). | ⏳ Pending |
| 1.3 | Regression across all AI features | With auth live, exercise review, improve, chat, synthesize, executor once each against the dogfood instance; run full `npm test` + `npm run test:webui`. Any feature that breaks = fix inside this step before marking Done. Resolves the hardening portion of [[issues/bug-opencode-serve-exposed-unauthenticated-on-00004096.md]] (update its status to proposal-linked with a note). | ⏳ Pending |
| 2.1 | Event-bus consumer module | New `src/webui/src/lib/server/opencode-events.ts`: single shared connection to `GET /event` (server-side fetch + stream reader, auth via `opencodeHeaders()`), parses `data:` lines to typed events, exposes `subscribe(sessionID, cb)` / `unsubscribe(sessionID, cb)`, auto-reconnect with exponential backoff 1s→30s cap **plus ±50% random jitter** (prevents thundering-herd on server restart). Observability: export `getBusStatus()` → `{connected, lastEventAt, reconnectCount, eventsReceived, eventsRelayed}`; log every reconnect with reason. No consumer yet — additive only. Unit tests parse the 2.4 fixture log covering delta/updated/step/status events + malformed-line tolerance + jitter bounds. Verify: `npm run test:webui` green. | ⏳ Pending |
| 2.2 | Session ownership registry | New `src/webui/src/lib/server/ai-sessions.ts`: `createOwnedSession({user, feature, docPath})` wraps OpenCode session creation and records `sessionID → {owner, feature, docPath, createdAt}` (in-memory Map + JSON file under `DOCWRIGHT_CACHE_DIR`); `getSession(sessionID)`, `listSessionsFor(user)`. **TTL: entries older than 24h are pruned on file load and by an hourly sweep** (prevents unbounded growth/stale leakage). Single-instance only per Constraint 8. Unit tests: ownership recorded, lookup, persistence reload, TTL pruning. Verify: `npm run test:webui` green. | ⏳ Pending |
| 2.3 | Authenticated per-session stream endpoint | New route `src/webui/src/routes/api/ai/stream/+server.ts`: `GET ?session=<id>`, requireAuth-wrapped; 403 unless `getSession(id).owner === authenticated user`; **per-user concurrent-stream cap of 5 → HTTP 429 beyond it** (releases on disconnect); relays that session's events as SSE with 15s keepalives + `X-Accel-Buffering: no`; clean unsubscribe on client disconnect (no leaked listeners — assert listener count in test). Integration test against a fake OpenCode SSE fixture server (node http server replaying 2.4 fixtures): event passthrough, 403 owner-mismatch, 429 on 6th concurrent stream, keepalive within 20s, listener cleanup after disconnect. Verify: `npm test` integration suite green. | ⏳ Pending |
| 2.4 | Canonical event fixtures | Record real `/event` output for: plain text response, reasoning-heavy response, tool-using response (BigPickle via curl; capture method documented in the fixture README). **Scrub protocol (mandatory, in this order):** (a) `grep -nE "sk-|ghp_|AKIA|Bearer |password|api[_-]?key|/home/" <fixture>` must return zero hits after scrubbing; (b) replace real usernames/hostnames/absolute paths with placeholders; (c) reviewer reads the full diff before commit and states so in the PR. Commit as `test/fixtures/opencode-events/*.jsonl` + README (capture + scrub method). Verify: fixtures load in 2.1 tests; scrub grep output (empty) pasted in PR. | ⏳ Pending |
| 3.1 | AgentActivityView renderer | New `src/webui/src/lib/AgentActivityView.svelte`: props = event stream (or store); renders in order: user prompt block, streaming reasoning block (tan, collapsible once complete), streaming answer text (token appends), step-start/finish banners, tool-call lines, busy/idle indicator, error/"connecting…" state (distinguish bus-down from generation-idle via `getBusStatus()` relayed status events). Autoscroll with user-scroll override. Fixture-playback component test: feed 2.4 fixture events sequentially with small delays, assert DOM order and progressive text growth (not all-at-once). Verify: `npm run test:webui` green. | ⏳ Pending |
| 3.2 | Migrate plan-review | Behind `LIVE_AI_REVIEW`: review flow creates owned session (2.2), sends prompts (existing POST, response ignored for display), panel renders `AgentActivityView` on `/api/ai/stream`. Remove prototype streaming code from `plan-review/+server.ts` + `PlanReviewPanel.svelte` once flag defaults ON. **E2E recipe (reuse for 3.3–3.5):** extend `test/webui/e2e-check.ts` (run: `npx tsx test/webui/e2e-check.ts`): trigger the surface, then poll the panel's `innerText` every 2s during generation; assert ≥2 mid-generation samples differ and length grows; assert final content non-empty and no console errors. Verify: e2e green with the progressive-render assertions; old unit tests updated. | ⏳ Pending |
| 3.3 | Migrate chat panel | Behind `LIVE_AI_CHAT`: chat sends via `prompt_async`, renders live from relay — full unfiltered stream (reasoning + tools visible). E2E per 3.2 recipe. Verify: e2e green. | ⏳ Pending |
| 3.4 | Migrate Improve + Synthesize | Behind `LIVE_AI_IMPROVE`: both flows render generation live via `AgentActivityView`; final apply/save behavior unchanged. E2E per 3.2 recipe, one per flow. Verify: e2e green. | ⏳ Pending |
| 3.5 | Migrate plan executor | Behind `LIVE_AI_EXECUTOR`: executor panel shows live activity stream per step. Closes proposal *Plan Executor Panel Has No Feedback During BigPickle Session* (mark consumed_by this plan). E2E per 3.2 recipe on a trivial fixture plan step. Verify: e2e green. | ⏳ Pending |
| 3.6 | Presence indicator + observability surface | Global busy/idle chip in toolbar fed by session.status events for the current user's sessions (absorbs deferred *External AI Watcher Presence Indicator* — mark consumed_by). Expose `getBusStatus()` on the vault status page (operator view: connected, lastEventAt, reconnectCount). New doc `docs/ai-live-visibility.md` (architecture + flag reference). Verify: chip visible during a generation in dogfood; status page shows live bus stats; `npm run test:webui` green. | ⏳ Pending |
| 3.7 | Flag cleanup after soak | **Precondition (hard gate):** ≥3 days of dogfood use after 3.6 with all `LIVE_AI_*` flags default-ON and zero open live-AI regression issues (check `issues/` + heatmap). Then remove flags and dead blocking-render code paths. Verify: `grep -rn "LIVE_AI_" . --exclude-dir=node_modules --exclude-dir=.git` returns zero hits (covers src, .env.example, docs, .github, container configs); full `npm test` + `npm run test:webui` + e2e suite green. | ⏳ Pending |

## Testing Plan

- [ ] Unit: auth-header helper (1.1); event parser incl. malformed lines + backoff jitter bounds (2.1); ownership registry, persistence, TTL pruning (2.2).
- [ ] Integration: `/api/ai/stream` against fake OpenCode fixture server — passthrough, 403 owner mismatch, 429 connection cap, keepalives, listener cleanup on disconnect (2.3).
- [ ] Fixture hygiene: scrub-grep empty on committed fixtures (2.4).
- [ ] Fixture playback: AgentActivityView renders recorded logs progressively and in order (3.1).
- [ ] E2E (per migrated surface 3.2–3.5, shared recipe defined in 3.2): trigger real generation, poll DOM every 2s, assert progressive rendering, correct final content, no console errors.
- [ ] Security: unauthenticated curl to :4096 → 401 (1.2); unauthenticated `/api/ai/stream` → 401; cross-user session → 403; 6th concurrent stream → 429 (2.3).
- [ ] Regression: full existing suites green after 1.3 and again at 3.7.

## Rollback Procedures

- Phases 1–2 are additive: rollback = revert the step's PR. For 1.2 specifically, unsetting `OPENCODE_SERVER_PASSWORD` + restart restores prior behavior instantly (documented in the step PR).
- Phase 3 (through 3.6): each surface's env flag OFF restores the old code path without deploy. Flags are only removed in 3.7 after the soak gate, so an env-flag escape hatch exists for the entire migration period.
- Post-3.7 rollback = revert PRs. The dogfood container hot-reloads from source; any broken state is recoverable by `git revert` + restart. No data migrations anywhere in this plan.

## Risk Assessment

- **1.2 breakage window** — closed by the hard precondition gate (1.1 verified running in the container first) + immediate smoke test + instant env rollback.
- **Shared /event consumer as single point of failure** — auto-reconnect with jittered backoff (2.1); surfaces show "connecting…" rather than erroring (3.1); operators see bus health on the status page (3.6).
- **Session registry single-instance + growth** — declared Constraint 8; 24h TTL + hourly sweep (2.2); shared store deferred to Phase 5.
- **Stream endpoint resource exhaustion** — per-user connection cap with 429 (2.3).
- **Secret leakage via committed fixtures** — mandatory scrub protocol with grep evidence in PR (2.4).
- **Proxy buffering breaks streaming** — keepalives + `X-Accel-Buffering: no` mandated (Constraint 5); progressive-render e2e assertions catch silent batching.
- **Premature flag removal** — 3.7 soak gate (≥3 days dogfood, zero open regressions).
- **Scope creep into PTY/dual-mode** — explicitly out of scope; deferred proposals remain deferred.

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-09 | Created from approved proposal | NetYeti |
| 2026-07-09 | Full plan authored: 13 steps in 3 phases, constraints inlined for small-model executors, testing/rollback/risk defined | NetYeti |
| 2026-07-09 | Multi-perspective critique (BigPickle, 10 findings, all accepted): jittered backoff + bus observability (2.1), single-instance constraint declared + TTL pruning (2.2), 1.2 precondition gate closes breakage window, per-user stream cap 429 (2.3), mandatory fixture scrub protocol (2.4), concrete e2e recipe for 3.2–3.5, repo-wide flag grep, new 3.7 soak-gated flag cleanup | NetYeti |
