<script lang="ts">
  import { tick } from 'svelte';
  import MarkdownRenderer from '../routes/MarkdownRenderer.svelte';

  let {
    findings = '',
    status = '',
    changes = '',
    improved = '',
    loading = false,
    onaccept,
    ondismiss,
    onrerun,
  }: {
    findings?: string;
    status?: string;
    changes?: string;
    improved?: string;
    loading?: boolean;
    onaccept?: (improved: string) => void;
    ondismiss?: () => void;
    onrerun?: () => void;
  } = $props();

  let scrollEl: HTMLDivElement | undefined = $state();

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  $effect(() => {
    if (findings || loading) scrollToBottom();
  });
</script>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">
      AI Review
    </span>
    <button class="rerun-btn" onclick={onrerun} title="Re-run critique" disabled={loading}>↺</button>
    <button class="close-btn" onclick={ondismiss} title="Close">← Props</button>
  </div>

  {#if loading}
    <div class="content-scroll streaming" bind:this={scrollEl}>
      {#if status}
        <div class="status-line">{status}</div>
      {/if}
      {#if findings}
        <pre class="streaming-text">{findings}<span class="cursor">▊</span></pre>
      {:else}
        <div class="status-line">Waiting for AI response…</div>
      {/if}
    </div>
  {:else if !improved}
    {#if findings && findings.startsWith('Error:')}
      <div class="empty error">{findings}</div>
    {:else if findings && findings !== '*(No text response from AI)*'}
      <div class="empty findings-only"><pre>{findings}</pre></div>
    {:else}
      <div class="empty">No review yet.</div>
    {/if}
  {:else}
    <div class="tabs">
      <button class="tab" class:active={true} onclick={() => {}}>
        Changes
      </button>
    </div>
    <div class="content-scroll done" bind:this={scrollEl}>
      {#if changes && changes !== '(No specific changes listed)'}
        <div class="changes">
          <MarkdownRenderer content={changes} />
        </div>
        <div class="preview-label">Preview of improved plan:</div>
      {/if}
      <div class="improved-body">
        <MarkdownRenderer content={improved} />
      </div>
      <div class="critique-section">
        <div class="preview-label">Critique</div>
        <pre class="critique-text">{findings || '(No critique returned)'}</pre>
      </div>
    </div>
    <div class="panel-footer">
      <button class="accept-btn" onclick={() => onaccept?.(improved)}
        title="Replace plan body with the improved version">
        Accept Improvements
      </button>
      <button class="dismiss-btn" onclick={ondismiss}>Dismiss</button>
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .panel-header { display: flex; align-items: center; gap: 6px; padding: 12px 16px; border-bottom: 1px solid $border; flex-shrink: 0; }
  .panel-title  { @include section-header; padding: 0; flex: 1; }
  .rerun-btn    { @include flat-btn; border: 1px solid $border; border-radius: 3px; padding: 1px 6px; font-size: 13px; &:hover:not(:disabled) { color: $blue; border-color: $blue-bdr; } &:disabled { opacity: 0.4; cursor: default; } }
  .close-btn    { @include flat-btn; border: 1px solid $border; border-radius: 3px; font-size: 10px; padding: 1px 6px; white-space: nowrap; &:hover { color: $fg-dim; border-color: $muted; } }

  .empty { padding: 24px 16px; color: $muted; font-size: 13px; text-align: center; line-height: 1.6; }
  .empty.error { color: #e05a5a; text-align: left; word-break: break-word; }
  .empty.findings-only { text-align: left; pre { white-space: pre-wrap; font-size: 12px; } }

  .content-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; }

  .streaming { font-family: monospace; font-size: 12px; line-height: 1.6; color: $fg; }
  .status-line { color: $blue; font-weight: 600; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .streaming-text { white-space: pre-wrap; margin: 0; font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }
  .cursor { animation: blink 0.8s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }

  .tabs { display: flex; border-bottom: 1px solid $border; flex-shrink: 0; }
  .tab  { flex: 1; padding: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: $muted; background: none; border: none; cursor: pointer; &:hover { color: $fg; } &.active { color: $blue; border-bottom: 2px solid $blue; } }

  .changes :global(h1), .changes :global(h2), .changes :global(h3) { margin-top: 1em; font-size: 13px; }
  .changes :global(ul), .changes :global(ol) { padding-left: 18px; }
  .changes :global(li) { margin-bottom: 6px; font-size: 12px; line-height: 1.5; color: $fg; }

  .preview-label { margin-top: 16px; padding-top: 12px; border-top: 1px solid $border; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: $muted; }
  .improved-body { margin-top: 8px; }
  .improved-body :global(h1), .improved-body :global(h2), .improved-body :global(h3) { margin-top: 1em; }
  .improved-body :global(h1) { font-size: 15px; }
  .improved-body :global(h2) { font-size: 13px; }
  .improved-body :global(h3) { font-size: 12px; }
  .improved-body :global(p) { font-size: 12px; line-height: 1.5; }
  .improved-body :global(code) { font-size: 11px; }
  .improved-body :global(table) { font-size: 11px; }
  .improved-body :global(ul), .improved-body :global(ol) { padding-left: 16px; font-size: 12px; }
  .improved-body :global(li) { margin-bottom: 4px; }

  .critique-section { margin-top: 16px; }
  .critique-text { white-space: pre-wrap; font-size: 12px; line-height: 1.6; color: $fg; font-family: inherit; margin: 8px 0 0 0; }

  .panel-footer { flex-shrink: 0; display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid $border; }
  .accept-btn  { flex: 1; padding: 8px 12px; border: 1px solid $green-bdr; border-radius: 6px; background: $green-bg; color: $green; font-size: 12px; font-weight: 600; cursor: pointer; &:hover { filter: brightness(1.15); } }
  .dismiss-btn { padding: 8px 12px; border: 1px solid $border; border-radius: 6px; background: none; color: $muted; font-size: 12px; cursor: pointer; &:hover { color: $fg; border-color: $muted; } }
</style>
