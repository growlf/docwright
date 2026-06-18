<script lang="ts">
  import MarkdownRenderer from '../routes/MarkdownRenderer.svelte';
  import type { ImprovePhase } from '$lib/pane';

  let {
    improved = '',
    critique = '',
    loading = false,
    phase = 'improve-thinking',
    status = '',
    critiqueOnly = false,
    onaccept,
    ondismiss,
    onrerun,
  }: {
    improved?: string;
    critique?: string;
    loading?: boolean;
    phase?: ImprovePhase;
    status?: string;
    critiqueOnly?: boolean;
    onaccept?: (improved: string) => void;
    ondismiss?: () => void;
    onrerun?: () => void;
  } = $props();

  let showCritique = $state(false);
  $effect(() => {
    if (critiqueOnly) { showCritique = true; return; }
    if (phase === 'critique-streaming' || phase === 'critique-thinking') showCritique = true;
    else if (phase === 'improve-streaming' || phase === 'improve-thinking') showCritique = false;
  });

  let isStreaming = $derived(
    (phase === 'improve-streaming' || phase === 'critique-streaming') &&
    (improved.length > 0 || critique.length > 0)
  );
  let isDone = $derived(phase === 'done');
  let isImproveThinking = $derived(phase === 'improve-thinking');
  let isCritiqueThinking = $derived(phase === 'critique-thinking');

  // Progress step index for each phase
  const phaseIndex: Record<ImprovePhase, number> = {
    'improve-thinking': 0,
    'improve-streaming': 1,
    'critique-thinking': 2,
    'critique-streaming': 3,
    'done': 4,
  };

  const steps = ['Improve', 'Stream', 'Critique', 'Complete'] as const;

  function stepStatus(i: number): 'done' | 'active' | 'pending' {
    const pi = phaseIndex[phase] ?? 0;
    if (i < pi) return 'done';
    if (i === pi) return 'active';
    return 'pending';
  }
</script>

