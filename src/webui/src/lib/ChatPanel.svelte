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
  import { showChatPanel, showMultiReview } from './pane';
  import SessionSidebar from './SessionSidebar.svelte';
  import { flattenTree, detectMention, filterMention } from './chat-utils';

  // ── Active document context (injected by layout) ─────────────────────────
  // currentDocPath: the filePath of the currently-open document (e.g. "plans/foo.md").
  // Empty string when on a non-document page (status, settings).
  interface Props { currentDocPath?: string; }
  let { currentDocPath = '' }: Props = $props();

  // ── Document-scoped session map ───────────────────────────────────────────
  // Maps filePath → { sessionId, lastUsed } in localStorage so each document
  // gets its own persistent chat history. Cap: MAX_DOC_SESSIONS entries (LRU eviction).
  const LS_DOC_SESSIONS = 'dw-chat-sessions';
  const MAX_DOC_SESSIONS = 20;

  type DocSessionEntry = { sessionId: string; lastUsed: number };

  function loadDocMap(): Record<string, DocSessionEntry> {
    if (typeof localStorage === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(LS_DOC_SESSIONS) ?? '{}'); }
    catch { return {}; }
  }

  function saveDocMap(map: Record<string, DocSessionEntry>) {
    if (typeof localStorage === 'undefined') return;
    const entries = Object.entries(map).sort((a, b) => b[1].lastUsed - a[1].lastUsed);
    localStorage.setItem(LS_DOC_SESSIONS, JSON.stringify(Object.fromEntries(entries.slice(0, MAX_DOC_SESSIONS))));
  }

  function docKey(filePath: string) { return filePath || '__general'; }

  function getDocSession(filePath: string): string | null {
    return loadDocMap()[docKey(filePath)]?.sessionId ?? null;
  }

  function setDocSession(filePath: string, sessionId: string) {
    const map = loadDocMap();
    map[docKey(filePath)] = { sessionId, lastUsed: Date.now() };
    saveDocMap(map);
  }

  function clearDocSession(filePath: string) {
    const map = loadDocMap();
    delete map[docKey(filePath)];
    saveDocMap(map);
  }

  // ── Types ────────────────────────────────────────────────────────────────

  interface MessagePart { type: string; text?: string; }
  interface Message { id: string; role: 'user' | 'assistant'; parts: MessagePart[]; }
  interface Session { id: string; title?: string; time?: string; tokenCount?: number; }
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

  // ── Model / provider state ─────────────────────────────────────────────────

  interface ModelOption { id: string; providerID: string; name: string; }
  interface ProviderOption { id: string; name: string; }
  let providers = $state<ProviderOption[]>([]);
  let models = $state<ModelOption[]>([]);
  let selectedModelID = $state('');
  let modelPickerOpen = $state(false);

  async function loadModels() {
    try {
      const [pData, mData] = await Promise.all([
        api('GET', 'api/provider'),
        api('GET', 'api/model'),
      ]);
      providers = Array.isArray(pData) ? pData : (pData.data ?? pData.providers ?? []);
      const rawModels = Array.isArray(mData) ? mData : (mData.data ?? []);
      models = rawModels.map((m: any) => ({ id: m.id, providerID: m.providerID, name: m.name ?? m.id }));
    } catch { /* models not critical */ }
  }

  async function changeModel(modelID: string, providerID: string) {
    selectedModelID = modelID;
    modelPickerOpen = false;
    if (!currentID) return;
    // Try PATCH first; fall back to new session
    try {
      const res = await ocFetch('PATCH', `session/${currentID}`, { modelID, providerID });
      if (!res.ok) throw new Error(`PATCH ${res.status}`);
      return;
    } catch {
      // PATCH not supported — create new session with selected model
      try {
        const s = await api('POST', 'session', { modelID, providerID });
        const id: string = s?.id ?? s?.sessionID ?? s?.session?.id ?? s?.session?.sessionID;
        if (id) {
          sessions = [{ id, title: s?.title }, ...sessions];
          await selectSession(id);
        }
      } catch { /* fallback failed */ }
    }
  }

  let groupedModels = $derived(() => {
    const g = new Map<string, ModelOption[]>();
    for (const m of models) {
      const pName = providers.find(p => p.id === m.providerID)?.name ?? m.providerID;
      if (!g.has(pName)) g.set(pName, []);
      g.get(pName)!.push(m);
    }
    return g;
  });

  // ── Token / cost tracking ──────────────────────────────────────────────────

  interface UsageInfo { inputTokens: number; outputTokens: number; cost: number; }
  let usageMap = $state(new Map<string, UsageInfo>());

  let currentUsage = $derived(currentID ? usageMap.get(currentID) : undefined);

  let sessionsWithUsage = $derived(
    vaultSessions.map(s => ({
      ...s,
      tokenCount: usageMap.has(s.id)
        ? usageMap.get(s.id)!.inputTokens + usageMap.get(s.id)!.outputTokens
        : s.tokenCount,
    }))
  );

  // ── UI state ─────────────────────────────────────────────────────────────

  let connected     = $state(false);
  let sseConnected  = $state(false);  // separate: EventSource is open and receiving
  let checking      = $state(true);
  let showSettings  = $state(false);
  let mcpRegistered = $state(false);
  let mcpEnabled    = $state(false);
  let mcpStatus     = $state('');
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

  // ── Reactive session switch on document navigation ───────────────────────
  // When the active document changes while the chat panel is open and connected,
  // switch to that document's session (or create one). Skip on initial mount
  // (checkHealth handles that) and skip when not connected.
  let prevDocPath = '';
  $effect(() => {
    const docPath = currentDocPath;
    if (!connected || docPath === prevDocPath) return;
    prevDocPath = docPath;
    const storedId = getDocSession(docPath);
    if (storedId && storedId !== currentID) {
      selectSession(storedId);
    } else if (!storedId) {
      newSession();
    }
  });

  // ── Session indicator + new-chat ─────────────────────────────────────────

  // Filename of the document the current session is bound to (empty = general session)
  let boundDocName = $derived(
    currentDocPath ? currentDocPath.split('/').filter(Boolean).pop() ?? currentDocPath : ''
  );

  async function newChat() {
    clearDocSession(currentDocPath);
    messages = [];
    currentID = null;
    await newSession();
  }

  // ── Vault-scoped sessions ──────────────────────────────────────────────────

  let vaultName = $derived(vaultPath ? vaultPath.split('/').filter(Boolean).pop() ?? vaultPath : '');
  let showAllSessions = $state(typeof localStorage !== 'undefined'
    ? localStorage.getItem('oc-show-all') === 'true'
    : false
  );

  function toggleShowAll() {
    showAllSessions = !showAllSessions;
    if (typeof localStorage !== 'undefined') localStorage.setItem('oc-show-all', String(showAllSessions));
  }

  let vaultSessions = $derived(
    showAllSessions || !vaultName
      ? sessions
      : sessions.filter(s => s.title?.startsWith(`[${vaultName}]`))
  );

  // ── @-mention state ───────────────────────────────────────────────────────

  interface FileItem { name: string; path: string; }
  interface Mention { path: string; name: string; context: string; }
  let allFiles = $state<FileItem[]>([]);
  let mentions = $state<Mention[]>([]);
  let mentionOpen = $state(false);
  let mentionQuery = $state('');
  let mentionIdx = $state(0);
  let mentionTriggerPos = $state(-1); // index of '@' in input while typing
  let mentionDebounce: ReturnType<typeof setTimeout> | null = null;
  let textareaEl: HTMLTextAreaElement | undefined = $state(undefined);

  let mentionFiltered = $derived(
    mentionQuery
      ? allFiles.filter(f =>
          f.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
          f.path.toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 50)
      : allFiles.slice(0, 50)
  );

  async function fetchFileTree() {
    try {
      const res = await fetch('/api/list');
      if (res.ok) allFiles = flattenTree(await res.json());
    } catch { /* file tree not critical */ }
  }

  async function fetchFrontmatter(path: string): Promise<string> {
    try {
      const res = await fetch(`/api/document?path=${encodeURIComponent(path)}`);
      if (!res.ok) return '';
      const data = await res.json();
      const body: string = data.body ?? data.content ?? '';
      const fmMatch = body.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) return path;
      const lines = fmMatch[1].split('\n').filter(l => l.includes(':'));
      return lines.slice(0, 8).join('\n');
    } catch { return path; }
  }

  function openMention(cursorPos: number) {
    mentionTriggerPos = cursorPos - 1; // position of '@'
    mentionQuery = '';
    mentionIdx = 0;
    mentionOpen = true;
  }

  function closeMention() {
    mentionOpen = false;
    mentionTriggerPos = -1;
    mentionQuery = '';
  }

  function selectMention(file: FileItem) {
    if (mentionTriggerPos < 0) return;
    // Remove '@query' from input
    const queryLen = mentionQuery.length + 1; // '@' + query
    input = input.slice(0, mentionTriggerPos) + input.slice(mentionTriggerPos + queryLen);
    closeMention();
    // Add chip if not already present
    if (mentions.some(m => m.path === file.path)) return;
    fetchFrontmatter(file.path).then(ctx => {
      mentions = [...mentions, { path: file.path, name: file.name, context: ctx }];
    });
  }

  function removeMention(path: string) {
    mentions = mentions.filter(m => m.path !== path);
  }

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
      await loadModels();
      // Use the document-scoped session map — reconnect to the stored session for
      // the current document, or create a new one.
      const storedId = getDocSession(currentDocPath);
      if (storedId) {
        await selectSession(storedId); // staleness handled in selectSession
      } else {
        await newSession();
      }
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
    messages = []; sessions = []; currentID = null; usageMap = new Map();
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

    // Capture usage from any SSE event that carries it
    const usageRaw = ev.usage ?? p.usage ?? p.message?.usage;
    if (usageRaw && sessionID && (usageRaw.inputTokens || usageRaw.outputTokens)) {
      usageMap = new Map(usageMap).set(sessionID, {
        inputTokens: usageRaw.inputTokens ?? 0,
        outputTokens: usageRaw.outputTokens ?? 0,
        cost: usageRaw.cost ?? 0,
      });
    }

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
      const today = new Date().toISOString().slice(0, 10);
      const title = vaultName ? `[${vaultName}] New Chat ${today}` : `New Chat ${today}`;
      const s = await api('POST', 'session', { title });
      // OpenCode may return { id } or { sessionID } or nested { session: { id } }
      const id: string = s?.id ?? s?.sessionID ?? s?.session?.id ?? s?.session?.sessionID;
      if (!id) {
        console.error('[DocWright chat] Session create returned no ID:', s);
        statusText = 'Could not get session ID — check console';
        return;
      }
      console.debug('[DocWright chat] Created session:', id);
      sessions = [{ id, title: s?.title ?? title }, ...sessions];
      setDocSession(currentDocPath, id); // bind this session to the active document
      await selectSession(id);

      // Inject DocWright system prompt so the AI knows its role, vault, and active file
      if (vaultPath || currentDocPath) {
        const vaultRoot = vaultPath;
        const absPath = currentDocPath ? `${vaultRoot}/${currentDocPath}` : '';
        const systemPrompt = [
          `You are a DocWright document assistant. The user is working in a DocWright governance vault.`,
          `Vault root: ${vaultRoot}`,
          currentDocPath ? `Active document: ${currentDocPath}` : '',
          currentDocPath ? `Absolute path for file tools: ${absPath}` : '',
          ``,
          `When the user asks you to fix, update, or improve the document:`,
          `1. Read the file first so you see its current content.`,
          `2. Show the proposed change (a diff or the new content) before writing.`,
          `3. Write the file to disk using your edit or write file tool at the absolute path above.`,
          `4. DocWright's file watcher will detect the change and refresh the UI automatically.`,
          ``,
          `Never modify these frontmatter fields — they require human approval:`,
          `  approved:, status: completed, gate_status: approved, gate_status: waived`,
        ].filter(Boolean).join('\n');
        try {
          // Send as a plain user message — OpenCode treats it as context before the conversation starts
          await ocFetch('POST', `session/${id}/message`, {
            parts: [{ type: 'text', text: systemPrompt }],
          });
        } catch { /* system prompt injection is best-effort */ }
      }
    } catch (e) {
      console.error('[DocWright chat] Session create failed:', e);
      statusText = 'Session create failed — check console';
    }
  }

  async function selectSession(id: string) {
    currentID = id;
    messages = [];
    statusText = '';
    // Touch lastUsed so this session stays at the top of the LRU eviction order
    setDocSession(currentDocPath, id);
    try {
      // Use ocFetch directly so we can inspect the status code before throwing
      const res = await ocFetch('GET', `session/${id}/message`);

      if (!res.ok) {
        // 404 / 410 = session no longer exists (OpenCode restarted or session archived)
        // Clear the stale entry and create a fresh session transparently.
        // Other 4xx/5xx = leave stored session in place (may recover on next attempt).
        if (res.status === 404 || res.status === 410) {
          console.debug('[DocWright chat] Stale session detected, recovering:', id);
          clearDocSession(currentDocPath);
          currentID = null;
          messages = [];
          await newSession();
          return;
        }
        messages = [];
        return;
      }

      const data = await res.json().catch(() => null);
      const list = Array.isArray(data) ? data : (data?.messages ?? []);
      messages = list.map((m: any) => ({
        id: m.id ?? m.messageID,
        role: normalizeRole(m.role),
        parts: m.parts ?? [{ type: 'text', text: m.content ?? '' }],
      }));
      scrollToBottom();
    } catch {
      // Network error — don't clear the stored session, it may still be valid
      messages = [];
    }
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  let sendTimeout: ReturnType<typeof setTimeout> | null = null;

  async function send() {
    let text = input.trim();
    if (!text) return;
    if (!currentID) { statusText = 'No active session — try New Session'; return; }
    if (sending) return;

    // Append context from @-mentioned files
    if (mentions.length > 0) {
      const ctxBlocks = mentions.map(m => {
        const ctx = m.context ? `\n${m.context}` : '';
        return `[Context: ${m.path}]${ctx}`;
      });
      text = ctxBlocks.join('\n\n') + '\n\n' + text;
      mentions = [];
    }

    console.debug('[DocWright chat] Sending to session', currentID, ':', text.slice(0, 60));
    input = '';
    sending = true;
    thinkingSecs = 0;
    statusText = 'thinking…';
    thinkingTimer = setInterval(() => { thinkingSecs++; }, 1000);
    messages = [...messages, { id: 'tmp-' + Date.now(), role: 'user', parts: [{ type: 'text', text }] }];
    scrollToBottom();

    // Safety timeout: if the POST doesn't resolve within 60s of starting,
    // force-clear the sending state so the UI doesn't hang.
    sendTimeout = setTimeout(() => {
      if (!sending) return;
      console.warn('[DocWright chat] Send safety timeout — forcing idle');
      sending = false;
      statusText = '';
      if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null; }
    }, 60000);

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
        // Capture usage from POST response
        const usageRaw = data.usage;
        if (usageRaw && currentID && (usageRaw.inputTokens || usageRaw.outputTokens)) {
          usageMap = new Map(usageMap).set(currentID, {
            inputTokens: usageRaw.inputTokens ?? 0,
            outputTokens: usageRaw.outputTokens ?? 0,
            cost: usageRaw.cost ?? 0,
          });
        }

        // Extract text from response parts — use as fallback if SSE didn't stream it
        const responseParts: any[] = data.parts ?? data.output?.parts ?? [];
        const textContent = responseParts
          .filter((p: any) => p.type === 'text' && normalizeRole(p.role ?? 'assistant') === 'assistant')
          .map((p: any) => p.text ?? '')
          .join('');
        if (!textContent) return;

        const msgId = data.info?.id ?? data.message?.id ?? data.id;

        // Try to find an existing assistant message to update.
        // Match by: (1) exact ID, or (2) content overlap (SSE may use a different ID).
        let target = msgId ? messages.find(m => m.id === msgId) : undefined;
        if (!target) {
          target = messages.find(m =>
            m.role === 'assistant' &&
            m.parts.some(p => p.type === 'text' && p.text && textContent.startsWith(p.text.substring(0, 80)))
          );
        }

        if (target) {
          const idx = messages.indexOf(target);
          if (idx >= 0) {
            const updated = [...messages];
            const tp = updated[idx].parts.find(p => p.type === 'text');
            if (tp) tp.text = textContent;
            messages = updated;
          }
        } else {
          // No pre-existing assistant message at all — add from POST response
          messages = [...messages, {
            id: msgId ?? `ai-${Date.now()}`,
            role: 'assistant',
            parts: [{ type: 'text', text: textContent }],
          }];
          scrollToBottom();
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
    if (mentionOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mentionIdx = Math.min(mentionIdx + 1, mentionFiltered.length - 1); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); mentionIdx = Math.max(mentionIdx - 1, 0); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (mentionFiltered[mentionIdx]) selectMention(mentionFiltered[mentionIdx]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); closeMention(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function scrollToBottom() {
    setTimeout(() => msgEnd?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  function handleInput() {
    if (!textareaEl) return;
    const cursorPos = textareaEl.selectionStart;
    const atIdx = detectMention(input, cursorPos);
    if (atIdx >= 0) {
      const query = input.slice(atIdx + 1, cursorPos);
      if (mentionDebounce) clearTimeout(mentionDebounce);
      mentionDebounce = setTimeout(() => {
        mentionQuery = query;
        mentionIdx = 0;
        mentionOpen = true;
        mentionTriggerPos = atIdx;
      }, 120);
    } else {
      if (mentionOpen) closeMention();
    }
  }

  // ── Mount ─────────────────────────────────────────────────────────────────

  async function ensureMcp() {
    try {
      const check = await fetch('/api/opencode-config');
      if (!check.ok) return;
      const state = await check.json();
      mcpStatus = state.mcpStatus ?? '';
      if (state.registered) {
        mcpRegistered = true;
        mcpEnabled = state.enabled === true;
        // Re-register if registered but enabled state is wrong
        if (!mcpEnabled && state.mcpStatus !== 'unavailable') {
          const reg = await fetch('/api/opencode-config', { method: 'POST' });
          if (reg.ok) { const d = await reg.json(); mcpEnabled = d.enabled; mcpStatus = d.mcpStatus; }
        }
        return;
      }
      // Register fresh
      const reg = await fetch('/api/opencode-config', { method: 'POST' });
      if (reg.ok) {
        const d = await reg.json();
        mcpRegistered = d.registered;
        mcpEnabled    = d.enabled;
        mcpStatus     = d.mcpStatus ?? '';
      }
    } catch { /* non-critical */ }
  }

  onMount(async () => {
    try {
      const r = await fetch('/api/brand');
      if (r.ok) { const d = await r.json(); vaultPath = d.vaultPath ?? ''; }
    } catch { /* non-critical */ }
    await ensureMcp();
    await fetchFileTree();
    await checkHealth();
  });

  onDestroy(() => { es?.close(); });
</script>

<div class="chat-panel">

  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="chat-header">
    <span class="chat-title">AI Chat</span>
    {#if boundDocName}
      <span class="session-doc-badge" title="This chat session is bound to {currentDocPath}">📄 {boundDocName}</span>
      <button class="icon-btn new-chat-btn" onclick={newChat} title="Start a new chat for this document">↺</button>
    {/if}
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
      {#if currentUsage}
        <span class="usage-badge" title={`↑ ${currentUsage.inputTokens.toLocaleString()} in · ↓ ${currentUsage.outputTokens.toLocaleString()} out · $${currentUsage.cost.toFixed(4)}`}>
          ↑ {currentUsage.inputTokens < 1000 ? currentUsage.inputTokens : (currentUsage.inputTokens / 1000).toFixed(1) + 'k'}
          ↓ {currentUsage.outputTokens < 1000 ? currentUsage.outputTokens : (currentUsage.outputTokens / 1000).toFixed(1) + 'k'}
          {#if currentUsage.cost > 0}
            ${currentUsage.cost.toFixed(2)}
          {/if}
        </span>
      {/if}
    {:else}
      <span class="dot grey" title="Not connected"></span>
    {/if}
    {#if sending}
      <button class="icon-btn abort-btn" onclick={cancelSend} title="Cancel in-flight message">✕</button>
    {/if}
    {#if models.length > 0}
      <div class="model-picker-wrapper">
        <button class="model-picker-btn" onclick={() => modelPickerOpen = !modelPickerOpen}
          title={selectedModelID || 'Select model'}>
          {selectedModelID ? models.find(m => m.id === selectedModelID)?.name ?? selectedModelID.split('/').pop() : '🧠'}
        </button>
        {#if modelPickerOpen}
          <div class="model-dropdown" onmouseleave={() => modelPickerOpen = false}>
            {#each [...groupedModels().entries()] as [providerName, providerModels]}
              <div class="model-group">
                <div class="model-group-label">{providerName}</div>
                {#each providerModels as m}
                  <button class="model-item" class:active={m.id === selectedModelID}
                    onclick={() => changeModel(m.id, m.providerID)}>
                    {m.name}
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    <button class="icon-btn" onclick={() => showMultiReview.set(true)} title="Switch to Multi-Review mode">⊞ Multi</button>
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
        {#if mcpEnabled}
          <span class="mcp-ok">✓ MCP active ({mcpStatus})</span>
        {:else if mcpRegistered}
          <span class="mcp-warn">⚠ Registered but disabled</span>
          <span class="mcp-hint">{mcpStatus === 'unavailable' ? 'Run: pip install mcp' : ''}</span>
          <button class="setting-retry" onclick={ensureMcp}>Retry</button>
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

    <!-- Session sidebar -->
    <SessionSidebar
      sessions={sessionsWithUsage}
      bind:currentID
      baseUrl={base()}
      {vaultPath}
      showAll={showAllSessions}
      onselect={(id) => selectSession(id)}
      onnew={newSession}
      onrefresh={loadSessions}
      ontoggleall={toggleShowAll}
    />
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
    <div class="input-area" style="position:relative;">
      {#if mentions.length > 0}
        <div class="mention-chips">
          {#each mentions as m}
            <span class="mention-chip" title={m.path}>
              <span class="mention-chip-label">{m.name}</span>
              <button class="mention-chip-x" onclick={() => removeMention(m.path)}>✕</button>
            </span>
          {/each}
        </div>
      {/if}

      {#if mentionOpen && mentionFiltered.length > 0}
        <div class="mention-dropdown">
          {#each mentionFiltered as file, i}
            <button class="mention-item" class:active={i === mentionIdx}
              onmousedown={() => selectMention(file)}
              onmouseenter={() => mentionIdx = i}>
              <span class="mention-item-name">{file.name}</span>
              <span class="mention-item-path">{file.path}</span>
            </button>
          {/each}
        </div>
      {/if}

      <textarea class="chat-input" placeholder="Ask anything… (Enter to send, @ to mention docs)"
        bind:value={input} onkeydown={handleKey} oninput={handleInput}
        bind:this={textareaEl} rows="3"
        disabled={sending}></textarea>
      <button class="send-btn" onclick={send}
        disabled={sending || !input.trim()} title="Send (Enter)">
        {sending ? '…' : '↑'}
      </button>
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .chat-panel { width: 100%; height: 100%; background: $bg; display: flex; flex-direction: column; overflow: hidden; }

  // Header
  .chat-header { display: flex; align-items: center; gap: 6px; padding: 9px 12px; border-bottom: 1px solid $border; flex-shrink: 0; }
  .chat-title  { @include section-header; padding: 0; flex: 1; }
  .session-doc-badge { font-size: 10px; color: $fg-dim; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
  .new-chat-btn { opacity: 0.6; &:hover { opacity: 1; } }
  .mode-badge  { font-size: 9px; padding: 1px 6px; border-radius: 8px; background: $blue-bg; color: $blue; border: 1px solid $blue-bdr; text-transform: uppercase; letter-spacing: 0.3px; &.proxy { background: $purple-bg; color: $purple; border-color: $purple-bdr; } }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot.green    { background: $green; box-shadow: 0 0 4px $green; }
  .dot.grey     { background: $border; }
  .dot.sse-ok   { background: $blue; box-shadow: 0 0 3px $blue; }
  .dot.sse-warn { background: $amber; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  .no-session-warn { padding: 4px 12px; font-size: 10px; color: $amber; background: #1a1a00; border-bottom: 1px solid #333300; }
  .icon-btn { @include flat-btn; font-size: 12px; padding: 2px 5px; border-radius: 3px; &:hover { background: $bg-hover; } &.close:hover { color: $red; } }
  .abort-btn { color: $amber; &:hover { color: $red; background: $red-bg; } }
  .usage-badge { font-size: 9px; color: $tag; background: $tag-bg; border: 1px solid $tag-bdr; border-radius: 3px; padding: 0 5px; line-height: 16px; white-space: nowrap; cursor: default; }

  // Settings
  .settings-panel { padding: 10px 14px; border-bottom: 1px solid $border; background: $bg; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; }
  .setting-row   { display: flex; align-items: center; gap: 8px; }
  .setting-label { font-size: 10px; color: $muted; text-transform: uppercase; letter-spacing: 0.3px; width: 60px; flex-shrink: 0; }
  .setting-select, .setting-input { flex: 1; background: $bg-2; border: 1px solid $border; border-radius: 4px; color: $fg-dim; font-size: 11px; padding: 3px 7px; }
  .setting-hint  { font-size: 10px; color: $muted; line-height: 1.5; }
  .setting-cmd   { display: block; margin-top: 3px; background: $bg-2; border: 1px solid $border; border-radius: 3px; padding: 4px 8px; color: $blue; font-family: monospace; font-size: 10px; word-break: break-all; }
  .setting-retry { @include act-base; align-self: flex-start; padding: 4px 12px; font-size: 11px; }
  .mcp-ok   { font-size: 11px; color: $green; }
  .mcp-warn { font-size: 11px; color: $amber; }
  .mcp-hint { font-size: 10px; color: $muted; font-family: monospace; }
  .setting-warn { font-size: 10px; color: #e87; background: #2a1500; border: 1px solid #553300; border-radius: 3px; padding: 4px 8px; code { color: $blue; font-family: monospace; } }

  // Disconnected state
  .state-msg { padding: 24px; font-size: 13px; text-align: center; &.muted { color: $muted; } }
  .dc-state  { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px 20px; text-align: center; }
  .dc-icon   { font-size: 28px; color: $border; }
  .dc-title  { font-size: 14px; font-weight: 600; color: $muted; }
  .dc-sub    { font-size: 11px; color: $muted; code { color: $blue; font-family: monospace; font-size: 10px; } }
  .dc-instructions { width: 100%; background: $bg; border: 1px solid $border; border-radius: 6px; padding: 10px 12px; text-align: left; font-size: 11px; color: $muted; p { margin: 0 0 6px; } strong { color: $fg-dim; } }
  .dc-cmd  { display: block; background: $bg-2; border: 1px solid $blue-bdr; border-radius: 4px; padding: 6px 10px; color: $blue; font-family: monospace; font-size: 11px; word-break: break-all; margin: 4px 0; }
  .dc-hint { font-size: 10px; color: $muted; &.err { color: #e87; } &.muted { color: $border; } }
  .dc-btn  { @include act-base; padding: 6px 20px; font-size: 12px; min-width: 180px; &.primary { @include act-variant($blue, $blue-bg, $blue-bdr); } &.secondary { color: $muted; font-size: 11px; } }
  .dc-or        { font-size: 10px; color: $border; }
  .dc-separator { width: 100%; border-top: 1px solid $border; margin: 4px 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .dc-spinner { width: 18px; height: 18px; border: 2px solid $blue-bdr; border-top-color: $blue; border-radius: 50%; animation: spin 0.8s linear infinite; }

  // Session bar
  .session-bar    { display: flex; gap: 6px; padding: 7px 10px; border-bottom: 1px solid $border; flex-shrink: 0; }
  .session-select { flex: 1; background: $bg-2; border: 1px solid $border; border-radius: 4px; color: $fg-dim; font-size: 11px; padding: 3px 6px; }

  // Messages
  .messages { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 7px; }
  .msg { max-width: 93%; padding: 7px 10px; border-radius: 8px; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; color: $fg; background: $bg-2; align-self: flex-start; }
  .msg.user      { align-self: flex-end; background: $blue-bg; color: #c8dfff; border-bottom-right-radius: 2px; }
  .msg.assistant,
  .msg.model     { align-self: flex-start; background: $bg-2; color: $fg; border-bottom-left-radius: 2px; }
  .msg-text { display: block; color: inherit; }
  .status-row  { font-size: 11px; color: $muted; padding: 1px 4px; font-style: italic; align-self: flex-start; display: flex; align-items: center; gap: 8px; }
  .event-count { font-size: 10px; color: $border; font-style: normal; }
  .cancel-btn  { @include flat-btn; font-size: 11px; padding: 0 3px; border-radius: 2px; &:hover { color: $red; } }

  // Input
  .input-area { display: flex; gap: 6px; padding: 9px 10px; border-top: 1px solid $border; flex-shrink: 0; }
  .chat-input { flex: 1; background: $bg-2; border: 1px solid $border; border-radius: 6px; color: $fg; font-size: 12px; font-family: inherit; padding: 7px 9px; resize: none; line-height: 1.4; &:focus { outline: none; border-color: $blue-bdr; } &:disabled { opacity: 0.5; } }
  .send-btn   { width: 32px; height: 32px; align-self: flex-end; background: $blue-bg; border: 1px solid $blue-bdr; border-radius: 6px; color: $blue; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; &:hover:not(:disabled) { background: #1e4a70; } &:disabled { opacity: 0.4; cursor: default; } }

  // @-mention
  .mention-chips  { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 0 4px; }
  .mention-chip   { display: inline-flex; align-items: center; gap: 3px; background: $blue-bg; border: 1px solid $blue-bdr; border-radius: 3px; padding: 2px 6px; font-size: 10px; color: $blue; max-width: 100%; }
  .mention-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
  .mention-chip-x { @include flat-btn; font-size: 10px; padding: 0; line-height: 1; color: $blue; opacity: 0.6; &:hover { opacity: 1; } }
  .mention-dropdown { position: absolute; bottom: 100%; left: 0; right: 0; max-height: 220px; overflow-y: auto; background: $bg-2; border: 1px solid $border; border-radius: 6px; z-index: 100; padding: 4px; margin-bottom: 4px; box-shadow: 0 -4px 12px rgba(0,0,0,.3); }
  .mention-item { display: flex; flex-direction: column; gap: 1px; width: 100%; padding: 4px 8px; font-size: 11px; text-align: left; background: transparent; border: none; border-radius: 3px; color: $fg; cursor: pointer; &.active, &:hover { background: $blue-bg; } }
  .mention-item-name { font-weight: 500; }
  .mention-item-path { font-size: 9px; color: $muted; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  // Model picker
  .model-picker-wrapper { position: relative; }
  .model-picker-btn { @include flat-btn; font-size: 11px; padding: 2px 6px; border-radius: 3px; color: $fg-dim; background: $bg-2; border: 1px solid $border; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; &:hover { color: $fg; border-color: $blue-bdr; } }
  .model-dropdown { position: absolute; top: 100%; right: 0; margin-top: 4px; background: $bg-2; border: 1px solid $border; border-radius: 6px; z-index: 100; min-width: 200px; max-height: 300px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,.3); padding: 4px; }
  .model-group { margin-bottom: 4px; &:last-child { margin-bottom: 0; } }
  .model-group-label { font-size: 9px; color: $muted; text-transform: uppercase; letter-spacing: 0.3px; padding: 4px 8px 2px; }
  .model-item { display: block; width: 100%; padding: 4px 8px; font-size: 11px; text-align: left; background: transparent; border: none; border-radius: 3px; color: $fg; cursor: pointer; &.active, &:hover { background: $blue-bg; } }
</style>
