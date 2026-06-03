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

  function sseUrl(path: string): string {
    return `${base()}/${path}`;
  }

  // ── Request helper ────────────────────────────────────────────────────────

  async function ocFetch(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${base()}/${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (mode === 'direct' && vaultPath) {
      headers['x-opencode-directory'] = vaultPath;
    }
    return fetch(url, {
      method,
      headers,
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

  let connected   = $state(false);
  let checking    = $state(true);
  let showSettings = $state(false);
  let procStatus  = $state<ProcStatus>('stopped');
  let starting    = $state(false);
  let startMsg    = $state('');
  let sessions    = $state<Session[]>([]);
  let currentID   = $state<string | null>(null);
  let messages    = $state<Message[]>([]);
  let input       = $state('');
  let statusText  = $state('');
  let sending     = $state(false);
  let msgEnd: HTMLElement | undefined;
  let es: EventSource | null = null;

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
    const url = sseUrl('event');
    es = new EventSource(url);
    es.onmessage = (e) => {
      try { handleEvent(JSON.parse(e.data)); } catch { /* ignore */ }
    };
    es.onerror = () => {
      connected = false;
      es?.close(); es = null;
    };
  }

  function handleEvent(ev: { type: string; properties?: Record<string, any> }) {
    const p = ev.properties ?? {};
    if (ev.type === 'session.status' && p.sessionID === currentID) {
      statusText = p.status ?? '';
    }
    if (ev.type === 'message.part.updated' && p.sessionID === currentID) {
      const { messageID, part } = p;
      if (!part?.text) return;
      const idx = messages.findIndex(m => m.id === messageID);
      if (idx >= 0) {
        const updated = [...messages];
        const existing = updated[idx].parts.find(pt => pt.type === 'text');
        if (existing) existing.text = (existing.text ?? '') + part.text;
        else updated[idx].parts.push({ type: 'text', text: part.text });
        messages = updated;
      } else {
        messages = [...messages, { id: messageID, role: 'assistant', parts: [{ type: 'text', text: part.text }] }];
      }
      scrollToBottom();
    }
    if (ev.type === 'message.updated' && p.sessionID === currentID) {
      const tool = p.message?.parts?.find((pt: any) => pt.type === 'tool-invocation');
      if (tool?.toolName) statusText = `running: ${tool.toolName}`;
    }
    if (ev.type === 'session.idle' && p.sessionID === currentID) {
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
      sessions = [s, ...sessions];
      await selectSession(s.id);
    } catch (e) { console.error('Failed to create session', e); }
  }

  async function selectSession(id: string) {
    currentID = id;
    messages = [];
    statusText = '';
    try {
      const data = await api('GET', `session/${id}/message`);
      const list = Array.isArray(data) ? data : (data.messages ?? []);
      messages = list.map((m: any) => ({
        id: m.id,
        role: m.role,
        parts: m.parts ?? [{ type: 'text', text: m.content ?? '' }],
      }));
      scrollToBottom();
    } catch { messages = []; }
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  async function send() {
    const text = input.trim();
    if (!text || !currentID || sending) return;
    input = '';
    sending = true;
    statusText = 'thinking…';
    messages = [...messages, { id: 'tmp-' + Date.now(), role: 'user', parts: [{ type: 'text', text }] }];
    scrollToBottom();
    try {
      await ocFetch('POST', `session/${currentID}/message`, {
        parts: [{ type: 'text', text }],
      });
    } catch {
      statusText = 'Send failed — is OpenCode still running?';
      sending = false;
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function scrollToBottom() {
    setTimeout(() => msgEnd?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  // ── Mount ─────────────────────────────────────────────────────────────────

  onMount(async () => {
    try {
      const r = await fetch('/api/brand');
      if (r.ok) { const d = await r.json(); vaultPath = d.vaultPath ?? ''; }
    } catch { /* non-critical */ }
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
        title={procStatus === 'running-ours' ? 'Started by DocWright (this server)' : 'Connected'}
      ></span>
      {#if procStatus === 'running-ours'}
        <button class="icon-btn" onclick={stopViaServer} title="Stop OpenCode (started by this server)">■</button>
      {/if}
    {:else}
      <span class="dot grey" title="Not connected"></span>
    {/if}
    <button class="icon-btn" onclick={() => showSettings = !showSettings} title="Connection settings">⚙</button>
    <button class="icon-btn close" onclick={() => showChatPanel.set(false)} title="Close">✕</button>
  </div>

  <!-- ── Settings ───────────────────────────────────────────────────────── -->
  {#if showSettings}
    <div class="settings-panel">
      <div class="setting-row">
        <label class="setting-label">Mode</label>
        <select class="setting-select" bind:value={mode} onchange={saveConfig}>
          <option value="direct">Direct — my local OpenCode</option>
          <option value="proxy">Proxy — server's OpenCode</option>
        </select>
      </div>
      {#if mode === 'direct'}
        <div class="setting-row">
          <label class="setting-label">OpenCode URL</label>
          <input class="setting-input" type="text" bind:value={ocUrl}
            placeholder="http://localhost:4096"
            onblur={saveConfig} />
        </div>
        <div class="setting-hint">
          Start OpenCode with CORS allowed for this page:
          <code class="setting-cmd">{serveCmd}</code>
        </div>
      {/if}
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
        {#each sessions as s}
          <option value={s.id} selected={s.id === currentID}>
            {s.title || s.id.slice(0, 14) + '…'}
          </option>
        {/each}
      </select>
      <button class="icon-btn" onclick={newSession} title="New session">＋</button>
    </div>

    <!-- Messages -->
    <div class="messages">
      {#each messages as msg (msg.id)}
        <div class="msg {msg.role}">
          {#each msg.parts as part}
            {#if part.type === 'text' && part.text}
              <span class="msg-text">{part.text}</span>
            {/if}
          {/each}
        </div>
      {/each}
      {#if statusText}
        <div class="status-row">{statusText}</div>
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
    position: fixed; top: 0; right: 0; bottom: 36px;
    width: 380px; background: #111;
    border-left: 1px solid #2a2a2a;
    display: flex; flex-direction: column;
    z-index: 400; box-shadow: -4px 0 24px rgba(0,0,0,0.5);
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
  .dot.green { background: #6d6; box-shadow: 0 0 4px #6d6; }
  .dot.grey  { background: #444; }
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
  .msg { max-width: 93%; padding: 7px 10px; border-radius: 8px; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
  .msg.user      { align-self: flex-end; background: #1a2f4a; color: #c8dfff; border-bottom-right-radius: 2px; }
  .msg.assistant { align-self: flex-start; background: #1a1a1a; color: #ccc; border-bottom-left-radius: 2px; }
  .msg-text { display: block; }
  .status-row { font-size: 11px; color: #555; padding: 1px 4px; font-style: italic; align-self: flex-start; }

  /* ── Input ── */
  .input-area { display: flex; gap: 6px; padding: 9px 10px; border-top: 1px solid #1a1a1a; flex-shrink: 0; }
  .chat-input { flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #ccc; font-size: 12px; font-family: inherit; padding: 7px 9px; resize: none; line-height: 1.4; }
  .chat-input:focus { outline: none; border-color: #2b5b84; }
  .chat-input:disabled { opacity: 0.5; }
  .send-btn { width: 32px; height: 32px; align-self: flex-end; background: #1a3a5a; border: 1px solid #2b5b84; border-radius: 6px; color: #58a6ff; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .send-btn:hover:not(:disabled) { background: #1e4a70; }
  .send-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .chat-panel { width: 100%; left: 0; }
  }
</style>
