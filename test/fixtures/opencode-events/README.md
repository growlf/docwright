# OpenCode `/event` fixtures

Canonical recordings of OpenCode's global SSE event bus (`GET /event`) for one
prompt each, used by the **Live AI Visibility** relay tests. Produced by plan
[`live-ai-visibility-event-relay.md`](../../../plans/live-ai-visibility-event-relay.md)
**step 2.4** (run first in Phase 2 per Constraint 10 — 2.1's parser tests consume
these files).

Each `.jsonl` file is one JSON event per line, in bus order, filtered to a single
session. Captured 2026-07-09 against OpenCode v1.17.x running model
`opencode/big-pickle`.

## The files

| File | Events | What it exercises |
| --- | --- | --- |
| `plain-text.jsonl` | 57 | Short text answer. `text` + `reasoning` parts, one step, 34 text deltas. The baseline. |
| `plain-text-lossy.jsonl` | 40 | Derived from `plain-text.jsonl` with **50% of `message.part.delta` events dropped**, every `message.part.updated` snapshot retained. Feeds the step 3.1 self-heal test. |
| `reasoning.jsonl` | 300 | Long chain-of-thought answer (bat-and-ball problem). 488-char reasoning part, 277 text deltas. Stresses high-volume delta streaming. |
| `tool-use.jsonl` | 107 | Multi-step agent loop: `glob` + `read` tool calls with full `pending → running → completed` state transitions, 2 step-start/step-finish pairs, 4 reasoning parts, 66 deltas. |

## Critical finding — use `prompt_async`, not the blocking `/message`

Verified 2026-07-09 while capturing these fixtures:

- **`POST /session/:id/message`** (blocking) returns the finished `{info, parts}`
  but emits **nothing** to the `/event` bus — only `server.connected` is observed.
  This is exactly why the old blocking-POST UI could never show live activity.
- **`POST /session/:id/prompt_async`** (returns **HTTP 204** immediately) emits the
  full live stream on the bus.
- The `/event` subscription is **directory-scoped**: subscribe to
  `GET /event?directory=<vault>` to receive a session's events.

The step 2.1 consumer and the step 3.x surface migrations must generate via
`prompt_async` and read the bus — never the blocking endpoint — to get live output.

## Event vocabulary (provider-agnostic — Constraint 4)

All events are `{ "type": <string>, "properties": { "sessionID": "ses_…", … } }`.

| Type | Meaning | Key fields |
| --- | --- | --- |
| `session.updated` | Session metadata snapshot | `properties.info` (`id`, `slug`, `directory`, `path`, `time`) |
| `session.status` | Busy/idle transition | `properties.status.type` = `busy` \| `idle` |
| `session.diff` | Working-tree diff for the turn | `properties.diff` (array; empty for read-only) |
| `session.idle` | **Turn complete** — capture terminates here | `sessionID` only |
| `message.updated` | Message metadata snapshot | `properties.info` (`id`, `role`, `time`) |
| `message.part.updated` | **Full part snapshot (source of truth, Constraint 9)** | `properties.part` (`id`, `type`, and `text`/`state`) |
| `message.part.delta` | Token delta (append optimization) | `properties.partID`, `field` (`text`), `delta` |

`message.part.updated` part `type` is one of: `text`, `reasoning`, `step-start`,
`step-finish`, `tool` (tool parts carry `tool` name + `state.status`
`pending`/`running`/`completed`).

Sample delta:
```json
{"type":"message.part.delta","properties":{"sessionID":"ses_…","messageID":"msg_…","partID":"prt_…","field":"text","delta":"The"}}
```

**Snapshot reconciliation (Constraint 9):** deltas are an optimization; the last
`message.part.updated` for a given `partID` is authoritative. Reconstructing text
from snapshots alone (ignoring every delta) yields the correct final text — which
is what `plain-text-lossy.jsonl` proves and step 3.1 asserts.

Note: `ses_…`, `msg_…`, `prt_…` IDs are ephemeral, randomly generated per session,
and carry no secret — they are kept intact so the parser/renderer tests see
realistic keying.

## How these were captured

`capture.mjs` subscribes to `GET /event?directory=<dir>`, creates a session, fires
one prompt via `prompt_async`, and records every event referencing that session
until `session.idle`.

```bash
# password lives only in the gitignored src/webui/.env (never commit the value)
export OPENCODE_SERVER_PASSWORD=$(grep '^OPENCODE_SERVER_PASSWORD=' src/webui/.env | cut -d= -f2- | tr -d '"'"'"'')
SCRATCH=/path/to/throwaway-workspace   # a scratch dir with a few .md files

node test/fixtures/opencode-events/capture.mjs plain-text.jsonl "$SCRATCH" \
  "Reply with exactly one short sentence greeting a new teammate. Do not use any tools."

node test/fixtures/opencode-events/capture.mjs reasoning.jsonl "$SCRATCH" \
  "Think carefully step by step, then answer. A bat and a ball cost 1.10 total. The bat costs 1.00 more than the ball. How much is the ball? Show your reasoning, then give the final answer. Do not use any tools."

# tool-use runs the agent loop (multiple round-trips) — allow more time
OPENCODE_CAPTURE_TIMEOUT=240000 node test/fixtures/opencode-events/capture.mjs tool-use.jsonl "$SCRATCH" \
  "Use your tools to list the files in the current directory, then tell me how many markdown (.md) files there are. Read only — do not create, edit, or delete anything."
```

Point the capture at a **throwaway scratch workspace**, never a real vault, so tool
output can't echo real content.

### Regenerating the lossy variant

```bash
node test/fixtures/opencode-events/make-lossy.mjs \
  test/fixtures/opencode-events/plain-text.jsonl \
  test/fixtures/opencode-events/plain-text-lossy.jsonl
```
Deterministic (drops every other delta, no RNG) so it is reproducible and reviewable.

## Scrub protocol (mandatory — step 2.4, run in this order)

Raw captures are **unscrubbed** — they contain the absolute workspace path. Before
committing any fixture:

**(a)** The mandated secret grep must return **zero** hits:
```bash
grep -nE "sk-|ghp_|AKIA|Bearer |password|api[_-]?key|/home/" test/fixtures/opencode-events/*.jsonl
```

**(b)** Replace real usernames / hostnames / absolute paths with placeholders. The
workspace path appears in two forms — with a leading slash (`session.updated.info.directory`)
and without (`session.updated.info.path`). Both were replaced with `/workspace` and
`workspace` respectively. Verify no identifier survives:
```bash
grep -nE "gemini|cluster-llm|<your-host>|/home/|claude-1001" test/fixtures/opencode-events/*.jsonl   # expect zero
```

**(c)** A reviewer reads the full fixture diff before commit and states so in the PR.

For this commit: **(a)** returned zero hits; **(b)** the scratch path
(`/tmp/…/oc-capture`, both slash forms) was replaced with `/workspace`, eliminating
the embedded username; a broad token sweep (`sk-…`, `xoxb-`, JWT, PEM) found nothing.
Ephemeral `ses_/msg_/prt_` IDs and the random session slug are intentionally retained.
