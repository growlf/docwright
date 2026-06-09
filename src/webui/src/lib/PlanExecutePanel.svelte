<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { showExecutionPanel, executingPlanName } from './pane';

  interface Step {
    stepNumber: number;
    action: string;
    status: 'pending' | 'done' | 'failed' | 'executing';
  }

  let steps = $state<Step[]>([]);
  let logs = $state<string[]>([]);
  let status = $state('Initializing…');
  let currentStep = $state(0);
  let error = $state<string | null>(null);
  let isDone = $state(false);
  let waitingForUser = $state<string | null>(null);
  let currentSessionId = $state<string | null>(null);
  let userResponse = $state('');
  let logEl: HTMLElement | null = $state(null);
  let abortController: AbortController | null = null;

  // Auto-scroll logs
  $effect(() => {
    if (logs.length && logEl) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  });

  async function connect() {
    if (!$executingPlanName) return;
    
    error = null;
    isDone = false;
    waitingForUser = null;
    status = 'Starting executor…';
    logs = [];

    abortController = new AbortController();

    try {
      const res = await fetch('/api/plan-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `plans/${$executingPlanName}.md` }),
        signal: abortController.signal
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find(l => l.startsWith('event: '));
          const dataLine = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;

          const event = eventLine ? eventLine.slice(7).trim() : '';
          const data = JSON.parse(dataLine.slice(6));

          if (event === 'status') {
            status = data.message;
            if (data.steps) steps = data.steps;
          } else if (event === 'log') {
            logs = [...logs, data.text];
          } else if (event === 'step_done') {
            const idx = steps.findIndex(s => s.stepNumber === data.step);
            if (idx !== -1) steps[idx].status = 'done';
            currentStep = data.step;
          } else if (event === 'waiting_for_user') {
            waitingForUser = data.message;
            currentSessionId = data.sessionId;
          } else if (event === 'error') {
            error = data.message;
            break;
          } else if (event === 'done') {
            status = data.message || 'Execution complete';
            isDone = true;
          }
        }
        if (error) break;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      error = e.message || 'Connection lost';
    }
  }

  async function submitResponse() {
    if (!userResponse.trim() || !currentSessionId) return;
    const msg = userResponse;
    const sid = currentSessionId;
    userResponse = '';
    const prompt = waitingForUser;
    waitingForUser = null;
    
    logs = [...logs, `\n> HUMAN: ${msg}\n`];

    try {
      const res = await fetch('/api/plan-execute-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          message: msg
        })
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e: any) {
      error = `Failed to send response: ${e.message}`;
      waitingForUser = prompt; // Restore prompt so user can retry
    }
  }

  onMount(() => {
    connect();
  });

  onDestroy(() => {
    abortController?.abort();
  });

  function close() {
    showExecutionPanel.set(false);
  }

  function retry() {
    logs = [];
    connect();
  }
</script>

