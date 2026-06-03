<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { showChatPanel } from './pane';

  interface MessagePart { type: string; text?: string; }
  interface Message { id: string; role: 'user' | 'assistant'; parts: MessagePart[]; tool?: string; }
  interface Session { id: string; title?: string; }

  let connected   = $state(false);
  let checking    = $state(true);
  let sessions    = $state<Session[]>([]);
  let currentID   = $state<string | null>(null);
  let messages    = $state<Message[]>([]);
  let streamingID = $state<string | null>(null);
  let input       = $state('');
  let statusText  = $state('');
  let sending     = $state(false);
  let msgEnd: HTMLElement | undefined;

  let es: EventSource | null = null;

  // ── Helpers ────────────────────────────────────────────────────────────

  async function api(method: string, path: string, body?: unknown) {
    const res = await fetch('/api/opencode/' + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    return ct.includes('json') ? res.json() : res.text();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async function checkHealth() {
    checking = true;
    try {
      const r = await fetch('/api/opencode/global/health');
      connected = r.ok;
    } catch { connected = false; }
    checking = false;
  }

  function openEventStream() {
    if (es) { es.close(); es = null; }
    es = new EventSource('/api/opencode/event');
    es.onmessage = (e) => {
      try { handleEvent(JSON.parse(e.data)); } catch { /* ignore malformed */ }
    };
    es.onerror = () => { connected = false; };
  }

  function handleEvent(ev: { type: string; properties?: Record<string, any> }) {
    const p = ev.properties ?? {};
    if (ev.type === 'session.status') {
      if (p.sessionID === currentID) statusText = p.status ?? '';
    }
    if (ev.type === 'message.part.updated') {
      if (p.sessionID !== currentID) return;
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
        streamingID = messageID;
      }
      scrollToBottom();
    }
    if (ev.type === 'message.updated') {
      if (p.sessionID !== currentID) return;
      // Tool call display
      const toolPart = p.message?.parts?.find((pt: any) => pt.type === 'tool-invocation');
      if (toolPart?.toolName) statusText = `running: ${toolPart.toolName}`;
    }
    if (ev.type === 'session.idle') {
      if (p.sessionID === currentID) {
        statusText = '';
        streamingID = null;
        sending = false;
      }
    }
  }

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

  async function send() {
    const text = input.trim();
    if (!text || !currentID || sending) return;
    input = '';
    sending = true;
    statusText = 'thinking…';
    // Optimistic user message
    const tempID = 'tmp-' + Date.now();
    messages = [...messages, { id: tempID, role: 'user', parts: [{ type: 'text', text }] }];
    scrollToBottom();
    try {
      await api('POST', `session/${currentID}/message`, {
        parts: [{ type: 'text', text }],
      });
    } catch {
      statusText = 'Error sending — is OpenCode running?';
      sending = false;
    }
  }

  function scrollToBottom() {
    setTimeout(() => msgEnd?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  onMount(async () => {
    await checkHealth();
    if (connected) {
      openEventStream();
      await loadSessions();
      if (sessions.length > 0) await selectSession(sessions[0].id);
      else await newSession();
    }
  });

  onDestroy(() => { es?.close(); });
</script>

<div class="chat-panel">
  <div class="chat-header">
    <span class="chat-title">AI Chat</span>
    {#if connected}
      <span class="status-dot connected" title="OpenCode connected"></span>
    {:else}
      <span class="status-dot disconnected" title="OpenCode not running"></span>
    {/if}
    <button class="close-btn" onclick={() => showChatPanel.set(false)} title="Close AI chat">✕</button>
  </div>

  {#if checking}
    <div class="state-msg">Connecting to OpenCode…</div>

  {:else if !connected}
    <div class="disconnected-state">
      <div class="dc-icon">⚡</div>
      <div class="dc-title">OpenCode not running</div>
      <div class="dc-body">Start OpenCode to enable AI features:</div>
      <code class="dc-cmd">opencode serve</code>
      <button class="dc-retry" onclick={checkHealth}>Retry connection</button>
    </div>

  {:else}
    <!-- Session bar -->
    <div class="session-bar">
      <select class="session-select"
        onchange={(e) => selectSession((e.target as HTMLSelectElement).value)}>
        {#each sessions as s}
          <option value={s.id} selected={s.id === currentID}>
            {s.title || s.id.slice(0, 12) + '…'}
          </option>
        {/each}
      </select>
      <button class="new-session-btn" onclick={newSession} title="New session">＋</button>
    </div>

    <!-- Messages -->
    <div class="messages">
      {#each messages as msg (msg.id)}
        <div class="msg" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'}>
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
      <textarea
        class="chat-input"
        placeholder="Ask anything about this vault…"
        bind:value={input}
        onkeydown={handleKey}
        rows="3"
        disabled={sending}
      ></textarea>
      <button class="send-btn" onclick={send} disabled={sending || !input.trim()}
        title="Send (Enter)">
        {sending ? '…' : '↑'}
      </button>
    </div>
  {/if}
</div>

<style>
  .chat-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 36px; /* clear footer */
    width: 380px;
    background: #111;
    border-left: 1px solid #2a2a2a;
    display: flex;
    flex-direction: column;
    z-index: 400;
    box-shadow: -4px 0 24px rgba(0,0,0,0.5);
  }

  /* ── Header ── */
  .chat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #222;
    flex-shrink: 0;
  }
  .chat-title { font-size: 12px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; flex: 1; }
  .close-btn  { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; padding: 2px 4px; }
  .close-btn:hover { color: #aaa; }

  .status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .status-dot.connected    { background: #6d6; box-shadow: 0 0 4px #6d6; }
  .status-dot.disconnected { background: #555; }

  /* ── Not connected ── */
  .state-msg { padding: 24px; color: #555; font-size: 13px; text-align: center; }

  .disconnected-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px 24px;
    text-align: center;
  }
  .dc-icon  { font-size: 32px; color: #333; }
  .dc-title { font-size: 14px; font-weight: 600; color: #666; }
  .dc-body  { font-size: 12px; color: #444; }
  .dc-cmd   { display: block; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 6px 12px; font-size: 12px; color: #58a6ff; font-family: monospace; }
  .dc-retry { margin-top: 8px; padding: 6px 16px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #888; font-size: 12px; cursor: pointer; }
  .dc-retry:hover { border-color: #555; color: #ccc; }

  /* ── Session bar ── */
  .session-bar {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #1a1a1a;
    flex-shrink: 0;
  }
  .session-select {
    flex: 1;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 4px;
    color: #aaa;
    font-size: 11px;
    padding: 3px 6px;
  }
  .new-session-btn {
    background: none;
    border: 1px solid #333;
    border-radius: 4px;
    color: #666;
    font-size: 16px;
    width: 26px;
    cursor: pointer;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .new-session-btn:hover { border-color: #555; color: #aaa; }

  /* ── Messages ── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .msg { max-width: 92%; padding: 8px 11px; border-radius: 8px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .msg.user      { align-self: flex-end; background: #1a2f4a; color: #c8dfff; border-bottom-right-radius: 2px; }
  .msg.assistant { align-self: flex-start; background: #1a1a1a; color: #ccc; border-bottom-left-radius: 2px; }
  .msg-text { display: block; }
  .status-row { font-size: 11px; color: #555; padding: 2px 4px; font-style: italic; align-self: flex-start; }

  /* ── Input ── */
  .input-area {
    display: flex;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid #1a1a1a;
    flex-shrink: 0;
  }
  .chat-input {
    flex: 1;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
    color: #ccc;
    font-size: 12px;
    font-family: inherit;
    padding: 8px 10px;
    resize: none;
    line-height: 1.4;
  }
  .chat-input:focus { outline: none; border-color: #2b5b84; }
  .chat-input:disabled { opacity: 0.5; }
  .send-btn {
    width: 34px;
    height: 34px;
    align-self: flex-end;
    background: #1a3a5a;
    border: 1px solid #2b5b84;
    border-radius: 6px;
    color: #58a6ff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .send-btn:hover:not(:disabled) { background: #1e4a70; }
  .send-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .chat-panel { width: 100%; left: 0; bottom: 36px; }
  }
</style>
