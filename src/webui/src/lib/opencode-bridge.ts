/**
 * Bridge to dispatch/opencode adapter — mirrors the adapter functions directly.
 *
 * Vite restricts imports outside the project root, so these are duplicated
 * here. Keep in sync with src/dispatch/opencode.ts.
 */

interface SessionResult { id: string; title?: string; }

async function fetchJson(method: string, path: string, body?: unknown): Promise<any> {
  const url = path.startsWith('http') ? path : path;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('json') ? res.json() : res.text();
}

export async function forkSession(baseUrl: string, sessionId: string, vaultPath?: string): Promise<SessionResult> {
  let url = `${baseUrl.replace(/\/$/, '')}/session/${sessionId}/fork`;
  if (vaultPath) url += `?directory=${encodeURIComponent(vaultPath)}`;
  const raw = await fetchJson('POST', url);
  const id = raw?.id ?? raw?.sessionID ?? raw?.session?.id ?? raw?.session?.sessionID;
  if (!id) throw new Error('No session ID from fork');
  return { id, title: raw.title };
}

export async function summariseSession(baseUrl: string, sessionId: string, vaultPath?: string): Promise<string> {
  let url = `${baseUrl.replace(/\/$/, '')}/session/${sessionId}/summarise`;
  if (vaultPath) url += `?directory=${encodeURIComponent(vaultPath)}`;
  return fetchJson('POST', url);
}

export async function shareSession(baseUrl: string, sessionId: string, vaultPath?: string): Promise<string> {
  let url = `${baseUrl.replace(/\/$/, '')}/session/${sessionId}/share`;
  if (vaultPath) url += `?directory=${encodeURIComponent(vaultPath)}`;
  const raw = await fetchJson('POST', url);
  return raw?.url ?? '';
}

export async function deleteSession(baseUrl: string, sessionId: string, vaultPath?: string): Promise<void> {
  let url = `${baseUrl.replace(/\/$/, '')}/session/${sessionId}`;
  if (vaultPath) url += `?directory=${encodeURIComponent(vaultPath)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE session/${sessionId}: ${res.status}`);
}
