<script lang="ts">
  import { tick } from 'svelte';

  let {
    steps = {} as Record<string, string>,
    sections = {} as Record<string, string>,
    overview = '',
    status = '',
    loading = false,
    ondismiss,
    onrerun,
  }: {
    steps?: Record<string, string>;
    sections?: Record<string, string>;
    overview?: string;
    status?: string;
    loading?: boolean;
    ondismiss?: () => void;
    onrerun?: () => void;
  } = $props();

  let scrollEl: HTMLDivElement | undefined = $state();

  let elapsed = $state(0);
  let elapsedTimer: ReturnType<typeof setInterval> | undefined = $state();

  $effect(() => {
    if (loading) {
      elapsed = 0;
      elapsedTimer = setInterval(() => elapsed++, 1000);
    } else {
      if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = undefined; }
    }
    return () => { if (elapsedTimer) clearInterval(elapsedTimer); };
  });

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  $effect(() => {
    if (loading) scrollToBottom();
  });

  const stepNumbers = $derived(
    Object.keys(steps).sort((a, b) => Number(a) - Number(b))
  );
  const sectionKeys = $derived(Object.keys(sections));

  function groupLabel(key: string): string {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
</script>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">AI Review</span>
    <button class="rerun-btn" onclick={onrerun} title="Re-run critique" disabled={loading}>↺</button>
    <button class="close-btn" onclick={ondismiss} title="Close">← Props</button>
  </div>

  <div class="content-scroll" class:streaming={loading} bind:this={scrollEl}>
    {#if loading}
      <div class="status-line">{status || 'Reviewing plan...'} <span class="elapsed">({elapsed}s)</span></div>
    {/if}

    {#if stepNumbers.length > 0 || sectionKeys.length > 0 || overview}
      {#if stepNumbers.length > 0}
        <div class="group">
          <div class="group-header">Steps</div>
          {#each stepNumbers as num (num)}
            <div class="item" class:done={steps[num] && !steps[num].startsWith('Error:')} class:error={steps[num].startsWith('Error:')}>
              <span class="item-icon">{steps[num].startsWith('Error:') ? '⚠' : '✅'}</span>
              <span class="item-label">Step {num}</span>
              <pre class="item-text">{steps[num]}</pre>
            </div>
          {/each}
        </div>
      {/if}

      {#if sectionKeys.length > 0}
        <div class="group">
          <div class="group-header">Sections</div>
          {#each sectionKeys as key (key)}
            <div class="item" class:done={sections[key] && !sections[key].startsWith('Error:')} class:error={sections[key].startsWith('Error:')}>
              <span class="item-icon">{sections[key].startsWith('Error:') ? '⚠' : '✅'}</span>
              <span class="item-label">{groupLabel(key)}</span>
              <pre class="item-text">{sections[key]}</pre>
            </div>
          {/each}
        </div>
      {/if}

      {#if overview}
        <div class="group">
          <div class="group-header">Overall Assessment</div>
          <pre class="overview-text" class:error={overview.startsWith('Error:')}>{overview}</pre>
        </div>
      {/if}
    {:else if !loading}
      <div class="empty">
        <div>No review yet.</div>
        <button class="run-btn" onclick={onrerun}>Run Review</button>
      </div>
    {/if}
  </div>

  {#if !loading && (stepNumbers.length > 0 || sectionKeys.length > 0 || overview)}
    <div class="panel-footer">
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
  .run-btn { margin-top: 12px; padding: 8px 20px; border: 1px solid $blue-bdr; border-radius: 6px; background: $blue-bg; color: $blue; font-size: 13px; font-weight: 600; cursor: pointer; &:hover { filter: brightness(1.3); } }

  .content-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .content-scroll.streaming { font-family: monospace; font-size: 12px; line-height: 1.6; color: $fg; }

  .status-line { color: $blue; font-weight: 600; margin-bottom: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .status-line .elapsed { font-weight: 400; opacity: 0.7; }

  .group { margin-bottom: 16px; &:last-child { margin-bottom: 0; } }

  .group-header { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: $muted; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid $border; }

  .item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; margin-bottom: 4px; border-radius: 4px; background: $bg-2; }
  .item.done { border-left: 2px solid $green; }
  .item.error { border-left: 2px solid $red; }

  .item-icon { flex-shrink: 0; font-size: 12px; line-height: 1.5; }
  .item-label { flex-shrink: 0; font-size: 11px; font-weight: 600; color: $fg-dim; line-height: 1.5; min-width: 48px; }
  .item-text { flex: 1; font-family: inherit; font-size: 12px; line-height: 1.5; color: $fg; white-space: pre-wrap; margin: 0; }

  .overview-text { font-family: inherit; font-size: 12px; line-height: 1.6; color: $fg; white-space: pre-wrap; margin: 0; padding: 8px; background: $bg-2; border-radius: 4px; }
  .overview-text.error { color: $red; }

  .panel-footer { flex-shrink: 0; display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid $border; justify-content: flex-end; }
  .dismiss-btn { padding: 8px 12px; border: 1px solid $border; border-radius: 6px; background: none; color: $muted; font-size: 12px; cursor: pointer; &:hover { color: $fg; border-color: $muted; } }
</style>
