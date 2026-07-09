#!/usr/bin/env node
/**
 * capture.mjs — record OpenCode's global GET /event stream for one prompt.
 *
 * Subscribes to the SSE bus (directory-scoped), creates a session, fires one
 * prompt via the NON-blocking POST /session/:id/prompt_async (HTTP 204), and
 * records every bus event that references that session — one JSON object per
 * line (.jsonl) — until `session.idle`. Used to produce the canonical fixtures
 * consumed by the step 2.1 event-parser tests (plan
 * live-ai-visibility-event-relay, step 2.4).
 *
 * WHY prompt_async, not the blocking /message: verified 2026-07-09 — the
 * blocking POST /session/:id/message returns the finished {info,parts} but
 * emits NOTHING to the /event bus (only server.connected is seen). prompt_async
 * emits the full live stream: session.created/updated, message.updated,
 * message.part.updated (snapshots), message.part.delta (token deltas),
 * session.status, session.diff, session.idle. This is the whole reason the
 * live-visibility relay exists.
 *
 * Usage:
 *   OPENCODE_SERVER_PASSWORD=… node capture.mjs <out.jsonl> <directory> "<prompt>"
 *
 * Env:
 *   OPENCODE_URL              default http://localhost:4096
 *   OPENCODE_SERVER_PASSWORD  basic-auth password (server rejects 401 without)
 *   OPENCODE_SERVER_USERNAME  default "opencode"
 *   OPENCODE_CAPTURE_MODEL    default "opencode/big-pickle"
 *   OPENCODE_CAPTURE_TIMEOUT  max ms to wait for session.idle (default 120000)
 *
 * NOTE: raw output is UNSCRUBBED — it may contain the vault directory path and,
 * for tool-using runs, file listings. Always run the scrub protocol (see
 * README.md) before committing.
 */

const BASE = process.env.OPENCODE_URL || 'http://localhost:4096';
const PW = process.env.OPENCODE_SERVER_PASSWORD;
const USER = process.env.OPENCODE_SERVER_USERNAME || 'opencode';
const MODEL_STR = process.env.OPENCODE_CAPTURE_MODEL || 'opencode/big-pickle';
const TIMEOUT_MS = Number(process.env.OPENCODE_CAPTURE_TIMEOUT || 120000);

const [outFile, directory, prompt] = process.argv.slice(2);
if (!outFile || !directory || !prompt) {
  console.error('usage: node capture.mjs <out.jsonl> <directory> "<prompt>"');
  process.exit(2);
}

const auth = PW
  ? { Authorization: 'Basic ' + Buffer.from(`${USER}:${PW}`).toString('base64') }
  : {};
const slash = MODEL_STR.indexOf('/');
const model = slash >= 0
  ? { providerID: MODEL_STR.slice(0, slash), id: MODEL_STR.slice(slash + 1) }
  : { providerID: 'opencode', id: MODEL_STR };
const DIR = `directory=${encodeURIComponent(directory)}`;

const events = [];
let sessionID = null;
let sawText = false;
let sawIdle = false;

const ac = new AbortController();

// --- 1. open the event bus (directory-scoped) ---
const evResp = await fetch(`${BASE}/event?${DIR}`, { headers: { ...auth }, signal: ac.signal });
if (!evResp.ok) {
  console.error(`event stream failed: HTTP ${evResp.status}`);
  process.exit(1);
}

const reader = evResp.body.getReader();
const decoder = new TextDecoder();
let buf = '';

const pump = (async () => {
  while (true) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch {
      break; // aborted
    }
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json) continue;
      let evt;
      try {
        evt = JSON.parse(json);
      } catch {
        continue;
      }
      // Record only events that reference our session (the bus is global).
      if (sessionID && JSON.stringify(evt).includes(sessionID)) {
        events.push(evt);
        if (evt.type === 'message.part.updated' || evt.type === 'message.part.delta') {
          const p = evt.properties?.part ?? evt.properties;
          if (p?.type === 'text' && (p?.text || evt.properties?.delta)) sawText = true;
        }
        if (evt.type === 'session.idle') sawIdle = true;
      }
    }
  }
})();

// give the bus a moment to connect before creating the session
await new Promise((r) => setTimeout(r, 500));

// --- 2. create the session ---
const sess = await fetch(`${BASE}/session?${DIR}`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model }),
}).then((r) => r.json());
sessionID = sess?.id ?? sess?.sessionID;
if (!sessionID) {
  console.error('no session id from create:', JSON.stringify(sess).slice(0, 200));
  process.exit(1);
}
console.error(`session: ${sessionID}`);

// --- 3. fire the prompt (non-blocking; HTTP 204, events flow on the bus) ---
const msgRes = await fetch(`${BASE}/session/${sessionID}/prompt_async?${DIR}`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] }),
});
if (!msgRes.ok) {
  console.error(`prompt_async failed: HTTP ${msgRes.status} ${await msgRes.text().catch(() => '')}`);
  process.exit(1);
}

// --- 4. wait until session.idle (or timeout), then let trailing events land ---
const start = Date.now();
while (!sawIdle && Date.now() - start < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, 250));
}
if (!sawIdle) console.error(`WARNING: timed out after ${TIMEOUT_MS}ms without session.idle`);
await new Promise((r) => setTimeout(r, 750));
ac.abort();
await pump.catch(() => {});

const fs = await import('node:fs');
fs.writeFileSync(outFile, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
const types = events.reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {});
console.error(`wrote ${events.length} events → ${outFile}`);
console.error('types:', JSON.stringify(types));
console.error('sawText:', sawText);
process.exit(0);
