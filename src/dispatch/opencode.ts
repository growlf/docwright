/**
 * dispatch/opencode.ts — Thin typed adapter wrapping all OpenCode HTTP calls.
 *
 * This module is the single boundary between DocWright and the OpenCode HTTP API.
 * All API-shape changes, response normalisation, and endpoint versioning live here.
 *
 * Invariant: zero VS Code API imports. Importable outside the extension host.
 */

// ── Public types ─────────────────────────────────────────────────────────────

export interface OpenCodeSession {
  id: string;
  title?: string;
  time?: string;
  tokenCount?: number;
}

export interface OpenCodeMessagePart {
  type: string;
  text?: string;
}

export interface OpenCodeMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: OpenCodeMessagePart[];
}

export interface OpenCodeModel {
  id: string;
  providerID: string;
  name: string;
}

export interface OpenCodeProvider {
  id: string;
  label?: string;
}

export interface OpenCodeUsage {
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}

export interface OpenCodeSendResult {
  messageId?: string;
  parts: OpenCodeMessagePart[];
  usage?: OpenCodeUsage;
}

export interface OpenCodeAdapterConfig {
  baseUrl: string;
  vaultPath?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

const DIR_QP = 'directory';

function withDir(url: string, vaultPath?: string): string {
  if (!vaultPath) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${DIR_QP}=${encodeURIComponent(vaultPath)}`;
}

function buildUrl(base: string, path: string, vaultPath?: string): string {
  return withDir(`${base.replace(/\/$/, '')}/${path}`, vaultPath);
}

async function ocFetch(
  baseUrl: string,
  method: string,
  path: string,
  vaultPath: string | undefined,
  body?: unknown,
): Promise<Response> {
  return fetch(buildUrl(baseUrl, path, vaultPath), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

async function ocApi<T = unknown>(
  baseUrl: string,
  method: string,
  path: string,
  vaultPath: string | undefined,
  body?: unknown,
): Promise<T> {
  const res = await ocFetch(baseUrl, method, path, vaultPath, body);
  if (!res.ok) throw new Error(`OpenCode ${method} ${path}: ${res.status} ${res.statusText}`);
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('json') ? (res.json() as Promise<T>) : (res.text() as unknown as Promise<T>);
}

// ── Session ID normaliser ────────────────────────────────────────────────────
// OpenCode may return session ID as `id`, `sessionID`, or nested `session.{id,sessionID}`.

function extractSessionId(raw: Record<string, unknown>): string | undefined {
  if (raw.session && typeof raw.session === 'object') {
    const s = raw.session as Record<string, unknown>;
    return (s.id ?? s.sessionID) as string | undefined;
  }
  return (raw.id ?? raw.sessionID) as string | undefined;
}

// ── API functions ────────────────────────────────────────────────────────────

/**
 * Check whether the OpenCode server is reachable.
 */
export async function checkHealth(baseUrl: string, vaultPath?: string): Promise<boolean> {
  try {
    const res = await ocFetch(baseUrl, 'GET', 'global/health', vaultPath);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List all sessions from the OpenCode server.
 */
export async function listSessions(
  baseUrl: string,
  vaultPath?: string,
): Promise<OpenCodeSession[]> {
  const data = await ocApi<unknown[] | { sessions: OpenCodeSession[] }>(
    baseUrl, 'GET', 'session', vaultPath,
  );
  return Array.isArray(data) ? (data as OpenCodeSession[]) : (data as { sessions: OpenCodeSession[] }).sessions ?? [];
}

/**
 * Create a new session, optionally with a specific provider and model.
 */
export async function createSession(
  baseUrl: string,
  vaultPath?: string,
  options?: { providerID?: string; modelID?: string },
): Promise<OpenCodeSession> {
  const body: Record<string, string> = {};
  if (options?.providerID) body.providerID = options.providerID;
  if (options?.modelID) body.modelID = options.modelID;

  const raw = await ocApi<Record<string, unknown>>(baseUrl, 'POST', 'session', vaultPath, body);
  const id = extractSessionId(raw);
  if (!id) throw new Error('OpenCode returned no session ID');
  return { id, title: raw.title as string | undefined };
}

/**
 * Fork an existing session into a new independent session.
 */
export async function forkSession(
  baseUrl: string,
  sessionId: string,
  vaultPath?: string,
): Promise<OpenCodeSession> {
  const raw = await ocApi<Record<string, unknown>>(
    baseUrl, 'POST', `session/${sessionId}/fork`, vaultPath,
  );
  const id = extractSessionId(raw);
  if (!id) throw new Error('OpenCode returned no session ID on fork');
  return { id, title: raw.title as string | undefined };
}

/**
 * Summarise a session to compact its context.
 */
export async function summariseSession(
  baseUrl: string,
  sessionId: string,
  vaultPath?: string,
): Promise<string> {
  return ocApi<string>(baseUrl, 'POST', `session/${sessionId}/summarise`, vaultPath);
}

/**
 * Share a session and return a shareable URL.
 */
export async function shareSession(
  baseUrl: string,
  sessionId: string,
  vaultPath?: string,
): Promise<string> {
  const raw = await ocApi<{ url?: string }>(
    baseUrl, 'POST', `session/${sessionId}/share`, vaultPath,
  );
  return raw.url ?? '';
}

/**
 * Delete a session.
 */
export async function deleteSession(
  baseUrl: string,
  sessionId: string,
  vaultPath?: string,
): Promise<void> {
  const res = await ocFetch(baseUrl, 'DELETE', `session/${sessionId}`, vaultPath);
  if (!res.ok) throw new Error(`OpenCode DELETE session/${sessionId}: ${res.status}`);
}

/**
 * Retrieve all messages for a given session.
 */
export async function getSessionMessages(
  baseUrl: string,
  sessionId: string,
  vaultPath?: string,
): Promise<OpenCodeMessage[]> {
  const data = await ocApi<unknown[] | { messages: OpenCodeMessage[] }>(
    baseUrl, 'GET', `session/${sessionId}/message`, vaultPath,
  );
  const list = Array.isArray(data) ? (data as OpenCodeMessage[]) : (data as { messages: OpenCodeMessage[] }).messages ?? [];
  return list.map(m => {
    const raw = m as unknown as Record<string, string>;
    return {
      id: m.id ?? raw.messageID,
      role: (raw.role === 'user' || raw.role === 'human') ? 'user' : 'assistant',
      parts: m.parts ?? [{ type: 'text', text: raw.content ?? '' }],
    };
  });
}

/**
 * Send a message to a session and return the completed response.
 *
 * NOTE: OpenCode may also stream partial text via SSE on the `/event` endpoint
 * while this POST blocks. Use `getSessionMessages()` or listen to SSE for
 * streaming updates during the POST.
 */
export async function sendMessage(
  baseUrl: string,
  sessionId: string,
  text: string,
  vaultPath?: string,
): Promise<OpenCodeSendResult> {
  const raw = await ocApi<Record<string, unknown>>(
    baseUrl, 'POST', `session/${sessionId}/message`, vaultPath,
    { parts: [{ type: 'text', text }] },
  );

  const output = raw.output as { parts?: OpenCodeMessagePart[] } | undefined;
  const rawParts = (raw.parts ?? output?.parts) as OpenCodeMessagePart[] | undefined;
  const parts: OpenCodeMessagePart[] = rawParts ?? [];

  const messageId: string | undefined =
    (raw.info as Record<string, unknown> | undefined)?.id as string
    ?? (raw.message as Record<string, unknown> | undefined)?.id as string
    ?? raw.id as string;

  const usage: OpenCodeUsage | undefined = raw.usage as OpenCodeUsage | undefined;

  return { messageId, parts, usage };
}

/**
 * Abort the current in-flight message for a session.
 */
export async function abortSession(
  baseUrl: string,
  sessionId: string,
  vaultPath?: string,
): Promise<void> {
  await ocFetch(baseUrl, 'POST', `session/${sessionId}/abort`, vaultPath, {});
}

/**
 * List available AI models from OpenCode.
 */
export async function listModels(
  baseUrl: string,
  vaultPath?: string,
): Promise<OpenCodeModel[]> {
  try {
    const raw = await ocApi<{ data?: OpenCodeModel[] }>(
      baseUrl, 'GET', 'api/model', vaultPath,
    );
    return (raw.data ?? []).map(m => ({
      id: m.id,
      providerID: m.providerID,
      name: m.name ?? m.id,
    }));
  } catch {
    return [];
  }
}

/**
 * List available AI providers from OpenCode.
 */
export async function listProviders(
  baseUrl: string,
  vaultPath?: string,
): Promise<OpenCodeProvider[]> {
  try {
    const raw = await ocApi<OpenCodeProvider[] | { data?: OpenCodeProvider[]; providers?: OpenCodeProvider[] }>(
      baseUrl, 'GET', 'api/provider', vaultPath,
    );
    if (Array.isArray(raw)) return raw;
    return (raw.data ?? raw.providers ?? []);
  } catch {
    return [];
  }
}
