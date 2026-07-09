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
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
scenario_synthesis: "Happy path: user triggers any AI feature and watches the live token/reasoning/tool stream in the panel via the authenticated relay. Failure paths: opencode serve down → panel shows 'connecting…' while the bus consumer reconnects with jittered backoff; non-owner requests a session stream → 403; 6th concurrent stream → 429; per-surface flag OFF → legacy blocking render (until 3.7). Host-service config change only in step 1.2 (password/CORS), gated on 1.1 running in the container and instantly reversible."
total_steps: 14
completed_steps: 1
gate_note: "Changed files are untestable types: plans/live-ai-visibility-event-relay.md"
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
   each PR when CI is green before starting the next (no stacking). Code work
   happens in an isolated worktree so the dogfood container (which serves the
   checked-out tree) is never disrupted mid-session. Commit format
   `feat|fix|docs|test|chore: ...`.
7. **Secrets:** credentials only via env vars; never commit values. Update
   `.env.example` with names + comments only.
8. **Single-instance assumption (declared):** the session registry (2.2) assumes
   exactly one SvelteKit server instance. Horizontal scaling requires a shared
   store — explicitly out of scope; recorded as a Phase-5 hardening item.
9. **Renderer state is snapshot-reconciled:** `message.part.delta` appends are an
   optimization; `message.part.updated` full snapshots (keyed by partID) are the
   source of truth. The renderer must converge to correct text even if every delta
   is lost. This makes reconnect gaps self-healing by design.
10. **Phase 2 execution order: 2.4 → 2.1 → 2.2 → 2.3.** Step 2.4 produces the
   fixtures that 2.1's tests consume; run it first even though it is numbered last.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1.1 | Basic-auth support in OpenCode clients | In `src/webui/src/lib/server/opencode-complete.ts` add shared helper `opencodeHeaders()` returning `Authorization: Basic base64((OPENCODE_SERVER_USERNAME| ✅ Done |"opencode")+":"+OPENCODE_SERVER_PASSWORD)` when `OPENCODE_SERVER_PASSWORD` is set (else no header); apply to every fetch there AND to all other `OPENCODE_URL` consumers found via `grep -rn "OPENCODE_URL" src/ scripts/ --include="*.ts" --include="*.js"` (list them in the PR). Unit test with stubbed global fetch asserting header present when env set, absent when not. Verify: `npm run test:webui` green. | ⏳ Pending |