<div class="exec-panel">
  <div class="exec-header">
    <div class="title-row">
      <h3>Executing: {$executingPlanName}</h3>
      <button class="close-btn" onclick={close}>×</button>
    </div>
    
    <div class="status-bar" class:error={!!error} class:done={isDone}>
      <div class="status-text">{status}</div>
      {#if steps.length > 0}
        <div class="progress-outer">
          <div class="progress-inner" style="width: {(steps.filter(s => s.status === 'done').length / steps.length) * 100}%"></div>
        </div>
      {/if}
    </div>
  </div>

  <div class="exec-body">
    <div class="steps-list">
      <h4>Steps</h4>
      {#each steps as step}
        <div class="step-item" class:active={step.stepNumber === currentStep + 1} class:done={step.status === 'done'}>
          <span class="step-num">{step.stepNumber}</span>
          <span class="step-action">{step.action}</span>
          {#if step.status === 'done'}
            <span class="step-badge done">✅</span>
          {:else if step.status === 'failed'}
            <span class="step-badge fail">❌</span>
          {:else if step.stepNumber === currentStep + 1 && !error && !isDone}
            <span class="step-badge run">⏳</span>
          {/if}
        </div>
      {/each}
    </div>

    <div class="log-area" bind:this={logEl}>
      {#each logs as log}
        <pre>{log}</pre>
      {/each}
      {#if !logs.length}
        <div class="empty-logs">Awaiting log output…</div>
      {/if}
    </div>
  </div>

  {#if waitingForUser}
    <div class="waiting-overlay">
      <div class="waiting-prompt">
        <div class="prompt-header">Input Required</div>
        <div class="prompt-text">{waitingForUser}</div>
        <div class="prompt-input">
          <textarea bind:value={userResponse} placeholder="Type your response here…" onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submitResponse())}></textarea>
          <button onclick={submitResponse} disabled={!userResponse.trim()}>Send</button>
        </div>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="error-footer">
      <div class="error-msg">{error}</div>
      <button class="retry-btn" onclick={retry}>Retry</button>
    </div>
  {/if}

  {#if isDone}
    <div class="done-footer">
      <div class="done-msg">Plan execution complete!</div>
      <button class="close-btn-large" onclick={close}>Close</button>
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .exec-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: $bg;
    color: $fg;
    position: relative;
  }

  .exec-header {
    padding: 12px;
    border-bottom: 1px solid $border;
    background: $bg-2;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    h3 { margin: 0; font-size: 14px; color: $blue; }
  }

  .close-btn {
    background: none;
    border: none;
    color: $muted;
    font-size: 20px;
    cursor: pointer;
    &:hover { color: $fg; }
  }

  .status-bar {
    .status-text { font-size: 12px; margin-bottom: 6px; color: $fg-dim; }
    &.error .status-text { color: $red; }
    &.done .status-text { color: $green; }
  }

  .progress-outer {
    height: 4px;
    background: $border;
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-inner {
    height: 100%;
    background: $blue;
    transition: width 0.3s ease;
  }

  .exec-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .steps-list {
    width: 200px;
    border-right: 1px solid $border;
    padding: 12px;
    overflow-y: auto;
    h4 { margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; color: $muted; }
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    padding: 6px 0;
    color: $muted;
    &.active { color: $fg; font-weight: 500; }
    &.done { color: $fg-dim; }
  }

  .step-num {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $bg-2;
    border: 1px solid $border;
    border-radius: 50%;
    font-size: 10px;
  }

  .step-action { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .log-area {
    flex: 1;
    background: #0d1117;
    color: #e6edf3;
    padding: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    overflow-y: auto;
    white-space: pre-wrap;
    pre { margin: 0; padding: 0; line-height: 1.4; }
  }

  .empty-logs { color: #484f58; font-style: italic; }

  .waiting-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 10;
  }

  .waiting-prompt {
    background: $bg-2;
    border: 1px solid $amber-bdr;
    border-radius: 8px;
    width: 100%;
    max-width: 500px;
    padding: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .prompt-header { color: $amber; font-weight: bold; margin-bottom: 8px; font-size: 12px; }
  .prompt-text { font-size: 13px; margin-bottom: 16px; line-height: 1.4; }
  
  .prompt-input {
    display: flex;
    flex-direction: column;
    gap: 10px;
    textarea {
      background: $bg;
      border: 1px solid $border;
      border-radius: 4px;
      color: $fg;
      padding: 8px;
      font-size: 12px;
      min-height: 80px;
      resize: vertical;
      &:focus { outline: none; border-color: $blue-bdr; }
    }
    button {
      align-self: flex-end;
      background: $blue;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      cursor: pointer;
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  }

  .error-footer, .done-footer {
    padding: 12px;
    border-top: 1px solid $border;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .error-footer { background: #2a0000; }
  .error-msg { color: $red; font-size: 12px; }
  .retry-btn { @include act-base; @include act-variant($red, $red-bg, $red-bdr); }

  .done-footer { background: #002a00; }
  .done-msg { color: $green; font-size: 13px; font-weight: bold; }
  .close-btn-large { @include act-base; @include act-variant($green, $green-bg, $green-bdr); }
</style>
