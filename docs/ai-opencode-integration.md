# DocWright ⇄ OpenCode integration

How DocWright talks to an OpenCode server (`opencode serve`), why the
integration moved from blocking request/response to an authenticated event
relay, and the reusable pattern for any app interfacing with OpenCode.

Verified against **OpenCode v1.17.x**. Last updated 2026-07-10.

---

## TL;DR

- **Generate with `prompt_async`, not the blocking `/message`.** Only
  `prompt_async` emits a live event stream; the blocking `/message` returns the
  finished result and emits nothing incremental.
- **The `/event` bus is directory-scoped.** Subscribe to
  `GET /event?directory=<vault>` — a bare `GET /event` receives no session events.
- **Consume events with snapshot reconciliation.** `message.part.updated`
  snapshots are the source of truth; `message.part.delta` are a streaming
  optimization. Dropping every delta still converges to correct text.
- **Never expose `:4096` to browsers.** All traffic flows through an
  authenticated backend that injects HTTP Basic auth; restrict CORS to your UI.

---

## Before: blocking request/response

DocWright called OpenCode through one helper, `opencodeComplete()`:

1. `POST /session?directory=<vault>` → `{ id }` (short-lived session).
2. `POST /session/:id/message?directory=<vault>` — **blocking**; resolves only
   after generation completes, returning the full `{ info, parts }`.
3. Extract text parts → return string.

Each feature fired one or more of these (plan-review made several, often in
parallel — one per step/section/overview). Problems:

- **No live visibility.** `/message` returns *after* the model finishes, with no
  incremental output. The UI could only show finished blocks — no token-by-token
  thinking, no tool activity.
- **Originally unauthenticated.** `opencode serve` ran on `0.0.0.0:4096` with no
  auth — an agent server with shell/file access reachable on the LAN. Closed.

## Two discoveries that drove the redesign

1. **`prompt_async` streams; `/message` does not.** The blocking
   `POST /session/:id/message` emits **nothing** to the event bus (only
   `server.connected` is observed). The non-blocking
   **`POST /session/:id/prompt_async`** (returns **HTTP 204** immediately) emits
   the full live stream. If you want live output, generate via `prompt_async` and
   read the bus.
2. **`/event` is directory-scoped.** `GET /event` bare yields **zero** session
   events. You must subscribe to **`GET /event?directory=<vault>`**; one scoped
   connection catches every session created with that same `directory`.

## After: authenticated event relay

Generation (send) and observation (receive) are **separate paths**:

```
                        ┌─ POST /api/…  ─▶ DocWright server ─ prompt_async (Basic auth) ─▶ opencode :4096
Browser (authenticated) ┤                                                                        │ emits events
                        └─ GET /api/ai/stream (authed SSE) ◀─ relay ◀─ bus consumer ◀─ GET /event?directory= (Basic auth)
```

DocWright's implementation (surface-agnostic server modules + one route):

| Layer | File | Role |
|---|---|---|
| Bus consumer | `src/webui/src/lib/server/opencode-events.ts` | ONE shared, auto-reconnecting subscription to `GET /event?directory=<vault>`; parses SSE; fans out to per-`sessionID` subscribers. Exponential backoff with ±50% jitter; emits a synthetic `bus-gap` event on reconnect; `getBusStatus()` for observability. Cached on `globalThis` (dev-HMR guard). |
| Ownership registry | `src/webui/src/lib/server/ai-sessions.ts` | `createOwnedSession({user,feature,docPath})` wraps session creation and records `sessionID → {owner,feature,docPath,createdAt}` (in-memory + JSON mirror); 24h TTL. Single-process. |
| Relay endpoint | `src/webui/src/routes/api/ai/stream/+server.ts` | Browser-facing SSE. `requireAuth`; **403** unless `session.owner === user`; per-user **5-stream cap → 429**; relays only that session's events; 15s keepalives + `X-Accel-Buffering: no`; unsubscribes + frees the slot on client disconnect. |
| Renderer | `src/webui/src/lib/AgentActivityView.svelte` + `agent-activity-model.ts` | Reduces the relayed event stream into an ordered render tree (prompt / reasoning / answer / step banners / tool lines) + connection status. |

## Event vocabulary (provider-agnostic)

Every event is `{ "type": string, "properties": { "sessionID": "ses_…", … } }`.

