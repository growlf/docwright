<script lang="ts">
  let {
    findings = '',
    loading = false,
    onwritetoplan,
    ondismiss,
    onrerun,
  }: {
    findings?: string;
    loading?: boolean;
    onwritetoplan?: (findings: string) => void;
    ondismiss?: () => void;
    onrerun?: () => void;
  } = $props();
</script>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">
      {#if loading}Reviewing…{:else}AI Review{/if}
    </span>
    <button class="rerun-btn" onclick={onrerun} title="Re-run critique" disabled={loading}>↺</button>
    <button class="close-btn" onclick={ondismiss} title="Close">← Props</button>
  </div>

  {#if loading}
    <div class="loading">Running adversarial critique — this may take a moment…</div>
  {:else if !findings}
    <div class="empty">No findings yet.</div>
  {:else}
    <div class="findings-scroll">
      <pre class="findings">{findings}</pre>
    </div>
    <div class="panel-footer">
      <button class="write-btn" onclick={() => onwritetoplan?.(findings)}
        title="Append findings as ## Critical Review section to the plan">
        Write to Plan
      </button>
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

  .findings-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .findings { white-space: pre-wrap; font-size: 12px; line-height: 1.6; color: $fg; font-family: inherit; margin: 0; }

  .panel-footer { flex-shrink: 0; padding: 10px 16px; border-top: 1px solid $border; }
  .write-btn { width: 100%; padding: 8px 12px; border: 1px solid $green-bdr; border-radius: 6px; background: $green-bg; color: $green; font-size: 12px; font-weight: 600; cursor: pointer; &:hover { filter: brightness(1.15); } }
</style>
