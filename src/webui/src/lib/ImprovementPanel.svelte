<script lang="ts">
  import MarkdownRenderer from '../routes/MarkdownRenderer.svelte';

  let {
    improved = '',
    critique = '',
    loading = false,
    onaccept,
    ondismiss,
    onrerun,
  }: {
    improved?: string;
    critique?: string;
    loading?: boolean;
    onaccept?: (improved: string) => void;
    ondismiss?: () => void;
    onrerun?: () => void;
  } = $props();

  let showCritique = $state(false);
</script>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">
      {#if loading}Improving…{:else}AI Suggestions{/if}
    </span>
    <button class="rerun-btn" onclick={onrerun} title="Re-run improvement" disabled={loading}>↺</button>
    <button class="close-btn" onclick={ondismiss} title="Dismiss">← Props</button>
  </div>

  {#if loading}
    <div class="loading">Generating suggestions — this may take a moment…</div>
  {:else if !improved}
    <div class="empty">No suggestions yet.</div>
  {:else}
    <div class="tabs">
      <button class="tab" class:active={!showCritique} onclick={() => showCritique = false}>
        Improved
      </button>
      <button class="tab" class:active={showCritique} onclick={() => showCritique = true}>
        Critique
      </button>
    </div>

    <div class="content-scroll">
      {#if showCritique}
        <pre class="critique-text">{critique || '(No critique returned)'}</pre>
      {:else}
        <div class="improved-body">
          <MarkdownRenderer content={improved} />
        </div>
      {/if}
    </div>

    <div class="panel-footer">
      <button class="accept-btn" onclick={() => onaccept?.(improved)}
        title="Replace proposal body with the improved version and save">
        Accept
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

  .loading, .empty { padding: 24px 16px; color: $muted; font-size: 13px; text-align: center; line-height: 1.6; }

  .tabs { display: flex; border-bottom: 1px solid $border; flex-shrink: 0; }
  .tab  { flex: 1; padding: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: $muted; background: none; border: none; cursor: pointer; &:hover { color: $fg; } &.active { color: $blue; border-bottom: 2px solid $blue; } }

  .content-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .improved-body :global(h1,h2,h3) { margin-top: 1em; }
  .critique-text { white-space: pre-wrap; font-size: 12px; line-height: 1.6; color: $fg; font-family: inherit; margin: 0; }

  .panel-footer { flex-shrink: 0; display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid $border; }
  .accept-btn  { flex: 1; padding: 8px 12px; border: 1px solid $green-bdr; border-radius: 6px; background: $green-bg; color: $green; font-size: 12px; font-weight: 600; cursor: pointer; &:hover { filter: brightness(1.15); } }
  .dismiss-btn { padding: 8px 12px; border: 1px solid $border; border-radius: 6px; background: none; color: $muted; font-size: 12px; cursor: pointer; &:hover { color: $fg; border-color: $muted; } }
</style>
