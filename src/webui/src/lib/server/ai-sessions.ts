/**
 * ai-sessions — ownership registry for AI sessions.
 *
 * Live AI Visibility plan (live-ai-visibility-event-relay.md) step 2.2. Records
 * which authenticated user owns each OpenCode session so the per-session stream
 * endpoint (2.3) can enforce `owner === requester` (403 otherwise) and so the
 * presence indicator (3.6) can list a user's active sessions.
 *
 * State is an in-memory Map mirrored to a JSON file under DOCWRIGHT_CACHE_DIR.
 * This is derived, ephemeral cache — NOT canonical governance state (invariant
 * #2/#3: git stays the canonical store, no auxiliary DB). Losing the file only
 * means in-flight sessions can no longer be streamed; nothing durable is lost.
 *
 * TTL: entries older than 24h are pruned on load, on every read (lazy), and by
 * an hourly sweep — preventing unbounded growth and stale-ownership leakage.
 *
 * Single-instance assumption (plan Constraint 8): the Map is per-process. A
 * multi-instance deployment needs a shared store (deferred to Phase 5).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { opencodeHeaders } from '../../../../dispatch/opencode-auth';

export interface OwnedSession {
  sessionID: string;
  owner: string;
  feature: string;
  docPath: string | null;
  createdAt: number; // epoch ms
}

export interface SessionRegistry {
  record(session: OwnedSession): void;
  get(sessionID: string): OwnedSession | undefined;
  listFor(user: string): OwnedSession[];
  /** Remove expired entries; returns how many were pruned. */
  prune(): number;
  size(): number;
  /** Stop the hourly sweep timer (shutdown/tests). */
  stop(): void;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const SWEEP_MS = 60 * 60 * 1000; // hourly

export interface RegistryConfig {
  /** Directory the JSON mirror lives in. Defaults to DOCWRIGHT_CACHE_DIR or tmp. */
  cacheDir?: string;
  /** Entry lifetime in ms (default 24h). */
  ttlMs?: number;
  /** Injectable clock for tests (default Date.now). */
  now?: () => number;
  /** Sweep interval in ms (default hourly). */
  sweepMs?: number;
  /** Start the background sweep timer (default true; tests pass false). */
  autoSweep?: boolean;
  /** Log sink (default console). */
  log?: (msg: string) => void;
}

function defaultCacheDir(): string {
  if (process.env.DOCWRIGHT_CACHE_DIR) return path.resolve(process.env.DOCWRIGHT_CACHE_DIR);
  return path.join(os.tmpdir(), 'docwright-cache');
}

function isValidRecord(r: unknown): r is OwnedSession {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.sessionID === 'string' &&
    typeof o.owner === 'string' &&
    typeof o.feature === 'string' &&
    (o.docPath === null || typeof o.docPath === 'string') &&
    typeof o.createdAt === 'number'
  );
}

