# Live AI visibility

How DocWright shows the AI working **live** — token-by-token reasoning, tool
activity, and streamed answers — across its AI surfaces, and the flags that
control it. Built by plan
[`plans/live-ai-visibility-event-relay.md`](../plans/live-ai-visibility-event-relay.md).

For the underlying OpenCode integration (why `prompt_async` streams and the
blocking `/message` doesn't, the directory-scoped `/event` bus, auth), see
[`ai-opencode-integration.md`](./ai-opencode-integration.md).

## Architecture — the authenticated event relay

```
Browser ── authed SSE ──▶ /api/ai/stream ──subscribe(sessionID)──▶ bus consumer
  │  (AgentActivityView)                                              │ one GET /event?directory= (Basic auth)
  │                                                                    ▼
  └── POST /api/<surface> ──▶ DocWright server ── prompt_async ──▶ opencode :4096
```

| Layer | Module | Role |
|---|---|---|
| Bus consumer | `src/webui/src/lib/server/opencode-events.ts` | ONE shared, auto-reconnecting subscription to `GET /event?directory=<vault>`; fans out to per-session subscribers; `subscribeAll` global tap; `getBusStatus()`. |
| Ownership registry | `src/webui/src/lib/server/ai-sessions.ts` | `createOwnedSession({user,feature,docPath})` → records `sessionID → owner`; 24h TTL. |
| Relay endpoint | `src/webui/src/routes/api/ai/stream/+server.ts` | Browser-facing SSE; `requireAuth`; 403 unless owner; per-user 5-stream cap → 429; 15s keepalives. |
| Renderer | `src/webui/src/lib/AgentActivityView.svelte` + `agent-activity-model.ts` | Ordered render tree (prompt / reasoning / answer / step banners / tool lines) + status. |
| Presence | `ai-presence.ts` + `routes/api/ai/presence` | Per-user busy/idle signal (bus tap filtered to the user's owned sessions) → toolbar chip. |

**Generation is always via `prompt_async`** (events flow on the bus); the browser
renders from the relay, never by talking to `:4096` directly.

## Snapshot reconciliation (self-healing)

`message.part.delta` events **append** text; `message.part.updated` snapshots
**replace** it — snapshots win. Because every part ends with a full-text
snapshot, a stream that drops deltas (a reconnect gap) still converges to correct
text. On reconnect the relay emits one synthetic `bus-gap` event; the renderer
shows a transient "reconciling" note and heals on the next snapshot.

## Surfaces & flags

Each surface is gated by a per-surface env flag. All **default ON** (after their
e2e); set the flag to `0`/`false`/`off`/`no` to instantly restore the legacy path
without a deploy. Flags + dead legacy code are removed after a soak (plan 3.7).

| Surface | Flag | Behavior when ON |
|---|---|---|
| Plan review | `LIVE_AI_REVIEW` | One owned session; per-step/section/overview prompts sent sequentially; live narrative in `AgentActivityView`. |
| Proposal improve | `LIVE_AI_IMPROVE` | Improve + critique turns streamed live; result extracted for the unchanged Apply step. |
| Perspective synthesize | `LIVE_AI_IMPROVE` (shared) | Client opt-in (`SynthesisPanel`); single-turn streamed live. `VoteSummary` stays legacy. |
| Plan executor | `LIVE_AI_EXECUTOR` | Each step runs in an owned session streamed live per step; control flow (retries/timeout/markers/WAITING) unchanged. |
| Chat | `LIVE_AI_CHAT` | *(planned — send-path swap)* |

Example — disable live review, keep the rest:

```
LIVE_AI_REVIEW=0
```

## Observability

- **Toolbar presence chip** (footer): green "AI idle" / pulsing blue "AI working…"
  with a count of the current user's active sessions. Fed by `GET /api/ai/presence`.
- **Vault status page** shows an "AI bus" chip from `GET /api/ai/bus-status`
  (`getBusStatus()`): `connected`, `reconnectCount`, `eventsReceived`,
  `eventsRelayed`, `lastEventAt`.

## Security invariants

- Browsers never contact `:4096`; all traffic goes through the authenticated
  relay (`opencodeHeaders()` Basic auth).
- Per-session **ownership** (403) and a per-user **concurrency cap** (429).
- The executor writes files — its e2e runs against a throwaway **sandbox vault**,
  never the real repo.

## Rollback

Per-surface: set the flag to `0` and the legacy path returns with no deploy.
Whole plan: revert the step PRs (all additive; no data migrations).
