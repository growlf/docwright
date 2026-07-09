/**
 * opencode-events — one shared, auto-reconnecting subscription to OpenCode's
 * SSE event bus, fanned out to per-session subscribers.
 *
 * Live AI Visibility plan (live-ai-visibility-event-relay.md) step 2.1. This is
 * the backbone the authenticated per-session stream endpoint (2.3) relays from.
 * Additive only — nothing consumes it yet.
 *
 * Design notes discovered while capturing the 2.4 fixtures (verified 2026-07-09):
 *
 *   • The `/event` bus is DIRECTORY-SCOPED. A bare `GET /event` subscription
 *     receives NO session events; you must subscribe to
 *     `GET /event?directory=<vault>`. DocWright operates on a single vault
 *     (DOCWRIGHT_ROOT), so one scoped connection catches all of its sessions —
 *     still "one shared connection", just scoped. (The plan text says "GET
 *     /event"; this module refines that to the scoped form that actually works.)
 *   • Only `prompt_async` generation emits to the bus; the blocking
 *     `/message` endpoint emits nothing. That concerns the producers (3.x),
 *     not this consumer, but it is why the fixtures exist.
 *
 * Events are delivered to a subscriber when `event.properties.sessionID` matches
 * the sessionID it subscribed with. On reconnect after a drop, every subscriber
 * additionally receives one synthetic `bus-gap` event so the renderer knows
 * deltas may have been missed (it self-heals from part.updated snapshots per
 * plan Constraint 9).
 *
 * Single-instance assumption (plan Constraint 8): subscriber state is in-process.
 */

import path from 'node:path';
import { opencodeHeaders } from '../../../../dispatch/opencode-auth';

/** A generic OpenCode bus event. Provider-agnostic (plan Constraint 4). */
export interface OpencodeEvent {
  type: string;
  properties?: Record<string, unknown> & { sessionID?: string };
}

/** Synthetic event injected on reconnect so downstreams know deltas were missed. */
export const BUS_GAP = 'bus-gap';

export interface BusStatus {
  connected: boolean;
  lastEventAt: number | null;
  reconnectCount: number;
  eventsReceived: number;
  eventsRelayed: number;
}

export type EventCallback = (event: OpencodeEvent) => void;

export interface OpencodeEventBus {
  subscribe(sessionID: string, cb: EventCallback): void;
  unsubscribe(sessionID: string, cb: EventCallback): void;
  getBusStatus(): BusStatus;
  /** Number of sessions with at least one active subscriber (observability/tests). */
  subscriberCount(): number;
  /** Abort the connection and cancel any pending reconnect. For shutdown/tests. */
  stop(): void;
}

export interface BusConfig {
  /** OpenCode base URL. Defaults to OPENCODE_URL or http://localhost:4096. */
  baseUrl?: string;
  /** Vault directory the /event subscription is scoped to. */
  directory?: string;
  /** Backoff cap in ms (default 30_000). */
  maxBackoffMs?: number;
  /** Backoff base in ms — the first-retry floor before jitter (default 1000). */
  baseBackoffMs?: number;
  /** Log sink (default console). Tests inject a spy. */
  log?: (msg: string) => void;
}

/**
 * Exponential backoff with ±50% jitter.
 * base = min(cap, baseMs * 2^(attempt-1)); returns base * [0.5, 1.5).
 * `attempt` is 1-based (first retry = 1). Pure except for Math.random.
 */
export function computeBackoffMs(attempt: number, maxBackoffMs = 30_000, baseMs = 1000): number {
  const n = Math.max(1, Math.floor(attempt));
  const base = Math.min(maxBackoffMs, baseMs * 2 ** (n - 1));
  return base * (0.5 + Math.random());
}

/**
 * Parse a UTF-8 SSE text buffer into complete events plus the unparsed tail.
 * Frames are separated by a blank line ("\n\n"); the JSON payload lives on the
 * `data:` line. Comment lines (": keepalive"), non-data fields, blank frames,
 * and lines that fail to JSON-parse are skipped (malformed-line tolerance) —
 * they never throw and never advance a partial frame prematurely.
 */
export function parseSSE(buffer: string): { events: OpencodeEvent[]; remainder: string } {
  const events: OpencodeEvent[] = [];
  // Normalize CRLF so frame splitting is consistent across proxies.
  const normalized = buffer.replace(/\r\n/g, '\n');
  let rest = normalized;
  let idx: number;
  while ((idx = rest.indexOf('\n\n')) >= 0) {
    const frame = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    for (const line of frame.split('\n')) {
      if (!line.startsWith('data:')) continue; // skip comments/other fields
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
          events.push(parsed as OpencodeEvent);
        }
      } catch {
        // malformed data line — tolerate and move on
      }
    }
  }
  // If the original ended exactly on a frame boundary the remainder is "".
  return { events, remainder: rest };
}

function resolveDirectory(dir?: string): string {
  if (dir) return path.resolve(dir);
  if (process.env.DOCWRIGHT_ROOT) return path.resolve(process.env.DOCWRIGHT_ROOT);
  return process.cwd();
}

/**
 * Create an isolated event-bus instance. Production code uses the shared
 * singleton (see `subscribe`/`unsubscribe`/`getBusStatus` below); tests create
 * their own instances so they never touch global state.
 */