| 1.2 | Enable auth + CORS on the host service | **Precondition (hard gate):** 1.1 merged AND running in the dogfood container — verify with `docker exec docwright-docwright-1 grep -c opencodeHeaders /app/src/webui/src/lib/server/opencode-complete.ts` ≥ 1. Then set `OPENCODE_SERVER_PASSWORD` on the cluster-llm opencode service, add `--cors` restricted to Web UI origins, restart, and IMMEDIATELY smoke-test one AI feature in the dogfood UI (an Improve run) before doing anything else. Update `.env.example`, `docs/docker.md`, `docs/deployment.md` (names only). Verify: `curl -s -o /dev/null -w '%{http_code}' http://localhost:4096/session` → 401; with `-u opencode:$OPENCODE_SERVER_PASSWORD` → 200; **CORS negative: `curl -s -D- -o /dev/null -H "Origin: http://evil.example" -u opencode:$PASS http://localhost:4096/session | grep -i access-control-allow-origin` → no match (foreign origin not echoed)**; record all outputs in the PR. Rollback: unset env + restart (documented in PR). | ⏳ Pending |
| 1.3 | Regression across all AI features | With auth live, exercise review, improve, chat, synthesize, executor once each against the dogfood instance; run full `npm test` + `npm run test:webui`. Any feature that breaks = fix inside this step before marking Done. Resolves the hardening portion of [[issues/bug-opencode-serve-exposed-unauthenticated-on-00004096.md]] (update its status to proposal-linked with a note). | ⏳ Pending |
| 2.1 | Event-bus consumer module | **Prereq: 2.4 fixtures exist (Constraint 10).** New `src/webui/src/lib/server/opencode-events.ts`: single shared connection to `GET /event` (server-side fetch + stream reader, auth via `opencodeHeaders()`), parses `data:` lines to typed events, exposes `subscribe(sessionID, cb)` / `unsubscribe(sessionID, cb)`, auto-reconnect with exponential backoff 1s→30s cap **plus ±50% random jitter**. **Cache the singleton on `globalThis` (e.g. `globalThis.__dwOpencodeBus ??= create()`) — SvelteKit dev HMR re-evaluates modules and without this guard dev mode opens duplicate bus connections and delivers doubled events.** On reconnect, existing subscriptions remain attached and receive subsequent events; emit a synthetic `bus-gap` event to all subscribers so downstreams know deltas may have been missed (renderer self-heals per Constraint 9). Observability: export `getBusStatus()` → `{connected, lastEventAt, reconnectCount, eventsReceived, eventsRelayed}`; log every reconnect with reason. No consumer yet — additive only. Unit tests: fixture parsing (delta/updated/step/status), malformed-line tolerance, jitter bounds. **Integration test: fake OpenCode server killed and restarted mid-stream → consumer reconnects, subscriber receives post-restart events plus one bus-gap event, and the fake server received the Authorization header on both connections.** Verify: `npm run test:webui` + integration suite green. | ⏳ Pending |
| 2.2 | Session ownership registry | New `src/webui/src/lib/server/ai-sessions.ts`: `createOwnedSession({user, feature, docPath})` wraps OpenCode session creation and records `sessionID → {owner, feature, docPath, createdAt}` (in-memory Map + JSON file under `DOCWRIGHT_CACHE_DIR`); `getSession(sessionID)`, `listSessionsFor(user)`. **TTL: entries older than 24h are pruned on file load and by an hourly sweep** (prevents unbounded growth/stale leakage). Single-instance only per Constraint 8; `globalThis` guard per 2.1. Unit tests: ownership recorded, lookup, persistence reload, TTL pruning. Verify: `npm run test:webui` green. | ⏳ Pending |
| 2.3 | Authenticated per-session stream endpoint | New route `src/webui/src/routes/api/ai/stream/+server.ts`: `GET ?session=<id>`, requireAuth-wrapped; 403 unless `getSession(id).owner === authenticated user`; **per-user concurrent-stream cap of 5 → HTTP 429 beyond it** (releases on disconnect); relays that session's events as SSE with 15s keepalives + `X-Accel-Buffering: no`; clean unsubscribe on client disconnect (no leaked listeners — assert listener count in test). Integration tests against the fake OpenCode SSE fixture server: event passthrough; **two interleaved sessions generating concurrently → each subscriber receives exactly its own session's events (no cross-bleed, order preserved per session)**; 403 owner-mismatch; 429 on 6th concurrent stream; keepalive within 20s; listener cleanup after disconnect. Verify: `npm test` integration suite green. | ⏳ Pending |
| 2.4 | Canonical event fixtures | **Run FIRST in Phase 2 (Constraint 10).** Record real `/event` output for: plain text response, reasoning-heavy response, tool-using response (BigPickle via curl; capture method documented in the fixture README). **Scrub protocol (mandatory, in this order):** (a) `grep -nE "sk-|ghp_|AKIA|Bearer |password|api[_-]?key|/home/" <fixture>` must return zero hits after scrubbing; (b) replace real usernames/hostnames/absolute paths with placeholders; (c) reviewer reads the full diff before commit and states so in the PR. Commit as `test/fixtures/opencode-events/*.jsonl` + README (capture + scrub method). **Also produce a derived `*-lossy.jsonl` variant of the plain-text fixture with 50% of part.delta events removed (part.updated retained) for the 3.1 self-heal test.** Verify: fixtures load in 2.1 tests; scrub grep output (empty) pasted in PR. | ⏳ Pending |
| 3.1 | AgentActivityView renderer | New `src/webui/src/lib/AgentActivityView.svelte`: props = event stream (or store); renders in order: user prompt block, streaming reasoning block (tan, collapsible once complete), streaming answer text, step-start/finish banners, tool-call lines, busy/idle indicator, error/"connecting…" state (distinguish bus-down from generation-idle via relayed bus status/bus-gap events). **State model per Constraint 9: parts keyed by partID; delta events append, part.updated events replace the whole part — snapshots win.** Autoscroll with user-scroll override. Component tests: (a) fixture playback with small delays → DOM order correct, text grows progressively (not all-at-once); (b) **lossy fixture (2.4) → final rendered text byte-identical to the lossless run** (self-healing proven); (c) bus-gap event mid-stream → transient indicator shown, then convergence. Verify: `npm run test:webui` green. | ⏳ Pending |
| 3.2 | Migrate plan-review | Behind `LIVE_AI_REVIEW`: review flow creates ONE owned session for the whole review (2.2) and sends its prompts sequentially into it (existing POST, response ignored for display) so the user watches a single coherent narrative; panel renders `AgentActivityView` on `/api/ai/stream`. Remove prototype streaming code from `plan-review/+server.ts` + `PlanReviewPanel.svelte` once flag defaults ON. **E2E recipe (reuse for 3.3–3.5):** extend `test/webui/e2e-check.ts` (run: `npx tsx test/webui/e2e-check.ts`): trigger the surface, then poll the panel's `innerText` every 2s during generation; assert ≥2 mid-generation samples differ and length grows; assert final content non-empty and no console errors. Verify: e2e green with the progressive-render assertions; old unit tests updated. | ⏳ Pending |
| 3.3 | Migrate chat panel | Behind `LIVE_AI_CHAT`: chat sends via `prompt_async` (**verified available on our 1.17.x: HTTP 204, probe 2026-07-09**), renders live from relay — full unfiltered stream (reasoning + tools visible). E2E per 3.2 recipe, **plus failure path: stub `prompt_async` to return 500 → panel shows an explicit error state within 5s (not indefinite "connecting…")**. Verify: e2e green. | ⏳ Pending |
| 3.4 | Migrate Improve + Synthesize | Behind `LIVE_AI_IMPROVE`: both flows render generation live via `AgentActivityView`; final apply/save behavior unchanged. E2E per 3.2 recipe, one per flow. Verify: e2e green. | ⏳ Pending |
| 3.5 | Migrate plan executor | Behind `LIVE_AI_EXECUTOR`: executor panel shows live activity stream per step. Closes proposal *Plan Executor Panel Has No Feedback During BigPickle Session* (mark consumed_by this plan). E2E per 3.2 recipe on a trivial fixture plan step. Verify: e2e green. | ⏳ Pending |
| 3.6 | Presence indicator + observability surface | Global busy/idle chip in toolbar fed by session.status events for the current user's sessions (absorbs deferred *External AI Watcher Presence Indicator* — mark consumed_by). Expose `getBusStatus()` on the vault status page (operator view: connected, lastEventAt, reconnectCount). New doc `docs/ai-live-visibility.md` (architecture + flag reference). Verify: chip visible during a generation in dogfood; status page shows live bus stats; `npm run test:webui` green. | ⏳ Pending |
| 3.7 | Flag cleanup after soak | **Precondition (hard gate):** ≥3 days of dogfood use after 3.6 with all `LIVE_AI_*` flags default-ON and zero open live-AI regression issues (check `issues/` + heatmap). Then remove flags and dead blocking-render code paths. Verify: `grep -rn "LIVE_AI_" . --exclude-dir=node_modules --exclude-dir=.git` returns zero hits (covers src, .env.example, docs, .github, container configs); full `npm test` + `npm run test:webui` + e2e suite green. | ⏳ Pending |