export function createSessionRegistry(config: RegistryConfig = {}): SessionRegistry {
  const cacheDir = config.cacheDir ?? defaultCacheDir();
  const ttlMs = config.ttlMs ?? TTL_MS;
  const now = config.now ?? (() => Date.now());
  const sweepMs = config.sweepMs ?? SWEEP_MS;
  const autoSweep = config.autoSweep ?? true;
  const log = config.log ?? ((m: string) => console.log(`[ai-sessions] ${m}`));
  const file = path.join(cacheDir, 'ai-sessions.json');

  const sessions = new Map<string, OwnedSession>();
  let sweepTimer: ReturnType<typeof setInterval> | null = null;

  function isExpired(s: OwnedSession): boolean {
    return now() - s.createdAt > ttlMs;
  }

  function persist(): void {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ sessions: [...sessions.values()] }));
      fs.renameSync(tmp, file); // atomic replace
    } catch (e) {
      log(`persist failed: ${(e as Error)?.message ?? e}`);
    }
  }

  function load(): void {
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      return; // no file yet — empty registry
    }
    try {
      const parsed = JSON.parse(raw) as { sessions?: unknown };
      const arr = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      for (const r of arr) {
        if (isValidRecord(r) && !isExpired(r)) sessions.set(r.sessionID, r);
      }
    } catch (e) {
      log(`load failed (starting empty): ${(e as Error)?.message ?? e}`);
    }
  }

  function prune(): number {
    let removed = 0;
    for (const [id, s] of sessions) {
      if (isExpired(s)) {
        sessions.delete(id);
        removed++;
      }
    }
    if (removed > 0) persist();
    return removed;
  }

  // Load persisted state and drop anything already stale.
  load();
  prune();

  if (autoSweep) {
    sweepTimer = setInterval(() => prune(), sweepMs);
    // Do not keep the process alive for the sweep.
    (sweepTimer as unknown as { unref?: () => void }).unref?.();
  }

  return {
    record(session) {
      sessions.set(session.sessionID, session);
      persist();
    },
    get(sessionID) {
      const s = sessions.get(sessionID);
      if (!s) return undefined;
      if (isExpired(s)) {
        // Lazy prune so a stale entry never satisfies an ownership check.
        sessions.delete(sessionID);
        persist();
        return undefined;
      }
      return s;
    },
    listFor(user) {
      const out: OwnedSession[] = [];
      for (const s of sessions.values()) {
        if (s.owner === user && !isExpired(s)) out.push(s);
      }
      return out;
    },
    prune,
    size() {
      return sessions.size;
    },
    stop() {
      if (sweepTimer) {
        clearInterval(sweepTimer);
        sweepTimer = null;
      }
    },
  };
}

// --- Shared singleton (globalThis guard per plan 2.1/2.2) -------------------

const GLOBAL_KEY = '__dwAiSessions';
type GlobalWithRegistry = typeof globalThis & { [GLOBAL_KEY]?: SessionRegistry };

export function getSharedRegistry(): SessionRegistry {
  const g = globalThis as GlobalWithRegistry;
  return (g[GLOBAL_KEY] ??= createSessionRegistry());
}

const OPENCODE_URL = process.env.OPENCODE_URL ?? 'http://localhost:4096';

function vaultRoot(): string {
  return process.env.DOCWRIGHT_ROOT ? path.resolve(process.env.DOCWRIGHT_ROOT) : process.cwd();
}

export interface CreateOwnedSessionInput {
  user: string;
  feature: string;
  docPath?: string | null;
  /** Optional model override { id, providerID }; omitted → OpenCode default. */
  model?: { id: string; providerID: string };
}

/**
 * Create an OpenCode session (scoped to the vault directory so its events flow
 * on the same directory-scoped /event bus the consumer subscribes to) and
 * record its ownership on the shared registry. Returns the owned-session record.
 */
export async function createOwnedSession(input: CreateOwnedSessionInput): Promise<OwnedSession> {
  const dir = `directory=${encodeURIComponent(vaultRoot())}`;
  const body: Record<string, unknown> = {};
  if (input.model) body.model = input.model;

  let res: Response;
  try {
    res = await fetch(`${OPENCODE_URL}/session?${dir}`, {
      method: 'POST',
      headers: opencodeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`OpenCode unreachable (${OPENCODE_URL}): ${(e as Error)?.message ?? e}`);
  }
  if (!res.ok) throw new Error(`OpenCode session create failed: HTTP ${res.status}`);
  const sess = (await res.json()) as { id?: string; sessionID?: string };
  const sessionID = sess?.id ?? sess?.sessionID;
  if (!sessionID) throw new Error('OpenCode returned no session ID');

  const record: OwnedSession = {
    sessionID,
    owner: input.user,
    feature: input.feature,
    docPath: input.docPath ?? null,
    createdAt: Date.now(),
  };
  getSharedRegistry().record(record);
  return record;
}

/** Look up a session's ownership record (undefined if unknown or expired). */
export function getSession(sessionID: string): OwnedSession | undefined {
  return getSharedRegistry().get(sessionID);
}

/** List a user's non-expired sessions. */
export function listSessionsFor(user: string): OwnedSession[] {
  return getSharedRegistry().listFor(user);
}