<div class="panel">
  <!-- Progress meter -->
  <div class="progress-steps">
    {#each steps as label, i}
      <div class="step" class:done={stepStatus(i) === 'done'} class:active={stepStatus(i) === 'active'} class:pending={stepStatus(i) === 'pending'}>
        <div class="step-circle">
          {#if stepStatus(i) === 'done'}
            <span class="check">&#10003;</span>
          {:else if stepStatus(i) === 'active'}
            <span class="pulse-dot"></span>
          {:else}
            <span class="pending-circle"></span>
          {/if}
        </div>
        <div class="step-label">{label}</div>
      </div>
      {#if i < steps.length - 1}
        <div class="step-connector" class:done={stepStatus(i + 1) !== 'pending'}></div>
      {/if}
    {/each}
  </div>

  <div class="panel-header">
    <span class="panel-title">
      {#if isDone}
        AI Suggestions
      {:else if isCritiqueThinking || (phase === 'critique-streaming' && critique.length === 0)}
        Critiquing&hellip; <span class="bounce-dots"><span>.</span><span>.</span><span>.</span></span>
      {:else if isStreaming}
        {showCritique ? 'Critiquing&hellip;' : 'Improving&hellip;'}
      {:else if isImproveThinking}
        Improving&hellip; <span class="bounce-dots"><span>.</span><span>.</span><span>.</span></span>
      {:else}
        AI Suggestions
      {/if}
    </span>
    {#if isDone || isStreaming}
      <button class="rerun-btn" onclick={onrerun} title="Re-run improvement" disabled={loading}>&#8635;</button>
    {/if}
    <button class="close-btn" onclick={ondismiss} title="Dismiss">&larr; Props</button>
  </div>

  <!-- Phase 1: initial loading, no text yet -->
  {#if isImproveThinking && improved.length === 0 && critique.length === 0}
    <div class="loading">
      <div class="dots-loader">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="loading-text">{status || 'Generating improvements &mdash; this may take a moment&hellip;'}</div>
    </div>

  <!-- Phase 3 gap: improved text ready, waiting for critique -->
  {:else if isCritiqueThinking && critique.length === 0 && improved.length > 0}
    <div class="tabs">
      <button class="tab" class:active={!showCritique} onclick={() => showCritique = false}>Improved</button>
      <button class="tab" class:active={showCritique} onclick={() => showCritique = true}>Critique</button>
    </div>
    <div class="content-scroll">
      {#if showCritique}
        <div class="phase-wait">
          <div class="dots-loader">
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="loading-text">{status || 'Generating critique&hellip;'}</div>
        </div>
      {:else}
        <div class="improved-body">
          <MarkdownRenderer content={improved} />
        </div>
        <div class="cursor-blink">&#9643;</div>
      {/if}
    </div>

  <!-- No content at all -->
  {:else if !improved && !critique}
    <div class="empty">No suggestions yet.</div>

  <!-- Content available — show tabs -->
  {:else}
    <div class="tabs">
      {#if !critiqueOnly}
        <button class="tab" class:active={!showCritique} onclick={() => showCritique = false}
          disabled={phase === 'critique-streaming' && critique.length === 0}>
          Improved
        </button>
      {/if}
      <button class="tab" class:active={showCritique || critiqueOnly} onclick={() => showCritique = true}
        disabled={!critiqueOnly && (phase === 'improve-thinking' || phase === 'improve-streaming')}>
        Critique
      </button>
    </div>
    <div class="content-scroll">
      {#if showCritique}
        {#if critique}
          <div class="critique-text">{critique}</div>
        {:else}
          <div class="phase-wait">
            <div class="dots-loader">
              <span></span><span></span><span></span><span></span>
            </div>
            <div class="loading-text">{status || 'Generating critique&hellip;'}</div>
          </div>
        {/if}
      {:else}
        <div class="improved-body">
          <MarkdownRenderer content={improved} />
        </div>
      {/if}
      {#if isStreaming}
        <div class="cursor-blink">&#9643;</div>
      {/if}
    </div>
  {/if}

  {#if isDone}
    <div class="panel-footer">
      {#if !critiqueOnly}
        <button class="accept-btn" onclick={() => onaccept?.(improved)}
          title="Replace proposal body with the improved version and save">
          Accept
        </button>
      {/if}
      <button class="dismiss-btn" onclick={ondismiss}>Dismiss</button>
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  /* ── Progress stepper ── */
  .progress-steps {
    display: flex;
    align-items: center;
    padding: 12px 16px 8px;
    gap: 0;
    flex-shrink: 0;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }
  .step-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .step.done .step-circle {
    background: $green;
    color: #fff;
    font-size: 10px;
  }
  .step.active .step-circle {
    background: $blue-bg;
    border: 2px solid $blue;
  }
  .step.pending .step-circle {
    border: 2px solid $border;
    background: transparent;
  }
  .step-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .step.done .step-label { color: $green; }
  .step.active .step-label { color: $blue; }
  .step.pending .step-label { color: $muted; }

  .step-connector {
    flex: 1;
    height: 2px;
    background: $border;
    margin: 0 6px;
    min-width: 12px;
  }
  .step-connector.done { background: $green; }

  .check { line-height: 1; }

  .pulse-dot {
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $blue;
    animation: step-pulse 1.2s ease-in-out infinite;
  }
  @keyframes step-pulse {
    0%, 100% { transform: scale(0.6); opacity: 0.5; }
    50% { transform: scale(1); opacity: 1; }
  }

  .pending-circle {
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: transparent;
    border: none;
  }

  /* ── Panel header ── */
  .panel-header { display: flex; align-items: center; gap: 6px; padding: 8px 16px 12px; border-bottom: 1px solid $border; flex-shrink: 0; }
  .panel-title  { @include section-header; padding: 0; flex: 1; font-size: 13px; }
  .rerun-btn    { @include flat-btn; border: 1px solid $border; border-radius: 3px; padding: 1px 6px; font-size: 13px; &:hover:not(:disabled) { color: $blue; border-color: $blue-bdr; } &:disabled { opacity: 0.4; cursor: default; } }
  .close-btn    { @include flat-btn; border: 1px solid $border; border-radius: 3px; font-size: 10px; padding: 1px 6px; white-space: nowrap; &:hover { color: $fg-dim; border-color: $muted; } }

  .loading, .empty { padding: 24px 16px; color: $muted; font-size: 13px; text-align: center; line-height: 1.6; }

  /* ── Gap between phases ── */
  .phase-wait { padding: 32px 16px; text-align: center; }

  /* ── Bouncing dots animation (panel title) ── */
  .bounce-dots span {
    animation: bounce 1.4s infinite;
    display: inline-block;
    font-size: 18px;
    line-height: 1;
  }
  .bounce-dots span:nth-child(2) { animation-delay: 0.2s; }
  .bounce-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
    40% { transform: translateY(-6px); opacity: 1; }
  }

  /* ── Four-dot pulse loader ── */
  .dots-loader {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .dots-loader span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: $blue;
    animation: pulse 1.2s ease-in-out infinite;
  }
  .dots-loader span:nth-child(2) { animation-delay: 0.15s; }
  .dots-loader span:nth-child(3) { animation-delay: 0.3s; }
  .dots-loader span:nth-child(4) { animation-delay: 0.45s; }
  @keyframes pulse {
    0%, 100% { transform: scale(0.4); opacity: 0.3; }
    50% { transform: scale(1); opacity: 1; }
  }

  .loading-text { font-size: 12px; color: $muted; }

  /* ── Tabs ── */
  .tabs { display: flex; border-bottom: 1px solid $border; flex-shrink: 0; }
  .tab  {
    flex: 1; padding: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.5px; color: $muted; background: none; border: none; cursor: pointer;
    &:hover { color: $fg; }
    &.active { color: $blue; border-bottom: 2px solid $blue; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  /* ── Content ── */
  .content-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .improved-body :global(h1), .improved-body :global(h2), .improved-body :global(h3) { margin-top: 1em; }
  .critique-text { white-space: pre-wrap; font-size: 12px; line-height: 1.6; color: $fg; font-family: inherit; margin: 0; }

  /* ── Blinking cursor (streaming indicator) ── */
  .cursor-blink {
    display: inline-block;
    color: $blue;
    font-size: 14px;
    line-height: 1;
    animation: blink 1s step-end infinite;
    margin-top: 4px;
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* ── Footer ── */
  .panel-footer { flex-shrink: 0; display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid $border; }
  .accept-btn  { flex: 1; padding: 8px 12px; border: 1px solid $green-bdr; border-radius: 6px; background: $green-bg; color: $green; font-size: 12px; font-weight: 600; cursor: pointer; &:hover { filter: brightness(1.15); } }
  .dismiss-btn { padding: 8px 12px; border: 1px solid $border; border-radius: 6px; background: none; color: $muted; font-size: 12px; cursor: pointer; &:hover { color: $fg; border-color: $muted; } }
</style>