export function createOpencodeEventBus(config: BusConfig = {}): OpencodeEventBus {
  const baseUrl = config.baseUrl ?? process.env.OPENCODE_URL ?? 'http://localhost:4096';
  const maxBackoffMs = config.maxBackoffMs ?? 30_000;
  const baseBackoffMs = config.baseBackoffMs ?? 1000;
  const log = config.log ?? ((m: string) => console.log(`[opencode-events] ${m}`));

  const subscribers = new Map<string, Set<EventCallback>>();
  const status: BusStatus = {
    connected: false,
    lastEventAt: null,
    reconnectCount: 0,
    eventsReceived: 0,
    eventsRelayed: 0,
  };

  let controller: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0; // consecutive failures since last successful open
  let openCount = 0; // successful opens over the bus lifetime
  let stopped = false;
  let running = false; // a connect loop is active

  function deliver(sessionID: string, event: OpencodeEvent): void {
    const set = subscribers.get(sessionID);
    if (!set || set.size === 0) return;
    for (const cb of set) {
      try {
        cb(event);
        status.eventsRelayed++;
      } catch (e) {
        log(`subscriber callback threw for ${sessionID}: ${(e as Error)?.message ?? e}`);
      }
    }
  }

  function broadcastBusGap(reason: string): void {
    const gap: OpencodeEvent = { type: BUS_GAP, properties: { reason } };
    for (const sessionID of subscribers.keys()) deliver(sessionID, gap);
  }

  function handleEvent(event: OpencodeEvent): void {
    status.eventsReceived++;
    status.lastEventAt = Date.now();
    const sid = event.properties?.sessionID;
    if (typeof sid === 'string') deliver(sid, event);
    // Events with no sessionID (server.connected, heartbeats) are bus-level
    // only and intentionally not fanned out.
  }

  function scheduleReconnect(reason: string): void {
    if (stopped) return;
    status.connected = false;
    attempt++;
    const delay = computeBackoffMs(attempt, maxBackoffMs, baseBackoffMs);
    log(`disconnected (${reason}); reconnect attempt ${attempt} in ${Math.round(delay)}ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  }

  async function connect(): Promise<void> {
    if (stopped || running) return;
    running = true;
    const directory = resolveDirectory(config.directory);
    const url = `${baseUrl}/event?directory=${encodeURIComponent(directory)}`;
    controller = new AbortController();
    try {
      const res = await fetch(url, {
        headers: opencodeHeaders({ Accept: 'text/event-stream' }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        running = false;
        scheduleReconnect(`HTTP ${res.status}`);
        return;
      }

      // Connection established.
      openCount++;
      attempt = 0;
      status.connected = true;
      if (openCount > 1) {
        status.reconnectCount++;
        broadcastBusGap('reconnected');
        log(`reconnected (open #${openCount})`);
      } else {
        log('connected');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSSE(buffer);
        buffer = remainder;
        for (const ev of events) handleEvent(ev);
      }
      running = false;
      scheduleReconnect('stream ended');
    } catch (e) {
      running = false;
      if (stopped) {
        status.connected = false;
        return;
      }
      scheduleReconnect((e as Error)?.name === 'AbortError' ? 'aborted' : `error: ${(e as Error)?.message ?? e}`);
    }
  }

  function ensureConnected(): void {
    if (stopped) return;
    if (!running && !reconnectTimer && !status.connected) void connect();
  }

  return {
    subscribe(sessionID, cb) {
      let set = subscribers.get(sessionID);
      if (!set) {
        set = new Set();
        subscribers.set(sessionID, set);
      }
      set.add(cb);
      ensureConnected();
    },
    unsubscribe(sessionID, cb) {
      const set = subscribers.get(sessionID);
      if (!set) return;
      set.delete(cb);
      if (set.size === 0) subscribers.delete(sessionID);
    },
    getBusStatus() {
      return { ...status };
    },
    subscriberCount() {
      return subscribers.size;
    },
    stop() {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (controller) controller.abort();
      status.connected = false;
    },
  };
}

// --- Shared singleton -------------------------------------------------------
// SvelteKit dev HMR re-evaluates modules; without a globalThis guard we would
// open duplicate bus connections and deliver doubled events (plan 2.1).

const GLOBAL_KEY = '__dwOpencodeBus';
type GlobalWithBus = typeof globalThis & { [GLOBAL_KEY]?: OpencodeEventBus };

export function getSharedBus(): OpencodeEventBus {
  const g = globalThis as GlobalWithBus;
  return (g[GLOBAL_KEY] ??= createOpencodeEventBus());
}

/** Subscribe to a session's events on the shared bus (opens it lazily). */
export function subscribe(sessionID: string, cb: EventCallback): void {
  getSharedBus().subscribe(sessionID, cb);
}

/** Stop receiving a session's events on the shared bus. */
export function unsubscribe(sessionID: string, cb: EventCallback): void {
  getSharedBus().unsubscribe(sessionID, cb);
}

/** Observability snapshot of the shared bus. */
export function getBusStatus(): BusStatus {
  return getSharedBus().getBusStatus();
}