## Testing Plan

- [ ] Unit: auth-header helper (1.1); event parser incl. malformed lines + backoff jitter bounds (2.1); ownership registry, persistence, TTL pruning (2.2).
- [ ] Integration — failure recovery: fake OpenCode server killed/restarted mid-stream → consumer reconnects with auth, subscribers survive, bus-gap emitted (2.1).
- [ ] Integration — stream endpoint: passthrough; concurrent interleaved sessions route with no cross-bleed; 403 owner mismatch; 429 connection cap; keepalives; listener cleanup on disconnect (2.3).
- [ ] Fixture hygiene: scrub-grep empty on committed fixtures; lossy variant generated (2.4).
- [ ] Renderer: fixture playback progressive + ordered; **lossy-fixture self-heal → final text identical to lossless**; bus-gap indicator convergence (3.1).
- [ ] E2E (per migrated surface 3.2–3.5, shared recipe in 3.2): trigger real generation, poll DOM every 2s, assert progressive rendering, correct final content, no console errors; prompt_async failure → visible error state (3.3).
- [ ] Security: unauthenticated :4096 → 401 and foreign-Origin CORS rejected (1.2); unauthenticated `/api/ai/stream` → 401; cross-user session → 403; 6th concurrent stream → 429 (2.3).
- [ ] Regression: full existing suites green after 1.3 and again at 3.7.

