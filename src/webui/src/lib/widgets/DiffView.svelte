<script lang="ts">
  /**
   * DiffView — unified and side-by-side diff renderer.
   *
   * Stub: API contract defined here; full implementation added when
   * git history / file diff viewing is built (post-Step-10).
   *
   * Usage:
   *   <DiffView diff={patchText} mode="unified" />
   *   <DiffView diff={patchText} mode="side-by-side" />
   *
   * Props:
   *   diff   — string  — unified diff text (output of git diff)
   *   mode   — 'unified' | 'side-by-side'  — default: 'unified'
   *   path   — string  — file path shown in header (optional)
   */

  let {
    diff = '',
    mode = 'unified',
    path = '',
  }: {
    diff?: string;
    mode?: 'unified' | 'side-by-side';
    path?: string;
  } = $props();

  // Parse unified diff into hunks for rendering
  type DiffLine = { type: '+' | '-' | ' ' | 'hunk'; text: string };

  let lines = $derived<DiffLine[]>(
    diff.split('\n').map(l => ({
      type: l.startsWith('+') ? '+' : l.startsWith('-') ? '-' : l.startsWith('@@') ? 'hunk' : ' ',
      text: l,
    }))
  );
</script>

<div class="diff-view diff-{mode}">
  {#if path}
    <div class="diff-header">{path}</div>
  {/if}
  {#if !diff}
    <div class="diff-empty">No diff to show.</div>
  {:else}
    <div class="diff-scroll">
      <pre class="diff-pre">{#each lines as l}<span class="dl-{l.type}">{l.text}
</span>{/each}</pre>
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .diff-view { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .diff-header {
    font-size: 11px; font-weight: 600; color: $muted;
    padding: 4px 12px; border-bottom: 1px solid $border;
    font-family: monospace; flex-shrink: 0;
  }
  .diff-empty { padding: 16px; font-size: 12px; color: $muted; }
  .diff-scroll { flex: 1; overflow: auto; }
  .diff-pre { margin: 0; font-size: 12px; font-family: monospace; line-height: 1.5; }
  .dl-\+ { display: block; background: $green-bg; color: $green; }
  .dl-- { display: block; background: $red-bg; color: $red; }
  .dl-hunk { display: block; background: $bg-3; color: $muted; }
  .dl-\  { display: block; }
</style>
