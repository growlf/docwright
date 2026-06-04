<script lang="ts">
  /**
   * ChatPanel — connects directly from the browser to the user's local
   * OpenCode instance (default http://localhost:4096).
   *
   * Connection modes:
   *   direct — browser → OpenCode URL (each client uses their own instance)
   *   proxy  — browser → /api/opencode/... → server's OpenCode (fallback)
   *
   * Config stored in localStorage so each browser keeps its own settings.
   */

  import { onMount, onDestroy } from 'svelte';
  import { showChatPanel } from './pane';

  // ── Types ────────────────────────────────────────────────────────────────

  interface MessagePart { type: string; text?: string; }
  interface Message { id: string; role: 'user' | 'assistant'; parts: MessagePart[]; }
  interface Session { id: string; title?: string; }
  type ConnMode = 'direct' | 'proxy';
  type ProcStatus = 'stopped' | 'starting' | 'running-ours' | 'running-external';

  // OpenCode uses 'user'/'assistant' or 'human'/'model' depending on version
  function normalizeRole(role: string): 'user' | 'assistant' {
    if (role === 'user' || role === 'human') return 'user';
    return 'assistant'; // assistant, model, ai, tool — all render as assistant
  }

  // ── Connection config (localStorage) ─────────────────────────────────────

  const LS_URL      = 'oc-url';
  const LS_MODE     = 'oc-mode';
  const DEFAULT_URL = 'http://localhost:4096';

  function lsGet(key: string, fallback: string) {
    if (typeof localStorage === 'undefined') return fallback;
    return localStorage.getItem(key) ?? fallback;
  }
  function lsSet(key: string, val: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
  }

  let ocUrl  = $state(lsGet(LS_URL, DEFAULT_URL));
  let mode   = $state<ConnMode>(lsGet(LS_MODE, 'direct') as ConnMode);
  let vaultPath = $state('');

  function saveConfig() {
    lsSet(LS_URL, ocUrl);
    lsSet(LS_MODE, mode);
    checkHealth();
  }

  // ── Resolved connection base ─────────────────────────────────────────────

  function base(): string {
    return mode === 'proxy' ? '/api/opencode' : ocUrl.replace(/\/$/, '');
  }

  // Directory passed as ?directory= query param — works for both fetch AND EventSource
  // (EventSource doesn't support custom headers, so x-opencode-directory won't work)
  function withDir(url: string): string {
    if (!vaultPath) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}directory=${encodeURIComponent(vaultPath)}`;
  }

  function sseUrl(path: string): string {
    return withDir(`${base()}/${path}`);
  }

  // ── Request helper ────────────────────────────────────────────────────────

  async function ocFetch(method: string, path: string, body?: unknown, extraQuery?: string): Promise<Response> {
    let url = `${base()}/${path}`;
    if (extraQuery) url += (url.includes('?') ? '&' : '?') + extraQuery;
    url = withDir(url);
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  async function api(method: string, path: string, body?: unknown) {
    const res = await ocFetch(method, path, body);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') ?? '';
    return ct.includes('json') ? res.json() : res.text();
  }

  // ── UI state ─────────────────────────────────────────────────────────────

  let connected     = $state(false);
  let sseConnected  = $state(false);  // separate: EventSource is open and receiving
  let checking      = $state(true);
  let showSettings  = $state(false);
  let mcpRegistered = $state(false);
  let procStatus    = $state<ProcStatus>('stopped');
  let starting      = $state(false);
  let startMsg      = $state('');
  let sessions      = $state<Session[]>([]);
  let currentID     = $state<string | null>(null);
  let messages      = $state<Message[]>([]);
  let input         = $state('');
  let statusText    = $state('');
  let sending       = $state(false);
  let eventCount    = $state(0);     // total SSE events received (any type)
  let lastEvent     = $state('');    // last SSE event type seen
  let thinkingSecs  = $state(0);     // elapsed seconds while sending
  let msgEnd        = $state<HTMLElement | undefined>(undefined);
  let es: EventSource | null = null;
  let sseRetries    = 0;
  let thinkingTimer: ReturnType<typeof setInterval> | null = null;

  // The correct opencode serve command for this browser's origin
  let serveCmd = $derived(
    typeof window !== 'undefined'
      ? `opencode serve --cors ${window.location.origin}`
      : 'opencode serve --cors <docwright-url>'
  );

  // ── Health ───────────────────────────────────────────────────────────────

  async function checkHealth() {
    checking = true;
    try {
      const res = await ocFetch('GET', 'global/health');
      connected = res.ok;
    } catch { connected = false; }
    // Also fetch server-side process status (useful in proxy/same-machine mode)
    try {
      const r = await fetch('/api/opencode-process');
      if (r.ok) { const d = await r.json(); procStatus = d.status; }
    } catch { /* server process info not critical */ }
    checking = false;
    if (connected) {
      openEventStream();
      await loadSessions();
      if (sessions.length > 0) await selectSession(sessions[0].id);
      else await newSession();
    }
  }

  // ── Process management (same-machine / proxy mode only) ──────────────────

  async function startViaServer() {
    starting = true;
    startMsg = 'Starting OpenCode on server…';
    try {
      const res = await fetch('/api/opencode-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      procStatus = data.status;
      startMsg = data.message;
      if (data.ok) await checkHealth();
    } catch { startMsg = 'Failed — is opencode on the server PATH?'; }
    starting = false;
  }

  async function stopViaServer() {
    await fetch('/api/opencode-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
    });
    procStatus = 'stopped';
    connected = false;
    es?.close(); es = null;
    messages = []; sessions = []; currentID = null;
  }

  // ── SSE event stream ─────────────────────────────────────────────────────

  function openEventStream() {
    if (es) { es.close(); es = null; }
    sseConnected = false;
    const url = sseUrl('event');
    console.debug('[DocWright chat] Opening SSE stream:', url);
    es = new EventSource(url);

    es.onopen = () => {
      console.debug('[DocWright chat] SSE stream opened');
      sseConnected = true;
      sseRetries = 0;
    };

    es.onmessage = (e) => {
      sseConnected = true;
      try {
        const ev = JSON.parse(e.data);
        lastEvent = ev.type;
        if (ev.type !== 'server.heartbeat') eventCount++;
        console.debug('[DocWright chat] SSE event:', ev.type, ev.properties);
        handleEvent(ev);
      } catch (err) {
        console.warn('[DocWright chat] Failed to parse SSE event:', e.data, err);
      }
    };

    es.onerror = (err) => {
      console.warn('[DocWright chat] SSE error (retry', sseRetries, '):', err);
      sseConnected = false;
      sseRetries++;
      // Don't immediately disconnect — EventSource auto-retries.
      // Only hard-disconnect after 5 consecutive failures.
      if (sseRetries >= 5) {
        console.error('[DocWright chat] SSE gave up after 5 retries');
        connected = false;
        es?.close(); es = null;
      }
    };
  }

  function handleEvent(ev: { type: string; properties?: Record<string, any>; sessionID?: string }) {
    const p = ev.properties ?? {};
    const sessionID = p.sessionID ?? ev.sessionID;

    if (ev.type === 'session.status' && sessionID === currentID) {
      statusText = p.status ?? '';
    }

    if (ev.type === 'message.part.updated') {
      // Actual structure: { part: { sessionID, messageID, type, text, ... }, delta?: string }
      const part = p.part ?? p; // some versions wrap in .part, others are flat
      const sessionID = part.sessionID ?? p.sessionID;
      if (sessionID !== currentID) {
        console.warn('[DocWright chat] session mismatch — event:', sessionID, 'current:', currentID);
        // Accept anyway if no currentID is set yet
        if (currentID !== null) return;
      }
      if (part.type !== 'text') return;
      // Skip if the event is explicitly for a user-role message (echo from server)
      if (normalizeRole(part.role ?? p.role ?? 'assistant') !== 'assistant') return;

      // messageID: try part.messageID, part.id, flat p.messageID, then generate one
      const messageID: string = part.messageID ?? p.messageID ?? part.id ?? `ai-${Date.now()}`;
      // Prefer delta (incremental) for smooth streaming; fall back to full text
      const delta: string = p.delta ?? part.text ?? '';
      if (!delta && !messageID.startsWith('ai-')) return;

      const idx = messages.findIndex(m => m.id === messageID);
      if (idx >= 0) {
        const updated = [...messages];
        const existing = updated[idx].parts.find(pt => pt.type === 'text');
        if (p.delta !== undefined) {
          // Delta mode: append the incremental text
          if (existing) existing.text = (existing.text ?? '') + p.delta;
          else updated[idx].parts.push({ type: 'text', text: p.delta });
        } else {
          // Full text mode: replace (it's the accumulated value)
          if (existing) existing.text = part.text ?? '';
          else updated[idx].parts.push({ type: 'text', text: part.text ?? '' });
        }
        messages = updated;
      } else {
        messages = [...messages, {
          id: messageID,
          role: 'assistant',
          parts: [{ type: 'text', text: p.delta ?? part.text ?? '' }],
        }];
      }
      scrollToBottom();
    }

    if (ev.type === 'message.updated' && sessionID === currentID) {
      const tool = p.message?.parts?.find((pt: any) => pt.type === 'tool-invocation');
      if (tool?.toolName) statusText = `running: ${tool.toolName}`;
    }

    if (ev.type === 'session.idle' && sessionID === currentID) {
      statusText = '';
      sending = false;
    }
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async function loadSessions() {
    try {
      const data = await api('GET', 'session');
      sessions = Array.isArray(data) ? data : (data.sessions ?? []);
    } catch { sessions = []; }
  }

  async function newSession() {
    try {
      const s = await api('POST', 'session', {});
      // OpenCode may return { id } or { sessionID } or nested { session: { id } }
      const id: string = s?.id ?? s?.sessionID ?? s?.session?.id ?? s?.session?.sessionID;
      if (!id) {
        console.error('[DocWright chat] Session create returned no ID:', s);
        statusText = 'Could not get session ID — check console';
        return;
      }
      console.debug('[DocWright chat] Created session:', id);
      sessions = [{ id, title: s?.title }, ...sessions];
      await selectSession(id);
    } catch (e) {
      console.error('[DocWright chat] Session create failed:', e);
      statusText = 'Session create failed — check console';
    }
  }

  async function selectSession(id: string) {
    currentID = id;
    messages = [];
    statusText = '';
    try {
      const data = await api('GET', `session/${id}/message`);
      const list = Array.isArray(data) ? data : (data.messages ?? []);
      messages = list.map((m: any) => ({
        id: m.id ?? m.messageID,
        role: normalizeRole(m.role),
        parts: m.parts ?? [{ type: 'text', text: m.content ?? '' }],
      }));
      scrollToBottom();
    } catch { messages = []; }
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  let sendTimeout: ReturnType<typeof setTimeout> | null = null;

  async function send() {
    const text = input.trim();
    if (!text) return;
    if (!currentID) { statusText = 'No active session — try New Session'; return; }
    if (sending) return;
    console.debug('[DocWright chat] Sending to session', currentID, ':', text.slice(0, 60));
    input = '';
    sending = true;
    thinkingSecs = 0;
    statusText = 'thinking…';
    thinkingTimer = setInterval(() => { thinkingSecs++; }, 1000);
    messages = [...messages, { id: 'tmp-' + Date.now(), role: 'user', parts: [{ type: 'text', text }] }];
    scrollToBottom();

    try {
      // POST /session/:id/message is synchronous — it blocks until the AI
      // finishes and returns the complete response. SSE streams the partial
      // text while we wait, but the response body is the source of truth.
      const res = await ocFetch('POST', `session/${currentID}/message`, {
        parts: [{ type: 'text', text }],
      });

      if (!res.ok) {
        statusText = `Send failed (${res.status}) — check console`;
        console.error('[DocWright chat] Send failed:', res.status, res.statusText);
        sending = false;
        return;
      }

      // Read the response body — it contains the AI's complete reply
      const data = await res.json().catch(() => null);
      console.debug('[DocWright chat] POST response:', data);

      if (data) {
        // Extract text from response parts — use as fallback if SSE didn't stream it
        const responseParts: any[] = data.parts ?? data.output?.parts ?? [];
        const textContent = responseParts
          .filter((p: any) => p.type === 'text' && normalizeRole(p.role ?? 'assistant') === 'assistant')
          .map((p: any) => p.text ?? '')
          .join('');

        const msgId = data.info?.id ?? data.message?.id ?? data.id ?? `ai-${Date.now()}`;

        // Only add if SSE hasn't already added this message
        const alreadyAdded = messages.some(m => m.id === msgId);
        if (!alreadyAdded && textContent) {
          messages = [...messages, {
            id: msgId,
            role: 'assistant',
            parts: [{ type: 'text', text: textContent }],
          }];
          scrollToBottom();
        } else if (alreadyAdded && textContent) {
          // SSE may have partial text; update with complete response
          const idx = messages.findIndex(m => m.id === msgId);
          if (idx >= 0) {
            const updated = [...messages];
            const tp = updated[idx].parts.find(p => p.type === 'text');
            if (tp) tp.text = textContent;
            messages = updated;
          }
        }
      }
    } catch (e) {
      console.error('[DocWright chat] Send error:', e);
      statusText = 'Send failed — is OpenCode still running?';
    } finally {
      sending = false;
      statusText = '';
      if (sendTimeout) { clearTimeout(sendTimeout); sendTimeout = null; }
      if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null; }
    }
  }

  async function cancelSend() {
    if (currentID) {
      try { await ocFetch('POST', `session/${currentID}/abort`, {}); } catch { /* ignore */ }
    }
    sending = false;
    statusText = 'Cancelled';
    setTimeout(() => { if (statusText === 'Cancelled') statusText = ''; }, 2000);
    if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null; }
    if (sendTimeout) { clearTimeout(sendTimeout); sendTimeout = null; }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function scrollToBottom() {
    setTimeout(() => msgEnd?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  // ── Mount ─────────────────────────────────────────────────────────────────

  async function ensureMcp() {
    try {
      // Check current state
      const check = await fetch('/api/opencode-config');
      if (!check.ok) return;
      const state = await check.json();
      if (state.registered) { mcpRegistered = true; return; }
      // Register if not already
      const reg = await fetch('/api/opencode-config', { method: 'POST' });
      if (reg.ok) { const d = await reg.json(); mcpRegistered = d.registered; }
    } catch { /* non-critical */ }
  }

  onMount(async () => {
    try {
      const r = await fetch('/api/brand');
      if (r.ok) { const d = await r.json(); vaultPath = d.vaultPath ?? ''; }
    } catch { /* non-critical */ }
    await ensureMcp();
    await checkHealth();
  });

  onDestroy(() => { es?.close(); });
</script>

<div class="chat-panel">

  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="chat-header">
    <span class="chat-title">AI Chat</span>
    <span class="mode-badge" class:proxy={mode === 'proxy'}
      title={mode === 'direct' ? 'Direct — connecting to your local OpenCode' : 'Proxy — using server OpenCode'}>
      {mode}
    </span>
    {#if connected}
      <span class="dot green"
        title={procStatus === 'running-ours' ? 'Started by DocWright (this server)' : 'OpenCode connected'}
      ></span>
      <span class="dot {sseConnected ? 'sse-ok' : 'sse-warn'}"
        title={sseConnected ? 'Event stream live' : 'Event stream connecting…'}
      ></span>
      {#if procStatus === 'running-ours'}
        <button class="icon-btn" onclick={stopViaServer} title="Stop OpenCode (started by this server)">■</button>
      {/if}
    {:else}
      <span class="dot grey" title="Not connected"></span>
    {/if}
    <button class="icon-btn" onclick={() => showSettings = !showSettings} title="Connection settings">⚙</button>
    <!-- Close via ⚡ Chat toggle button in layout -->
  </div>

  <!-- ── Settings ───────────────────────────────────────────────────────── -->
  {#if showSettings}
    <div class="settings-panel">
      <div class="setting-row">
        <label class="setting-label" for="oc-mode">Mode</label>
        <select id="oc-mode" class="setting-select" bind:value={mode} onchange={saveConfig}>
          <option value="direct">Direct — my local OpenCode</option>
          <option value="proxy">Proxy — server's OpenCode</option>
        </select>
      </div>
      {#if mode === 'direct'}
        <div class="setting-row">
          <label class="setting-label" for="oc-url">OpenCode URL</label>
          <input id="oc-url" class="setting-input" type="text" bind:value={ocUrl}
            placeholder="http://localhost:4096"
            onblur={saveConfig} />
        </div>
        {#if typeof window !== 'undefined' && ocUrl && ocUrl.includes(window.location.host)}
          <div class="setting-warn">
            ⚠ This URL points to DocWright itself — set it to where OpenCode is running (default: <code>http://localhost:4096</code>)
          </div>
        {:else}
          <div class="setting-hint">
            Start OpenCode with CORS allowed for this page:
            <code class="setting-cmd">{serveCmd}</code>
          </div>
        {/if}
      {/if}
      <div class="setting-row">
        <span class="setting-label">MCP</span>
        {#if mcpRegistered}
          <span class="mcp-ok">✓ DocWright tools registered</span>
        {:else}
          <span class="mcp-warn">⚠ Not registered</span>
          <button class="setting-retry" onclick={ensureMcp}>Register</button>
        {/if}
      </div>
      <button class="setting-retry" onclick={() => { showSettings = false; checkHealth(); }}>
        Reconnect
      </button>
    </div>
  {/if}

  <!-- ── Disconnected ───────────────────────────────────────────────────── -->
  {#if checking}
    <div class="state-msg muted">Connecting…</div>

  {:else if !connected}
    <div class="dc-state">
      <div class="dc-icon">⚡</div>
      <div class="dc-title">OpenCode not reachable</div>
      <div class="dc-sub">at <code>{mode === 'proxy' ? 'server' : ocUrl}</code></div>

      {#if mode === 'direct'}
        <div class="dc-instructions">
          <p>Run this on <strong>your machine</strong>:</p>
          <code class="dc-cmd">{serveCmd}</code>
          <p class="dc-hint">This allows DocWright to connect to your local OpenCode securely.</p>
        </div>
        <button class="dc-btn primary" onclick={checkHealth}>Retry connection</button>
        <div class="dc-or">or</div>
        <button class="dc-btn" onclick={() => showSettings = true}>Configure URL ⚙</button>
        <div class="dc-separator"></div>
        <div class="dc-hint muted">On the same machine as DocWright?</div>
        {#if starting}
          <div class="dc-hint">{startMsg}</div>
          <div class="dc-spinner"></div>
        {:else}
          <button class="dc-btn secondary" onclick={startViaServer}>
            Start OpenCode on this server
          </button>
        {/if}

      {:else}
        <!-- Proxy mode disconnected -->
        {#if starting}
          <div class="dc-hint">{startMsg}</div>
          <div class="dc-spinner"></div>
        {:else if startMsg}
          <div class="dc-hint err">{startMsg}</div>
          <button class="dc-btn primary" onclick={startViaServer}>Try again</button>
        {:else}
          <button class="dc-btn primary" onclick={startViaServer}>Start OpenCode on server</button>
        {/if}
        <button class="dc-btn" onclick={checkHealth}>Retry</button>
      {/if}
    </div>

  {:else}
    <!-- ── Connected ────────────────────────────────────────────────────── -->

    <!-- Session bar -->
    <div class="session-bar">
      <select class="session-select"
        onchange={(e) => selectSession((e.target as HTMLSelectElement).value)}>
        {#if sessions.length === 0}
          <option value="">No sessions</option>
        {/if}
        {#each sessions.filter(s => s?.id) as s (s.id)}
          <option value={s.id} selected={s.id === currentID}>
            {s.title || s.id.slice(0, 14) + '…'}
          </option>
        {/each}
      </select>
      <button class="icon-btn" onclick={newSession} title="New session">＋</button>
    </div>
    {#if !currentID}
      <div class="no-session-warn">No active session — click ＋ to create one</div>
    {:else if !sseConnected}
      <div class="no-session-warn">Event stream connecting… responses may not appear yet</div>
    {/if}

    <!-- Messages -->
    <div class="messages">
      {#each messages as msg (msg.id ?? msg)}
        <div class="msg {msg.role}">
          {#each msg.parts as part}
            {#if part.type === 'text' && part.text}
              <span class="msg-text">{part.text}</span>
            {/if}
          {/each}
        </div>
      {/each}
      {#if statusText}
        <div class="status-row">
          <span>{statusText}{sending && thinkingSecs > 0 ? ` (${thinkingSecs}s)` : ''}</span>
          {#if sending && thinkingSecs > 1}
            <span class="event-count">
              {eventCount > 0 ? `${eventCount} events` : 'waiting…'}
              {#if lastEvent === 'server.heartbeat'}· heartbeat{:else if lastEvent}· {lastEvent}{/if}
            </span>
            <button class="cancel-btn" onclick={cancelSend} title="Cancel">✕</button>
          {/if}
        </div>
      {/if}
      <div bind:this={msgEnd}></div>
    </div>

    <!-- Input -->
    <div class="input-area">
      <textarea class="chat-input" placeholder="Ask anything… (Enter to send)"
        bind:value={input} onkeydown={handleKey} rows="3"
        disabled={sending}></textarea>
      <button class="send-btn" onclick={send}
        disabled={sending || !input.trim()} title="Send (Enter)">
        {sending ? '…' : '↑'}
      </button>
    </div>
  {/if}
</div>

<style>
  .chat-panel {
    /* Fills #chat-bottom in the layout — no longer a fixed overlay */
    width: 100%; height: 100%;
    background: #111;
    display: flex; flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ── */
  .chat-header {
    display: flex; align-items: center; gap: 6px;
    padding: 9px 12px; border-bottom: 1px solid #222; flex-shrink: 0;
  }
  .chat-title { font-size: 12px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; flex: 1; }
  .mode-badge {
    font-size: 9px; padding: 1px 6px; border-radius: 8px;
    background: #1a2f4a; color: #58a6ff; border: 1px solid #2b5b84;
    text-transform: uppercase; letter-spacing: 0.3px;
  }
  .mode-badge.proxy { background: #2a1a4a; color: #a78bfa; border-color: #4a2b84; }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot.green    { background: #6d6; box-shadow: 0 0 4px #6d6; }
  .dot.grey     { background: #444; }
  .dot.sse-ok   { background: #58a6ff; box-shadow: 0 0 3px #58a6ff; }
  .dot.sse-warn { background: #cc6; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  .no-session-warn { padding: 4px 12px; font-size: 10px; color: #cc6; background: #1a1a00; border-bottom: 1px solid #333300; }
  .icon-btn  { background: none; border: none; color: #555; cursor: pointer; font-size: 12px; padding: 2px 5px; border-radius: 3px; }
  .icon-btn:hover { color: #aaa; background: #1a1a1a; }
  .icon-btn.close:hover { color: #e44; }

  /* ── Settings panel ── */
  .settings-panel {
    padding: 10px 14px; border-bottom: 1px solid #1a1a1a;
    background: #0f0f0f; flex-shrink: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .setting-row { display: flex; align-items: center; gap: 8px; }
  .setting-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.3px; width: 60px; flex-shrink: 0; }
  .setting-select, .setting-input {
    flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 4px;
    color: #aaa; font-size: 11px; padding: 3px 7px;
  }
  .setting-hint { font-size: 10px; color: #444; line-height: 1.5; }
  .setting-cmd  { display: block; margin-top: 3px; background: #1a1a1a; border: 1px solid #333; border-radius: 3px; padding: 4px 8px; color: #58a6ff; font-family: monospace; font-size: 10px; word-break: break-all; }
  .setting-retry { align-self: flex-start; padding: 4px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #888; font-size: 11px; cursor: pointer; }
  .setting-retry:hover { border-color: #555; color: #ccc; }
  .mcp-ok       { font-size: 11px; color: #6d6; }
  .mcp-warn     { font-size: 11px; color: #cc6; }
  .setting-warn { font-size: 10px; color: #e87; background: #2a1500; border: 1px solid #553300; border-radius: 3px; padding: 4px 8px; }
  .setting-warn code { color: #58a6ff; font-family: monospace; }

  /* ── Disconnected state ── */
  .state-msg { padding: 24px; font-size: 13px; text-align: center; }
  .state-msg.muted { color: #444; }

  .dc-state {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 8px; padding: 24px 20px; text-align: center;
  }
  .dc-icon  { font-size: 28px; color: #333; }
  .dc-title { font-size: 14px; font-weight: 600; color: #666; }
  .dc-sub   { font-size: 11px; color: #444; }
  .dc-sub code { color: #58a6ff; font-family: monospace; font-size: 10px; }
  .dc-instructions { width: 100%; background: #0d0d0d; border: 1px solid #222; border-radius: 6px; padding: 10px 12px; text-align: left; font-size: 11px; color: #555; }
  .dc-instructions p { margin: 0 0 6px; }
  .dc-instructions strong { color: #888; }
  .dc-cmd { display: block; background: #1a1a1a; border: 1px solid #2b5b84; border-radius: 4px; padding: 6px 10px; color: #58a6ff; font-family: monospace; font-size: 11px; word-break: break-all; margin: 4px 0; }
  .dc-hint  { font-size: 10px; color: #444; }
  .dc-hint.err { color: #e87; }
  .dc-hint.muted { color: #333; }
  .dc-btn {
    padding: 6px 20px; border-radius: 4px; font-size: 12px; cursor: pointer;
    background: #1a1a1a; border: 1px solid #333; color: #888; min-width: 180px;
  }
  .dc-btn:hover { border-color: #555; color: #ccc; }
  .dc-btn.primary { background: #0d1f2d; border-color: #2b5b84; color: #58a6ff; }
  .dc-btn.primary:hover { background: #1a3a5a; }
  .dc-btn.secondary { background: #1a1a1a; border-color: #333; color: #555; font-size: 11px; }
  .dc-btn.secondary:hover { color: #888; border-color: #444; }
  .dc-or { font-size: 10px; color: #333; }
  .dc-separator { width: 100%; border-top: 1px solid #1a1a1a; margin: 4px 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .dc-spinner { width: 18px; height: 18px; border: 2px solid #2b5b84; border-top-color: #58a6ff; border-radius: 50%; animation: spin 0.8s linear infinite; }

  /* ── Session bar ── */
  .session-bar {
    display: flex; gap: 6px; padding: 7px 10px;
    border-bottom: 1px solid #1a1a1a; flex-shrink: 0;
  }
  .session-select { flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #aaa; font-size: 11px; padding: 3px 6px; }

  /* ── Messages ── */
  .messages { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 7px; }
  .msg { max-width: 93%; padding: 7px 10px; border-radius: 8px; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; color: #ccc; background: #1a1a1a; align-self: flex-start; }
  .msg.user      { align-self: flex-end; background: #1a2f4a; color: #c8dfff; border-bottom-right-radius: 2px; }
  .msg.assistant,
  .msg.model     { align-self: flex-start; background: #1a1a1a; color: #ccc; border-bottom-left-radius: 2px; }
  .msg-text { display: block; color: inherit; }
  .status-row { font-size: 11px; color: #555; padding: 1px 4px; font-style: italic; align-self: flex-start; display: flex; align-items: center; gap: 8px; }
  .event-count { font-size: 10px; color: #333; font-style: normal; }
  .cancel-btn  { background: none; border: none; color: #555; cursor: pointer; font-size: 11px; padding: 0 3px; border-radius: 2px; }
  .cancel-btn:hover { color: #e44; }

  /* ── Input ── */
  .input-area { display: flex; gap: 6px; padding: 9px 10px; border-top: 1px solid #1a1a1a; flex-shrink: 0; }
  .chat-input { flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #ccc; font-size: 12px; font-family: inherit; padding: 7px 9px; resize: none; line-height: 1.4; }
  .chat-input:focus { outline: none; border-color: #2b5b84; }
  .chat-input:disabled { opacity: 0.5; }
  .send-btn { width: 32px; height: 32px; align-self: flex-end; background: #1a3a5a; border: 1px solid #2b5b84; border-radius: 6px; color: #58a6ff; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .send-btn:hover:not(:disabled) { background: #1e4a70; }
  .send-btn:disabled { opacity: 0.4; cursor: default; }

  /* Chat fills its container — layout handles sizing */
</style>
