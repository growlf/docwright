<script lang="ts">
  import { showChatPanel, showMultiReview, multiReviewResponses } from './pane';
  import SynthesisPanel from './SynthesisPanel.svelte';
  import VoteSummary from './VoteSummary.svelte';

  const DEFAULT_URL = 'http://localhost:4096';
  const MAX_COLUMNS = 4;
  const MIN_COLUMNS = 2;

  interface ColumnState {
    id: string;
    label: string;
    status: 'idle' | 'creating' | 'sending' | 'receiving' | 'done' | 'error';
    response: string;
    error?: string;
    sessionId?: string;
  }

  let ocUrl = $state(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('oc-url') ?? DEFAULT_URL
      : DEFAULT_URL
  );
  let vaultPath = $state('');
  let prompt = $state('');
  let columnCount = $state(2);
  let columns = $state<ColumnState[]>([]);
  let running = $state(false);
  let settingsOpen = $state(false);

  function base(): string {
    return ocUrl.replace(/\/$/, '');
  }

  function withDir(url: string): string {
    if (!vaultPath) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}directory=${encodeURIComponent(vaultPath)}`;
  }

  async function api(method: string, path: string, body?: unknown): Promise<any> {
    let url = `${base()}/${path}`;
    url = withDir(url);
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') ?? '';
    return ct.includes('json') ? res.json() : res.text();
  }

  async function startReview() {
    const text = prompt.trim();
    if (!text || running) return;
    running = true;

    columns = Array.from({ length: columnCount }, (_, i) => ({
      id: `col-${i}-${Date.now()}`,
      label: `Review ${i + 1}`,
      status: 'creating' as const,
      response: '',
    }));

    const sessionPromises = columns.map(async (col, i) => {
      try {
        col.status = 'creating';
        columns = [...columns];

        const sess = await api('POST', 'session', {});
        const sessionId = (sess?.id ?? sess?.sessionID) as string | undefined;
        if (!sessionId) throw new Error('No session ID returned');
        col.sessionId = sessionId;
        col.status = 'sending';
        columns = [...columns];

        const data = await api('POST', `session/${sessionId}/message`, {
          parts: [{ type: 'text', text }],
        });

        const parts: any[] = data.parts ?? data.output?.parts ?? [];
        const textContent = parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text ?? '')
          .join('');

        col.response = textContent || '(empty response)';
        col.status = 'done';
      } catch (e: any) {
        col.status = 'error';
        col.error = e.message ?? String(e);
      }
      columns = [...columns];
    });

    await Promise.allSettled(sessionPromises);
    running = false;

    multiReviewResponses.set(columns
      .filter(c => c.status === 'done' && c.response && c.response !== '(empty response)')
      .map(c => ({ label: c.label, text: c.response }))
    );
  }

  function cancelReview() {
    columns.forEach(col => {
      if (col.sessionId && (col.status === 'creating' || col.status === 'sending' || col.status === 'receiving')) {
        api('POST', `session/${col.sessionId}/abort`, {}).catch(() => {});
      }
    });
    running = false;
  }

  function setCount(n: number) {
    columnCount = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, n));
  }

  function retryColumn(col: ColumnState) {
    col.status = 'creating';
    col.response = '';
    col.error = undefined;
    col.sessionId = undefined;
    columns = [...columns];

    const text = prompt.trim();
    if (!text) return;

    (async () => {
      try {
        const sess = await api('POST', 'session', {});
        const sessionId = (sess?.id ?? sess?.sessionID) as string | undefined;
        if (!sessionId) throw new Error('No session ID returned');
        col.sessionId = sessionId;
        col.status = 'sending';
        columns = [...columns];

        const data = await api('POST', `session/${sessionId}/message`, {
          parts: [{ type: 'text', text }],
        });

        const parts: any[] = data.parts ?? data.output?.parts ?? [];
        const textContent = parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text ?? '')
          .join('');

        col.response = textContent || '(empty response)';
        col.status = 'done';
      } catch (e: any) {
        col.status = 'error';
        col.error = e.message ?? String(e);
      }
      columns = [...columns];
    })();
  }
</script>

<div class="multi-review-panel">
  <div class="mr-header">
    <span class="mr-title">Multi-Review</span>
    <div class="mr-controls">
      <div class="mr-column-select">
        <span class="mr-label">Columns:</span>
        {#each { length: MAX_COLUMNS - MIN_COLUMNS + 1 } as _, i}
          {@const n = MIN_COLUMNS + i}
          <button
            class="col-btn"
            class:active={columnCount === n}
            onclick={() => setCount(n)}
            disabled={running}
          >{n}</button>
        {/each}
      </div>
      <button class="icon-btn" onclick={() => settingsOpen = !settingsOpen} title="Settings">⚙</button>
    </div>
    <button class="icon-btn" onclick={() => showMultiReview.set(false)} title="Switch to single-chat mode">💬 Chat</button>
    <button class="icon-btn close-btn" onclick={() => { showMultiReview.set(false); showChatPanel.set(false); }} title="Close">✕</button>
  </div>

  {#if settingsOpen}
    <div class="mr-settings">
      <label class="setting-label">OpenCode URL</label>
      <input class="setting-input" type="text" bind:value={ocUrl}
        placeholder={DEFAULT_URL} />
    </div>
  {/if}

  <div class="mr-input-area">
    <textarea class="mr-input" bind:value={prompt} placeholder="Enter review prompt..."
      disabled={running}
      onkeydown={(e) => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); startReview(); } }}>
    </textarea>
    <div class="mr-input-actions">
      <span class="mr-hint">Shift+Enter to send</span>
      {#if running}
        <button class="cancel-btn" onclick={cancelReview}>Cancel</button>
      {:else}
        <button class="start-btn" onclick={startReview} disabled={!prompt.trim()}>
          Start Multi-Review
        </button>
      {/if}
    </div>
  </div>

  {#if columns.length > 0}
    <div class="mr-columns" style="--cols: {columns.length}">
      {#each columns as col}
        <div class="mr-column" class:error={col.status === 'error'}>
          <div class="col-header">
            <span class="col-label">{col.label}</span>
            <span class="col-status status-{col.status}">
              {#if col.status === 'creating'}Creating session...
              {:else if col.status === 'sending'}Sending...
              {:else if col.status === 'receiving'}Receiving...
              {:else if col.status === 'done'}✓ Done
              {:else if col.status === 'error'}✕ Error
              {:else}Idle
              {/if}
            </span>
          </div>
          <div class="col-body">
            {#if col.status === 'error'}
              <div class="col-error">
                <p>{col.error}</p>
                <button class="retry-btn" onclick={() => retryColumn(col)}>Retry</button>
              </div>
            {:else if col.response}
              <div class="col-response">{col.response}</div>
            {:else if col.status === 'idle' || col.status === 'creating' || col.status === 'sending' || col.status === 'receiving'}
              <div class="col-placeholder">
                {#if col.status === 'creating'}<span class="spinner"></span>{/if}
                <span class="muted">Waiting for response...</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    <SynthesisPanel
      responses={$multiReviewResponses}
    />
    <VoteSummary
      responses={$multiReviewResponses}
    />
  {/if}
</div>

<style>
  .multi-review-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--panel-bg, #1a1a2e);
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
  }

  .mr-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #2a2a3e);
    flex-shrink: 0;
  }

  .mr-title {
    font-weight: 600;
    font-size: 14px;
  }

  .mr-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .mr-column-select {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mr-label {
    font-size: 11px;
    opacity: 0.7;
    margin-right: 4px;
  }

  .col-btn {
    width: 24px;
    height: 22px;
    border: 1px solid var(--border-color, #2a2a3e);
    background: transparent;
    color: var(--text-primary, #e0e0e0);
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
  }

  .col-btn.active {
    background: var(--accent, #4fc3f7);
    color: #000;
    border-color: var(--accent, #4fc3f7);
  }

  .col-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .close-btn {
    margin-left: 4px;
  }

  .icon-btn {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .icon-btn:hover {
    background: var(--hover-bg, rgba(255,255,255,0.08));
    color: var(--text-primary, #e0e0e0);
  }

  .mr-settings {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #2a2a3e);
    flex-shrink: 0;
  }

  .setting-label {
    display: block;
    font-size: 11px;
    opacity: 0.7;
    margin-bottom: 4px;
  }

  .setting-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--border-color, #2a2a3e);
    background: var(--input-bg, #16213e);
    color: var(--text-primary, #e0e0e0);
    border-radius: 3px;
    font-size: 12px;
    box-sizing: border-box;
  }

  .mr-input-area {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #2a2a3e);
    flex-shrink: 0;
  }

  .mr-input {
    width: 100%;
    min-height: 60px;
    padding: 6px 8px;
    border: 1px solid var(--border-color, #2a2a3e);
    background: var(--input-bg, #16213e);
    color: var(--text-primary, #e0e0e0);
    border-radius: 3px;
    font-size: 12px;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }

  .mr-input:disabled {
    opacity: 0.6;
  }

  .mr-input-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }

  .mr-hint {
    font-size: 11px;
    opacity: 0.5;
  }

  .start-btn {
    margin-left: auto;
    padding: 4px 12px;
    border: 1px solid var(--accent, #4fc3f7);
    background: var(--accent, #4fc3f7);
    color: #000;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
  }

  .start-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .cancel-btn {
    margin-left: auto;
    padding: 4px 12px;
    border: 1px solid var(--warn, #ff7043);
    background: transparent;
    color: var(--warn, #ff7043);
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
  }

  .mr-columns {
    display: grid;
    grid-template-columns: repeat(var(--cols, 2), 1fr);
    gap: 8px;
    padding: 8px 12px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .mr-column {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color, #2a2a3e);
    border-radius: 4px;
    overflow: hidden;
    min-width: 0;
  }

  .mr-column.error {
    border-color: var(--error, #e53935);
  }

  .col-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: var(--header-bg, rgba(255,255,255,0.04));
    border-bottom: 1px solid var(--border-color, #2a2a3e);
    flex-shrink: 0;
    font-size: 11px;
  }

  .col-label {
    font-weight: 600;
  }

  .col-status {
    font-size: 10px;
    opacity: 0.7;
  }

  .status-creating, .status-sending, .status-receiving {
    color: var(--accent, #4fc3f7);
  }

  .status-done {
    color: var(--success, #66bb6a);
  }

  .status-error {
    color: var(--error, #e53935);
  }

  .col-body {
    flex: 1;
    padding: 6px 8px;
    overflow-y: auto;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .col-response {
    max-height: 100%;
  }

  .col-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 80px;
  }

  .col-error {
    color: var(--error, #e53935);
  }

  .retry-btn {
    margin-top: 6px;
    padding: 2px 8px;
    border: 1px solid var(--error, #e53935);
    background: transparent;
    color: var(--error, #e53935);
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
  }

  .muted {
    opacity: 0.5;
  }

  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-color, #2a2a3e);
    border-top-color: var(--accent, #4fc3f7);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
