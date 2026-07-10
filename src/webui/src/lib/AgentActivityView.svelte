<script lang="ts">
  import { tick } from 'svelte';
  import { reduceEvents, type ActivityState } from './agent-activity-model';
  import type { OpencodeEvent } from './server/opencode-events';

  // The ordered event stream relayed from /api/ai/stream (step 2.3). All logic
  // lives in agent-activity-model (unit-tested); this is a thin view over it.
  let { events = [] as OpencodeEvent[] }: { events?: OpencodeEvent[] } = $props();

  const state: ActivityState = $derived(reduceEvents(events));

  let scroller: HTMLElement | undefined = $state();
  let pinned = $state(true); // stay pinned to bottom unless the user scrolls up

  function onScroll() {
    if (!scroller) return;
    const dist = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    pinned = dist < 48;
  }

  // Autoscroll as content grows, respecting a user scroll-up.
  $effect(() => {
    // touch reactive text so the effect re-runs as parts stream in
    void state.parts.map((p) => p.text).join('').length;
    if (pinned && scroller) {
      const el = scroller;
      tick().then(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  });

  const statusLabel = $derived(
    state.error
      ? 'error'
      : state.status === 'connecting'
        ? 'connecting…'
        : state.status === 'busy'
          ? 'working…'
          : 'idle',
  );

  function toolIcon(s?: string): string {
    return s === 'completed' ? '✓' : s === 'error' ? '✗' : s === 'running' ? '…' : '·';
  }
</script>

<div class="agent-activity">
  <div class="status-bar" data-status={state.error ? 'error' : state.status}>
    <span class="dot" aria-hidden="true"></span>
    <span class="status-label">{statusLabel}</span>
    {#if state.busGap}
      <span class="bus-gap" title="Reconnected — reconciling from the latest snapshot">reconnected · reconciling…</span>
    {/if}
  </div>

  {#if state.error}
    <div class="error-box">{state.error}</div>
  {/if}

  <div class="stream" bind:this={scroller} onscroll={onScroll}>
    {#each state.parts as part (part.id)}
      {#if part.type === 'text' && part.role === 'user'}
        <div class="prompt"><span class="tag">prompt</span>{part.text}</div>
      {:else if part.type === 'reasoning'}
        <details class="reasoning" open={state.status !== 'idle'}>
          <summary>reasoning</summary>
          <div class="reasoning-body">{part.text}</div>
        </details>
      {:else if part.type === 'text'}
        <div class="answer">{part.text}</div>
      {:else if part.type === 'step-start'}
        <div class="step step-start">▶ step</div>
      {:else if part.type === 'step-finish'}
        <div class="step step-finish">■ step</div>
      {:else if part.type === 'tool'}
        <div class="tool" data-state={part.toolState}>
          <span class="tool-icon">{toolIcon(part.toolState)}</span>
          <span class="tool-name">{part.tool ?? 'tool'}</span>
          <span class="tool-state">{part.toolState ?? ''}</span>
        </div>
      {/if}
    {/each}

    {#if state.status === 'connecting' && state.parts.length === 0}
      <div class="placeholder">connecting to the agent…</div>
    {/if}
  </div>
</div>

<style>
  .agent-activity {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font-size: 0.9rem;
  }
  .status-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--border, #ddd);
    font-size: 0.8rem;
    color: var(--muted, #666);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #9aa0a6;
  }
  .status-bar[data-status='busy'] .dot {
    background: #3b82f6;
    animation: pulse 1.2s ease-in-out infinite;
  }
  .status-bar[data-status='idle'] .dot { background: #22c55e; }
  .status-bar[data-status='connecting'] .dot { background: #f59e0b; }
  .status-bar[data-status='error'] .dot { background: #ef4444; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .bus-gap { margin-left: auto; color: #b45309; font-style: italic; }
  .error-box {
    margin: 0.4rem 0.6rem;
    padding: 0.5rem;
    border: 1px solid #ef4444;
    border-radius: 4px;
    background: #fef2f2;
    color: #b91c1c;
    white-space: pre-wrap;
  }
  .stream {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .prompt {
    background: var(--surface-2, #f1f5f9);
    border-left: 3px solid #64748b;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    white-space: pre-wrap;
  }
  .prompt .tag {
    display: inline-block;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin-right: 0.5rem;
  }
  .reasoning {
    background: #f6efdd; /* tan */
    border: 1px solid #e6d8b5;
    border-radius: 4px;
    padding: 0.3rem 0.6rem;
  }
  .reasoning summary {
    cursor: pointer;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #8a6d3b;
  }
  .reasoning-body {
    margin-top: 0.35rem;
    white-space: pre-wrap;
    color: #6b5424;
    font-size: 0.85rem;
  }
  .answer { white-space: pre-wrap; line-height: 1.45; }
  .step {
    font-size: 0.72rem;
    color: #94a3b8;
    letter-spacing: 0.03em;
  }
  .tool {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    color: #475569;
  }
  .tool[data-state='completed'] .tool-icon { color: #22c55e; }
  .tool[data-state='running'] .tool-icon { color: #3b82f6; }
  .tool[data-state='error'] .tool-icon { color: #ef4444; }
  .tool-state { color: #94a3b8; font-size: 0.72rem; }
  .placeholder { color: #94a3b8; font-style: italic; }
</style>