**Consciously excluded (decisions, not omissions):** load/perf benchmarks and
multi-instance scaling (out of scope per Constraint 8; single-digit dogfood users;
connection cap covers abuse); full event-parser fuzzing (malformed-line tolerance
suffices at this maturity); penetration testing beyond the 401/403/429/CORS checks
(the architecture removes the browser-reachable surface entirely).

## Rollback Procedures

- Phases 1–2 are additive: rollback = revert the step's PR. For 1.2 specifically, unsetting `OPENCODE_SERVER_PASSWORD` + restart restores prior behavior instantly (documented in the step PR).
- Phase 3 (through 3.6): each surface's env flag OFF restores the old code path without deploy. Flags are only removed in 3.7 after the soak gate, so an env-flag escape hatch exists for the entire migration period.
- Post-3.7 rollback = revert PRs. The dogfood container hot-reloads from source; any broken state is recoverable by `git revert` + restart. No data migrations anywhere in this plan.

## Risk Assessment

- **1.2 breakage window** — closed by the hard precondition gate (1.1 verified running in the container first) + immediate smoke test + instant env rollback.
- **Shared /event consumer as single point of failure** — auto-reconnect with jittered backoff and subscriber survival tested under server restart (2.1); renderer self-heals missed deltas via snapshot reconciliation (Constraint 9, proven by lossy-fixture test 3.1); operators see bus health on the status page (3.6).
- **Session registry single-instance + growth** — declared Constraint 8; 24h TTL + hourly sweep (2.2); shared store deferred to Phase 5.
- **Stream endpoint resource exhaustion** — per-user connection cap with 429 (2.3).
- **Cross-user data exposure** — ownership 403 plus interleaved-session routing test (2.3).
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
| 2026-07-09 | Test-completeness self-review on BDFL challenge, 5 gaps closed: bus reconnect recovery test + bus-gap event (2.1), snapshot-reconciliation self-heal design (Constraint 9) with lossy-fixture proof (2.4/3.1), interleaved-session no-cross-bleed test (2.3), CORS negative check (1.2), prompt_async failure-path e2e (3.3). Consciously-excluded list added to Testing Plan | NetYeti |
| 2026-07-09 | Final pre-execution sweep: prompt_async verified live on our 1.17.x (HTTP 204); Constraint 10 fixes Phase-2 ordering (2.4 before 2.1); globalThis HMR guard mandated for singletons (2.1/2.2); worktree isolation added to Constraint 6 so code branches never disrupt the running dogfood container; 3.2 pinned to one-session-sequential review narrative | NetYeti |
| 2026-07-09 | Step 1.1 done (PR #268, squash 9c26a37): opencodeHeaders() in src/dispatch/opencode-auth.ts wired into all 11 OPENCODE_URL consumers; proxy route unified (was empty-username, module-load env); ChatPanel default direct→proxy per Constraint 1. 395 dispatch + 98 webui tests green, lint/tsc clean | NetYeti |
| 2026-07-09 | Step 1.1 correction (PR #269, 84d8283): two import depths from #268 were wrong ([...path] route, opencode-model) — webui production build broke on main, undetected because CI never runs vite build. Hotfixed on main + in the main→dogfood merge (8035488). CI-gap bug filed: issues/bug-ci-gap-webui-production-build-vite-build-never-exe.md. Step 1.2 precondition gate PASSED: opencodeHeaders confirmed live in dogfood container (docker exec grep = 5) | NetYeti |
| 2026-07-09 | Step 1.2 ops executed: PR #270 merged (launcher --oc-only + auth status line, compose passthrough, docs) and synced to dogfood; password generated into gitignored src/webui/.env + root .env; opencode serve restarted with auth + CORS (pid 3151243). Verified: unauth 401 / auth 200 / foreign Origin not echoed / allowed origin echoed; container recreated with password env, container→opencode 401-then-200 proven via node fetch. Incident during recreate: published port silently reverted 5174→5173 (original PORT was ephemeral shell env, never persisted) — proxy target broke briefly; fixed durably with PORT=5174 in root .env. Also quoted a malformed unquoted LOCAL_AUTH_DISPLAY_NAME in src/webui/.env that broke shell sourcing. Awaiting BDFL UI smoke test (Improve run) to mark step done | NetYeti |