| Type | Meaning | Key fields |
|---|---|---|
| `session.updated` | Session metadata snapshot | `properties.info` (`id`, `slug`, `directory`, `path`) |
| `session.status` | Busy/idle transition | `properties.status.type` = `busy` \| `idle` |
| `session.diff` | Working-tree diff for the turn | `properties.diff` (array) |
| `session.idle` | **Turn complete** | `sessionID` only |
| `message.updated` | Message metadata | `properties.info` (`id`, `role`, `time`) |
| `message.part.updated` | **Full part snapshot (source of truth)** | `properties.part` (`id`, `type`, `text`/`state`) |
| `message.part.delta` | Token delta (append) | `properties.partID`, `field` (`text`), `delta` |

Part `type` ∈ `text`, `reasoning`, `step-start`, `step-finish`, `tool`
(tool parts carry a `tool` name and `state.status`: `pending` → `running` →
`completed`).

Sample delta:

```json
{"type":"message.part.delta","properties":{"sessionID":"ses_…","messageID":"msg_…","partID":"prt_…","field":"text","delta":"The"}}
```

Bus-level events with no `sessionID` (`server.connected`, `server.heartbeat`) are
not per-session and are not fanned out.

## Snapshot reconciliation (the rule that makes it robust)

**Deltas append; snapshots replace; snapshots win.**

- `message.part.updated.text` is the *cumulative* text for a `partID`.
- `message.part.delta.delta` is an *increment* — an optimization for smooth
  streaming between snapshots.
- Because every part in a turn ends with a full-text snapshot, a consumer that
  **drops every delta** (e.g. a reconnect gap) still converges to byte-identical
  final text.

Consumer state model: key parts by `partID`; on a delta, append to that part's
text; on a snapshot, overwrite the part wholesale. On reconnect, surface a
transient "reconciling" indicator and let the next snapshot heal the gap.

## Security invariants

- **Browsers never contact `:4096` directly.** All calls go through an
  authenticated backend that injects the header. DocWright uses
  `opencodeHeaders()` → `Authorization: Basic base64(username:password)` from
  `OPENCODE_SERVER_PASSWORD` (username defaults to `opencode`,
  override `OPENCODE_SERVER_USERNAME`).
- **Restrict CORS.** Launch with `--cors <origin>` limited to your UI origins.
- **Multi-user:** enforce session **ownership** (403 on mismatch) and a
  **per-user concurrency cap** (429) at the relay. Ownership records carry a TTL
  to prevent stale-ownership leakage.
- Credentials live only in gitignored env files; never commit values.

## Server launch (reference)

```
opencode serve --hostname 0.0.0.0 --port 4096 \
  --cors http://localhost:5173 --cors http://<your-ui-origin>
# with OPENCODE_SERVER_PASSWORD set in the environment → HTTP Basic auth required
```

Probe: unauthenticated `GET /session` → **401**; with
`-u opencode:$OPENCODE_SERVER_PASSWORD` → **200**.

## HTTP cheat sheet (for any app talking to OpenCode)

| Purpose | Call |
|---|---|
| Create session | `POST /session?directory=<dir>` → `{ id }` |
| **Generate (streaming)** | `POST /session/:id/prompt_async?directory=<dir>` body `{ parts:[{type:'text',text}] }` → **204** |
| Generate (blocking, no stream) | `POST /session/:id/message?directory=<dir>` → full `{ info, parts }` |
| **Observe events** | `GET /event?directory=<dir>` (SSE) — filter by `properties.sessionID` |
| Current model / config | `GET /config`, `GET /config/providers` |
| Auth (every call) | header `Authorization: Basic base64(user:pass)` |

### Recipes

**Watch one generation live:**

1. `POST /session?directory=<dir>` → `id`.
2. Open `GET /event?directory=<dir>` (keep it open); filter events where
   `properties.sessionID === id`.
3. `POST /session/:id/prompt_async?directory=<dir>` with the prompt.
4. Render via snapshot reconciliation until `session.idle`.

**Coherent multi-turn narrative in one session:** send prompts **sequentially**,
awaiting `session.idle` between each, so turns don't interleave.

**Avoid missing the first tokens:** subscribe to `/event` *before* sending the
first `prompt_async` (a subscribe-then-start handshake). Snapshot reconciliation
still heals anything missed, but early deltas give the best live feel.

---

*See also: `plans/live-ai-visibility-event-relay.md` (the plan that built this),
and the reference fixtures + capture tooling under
`test/fixtures/opencode-events/`.*
