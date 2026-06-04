<script lang="ts">
  /**
   * Panel — unified side panel component.
   * Provides: open/close animation, collapsed strip, mobile overlay + scrim.
   * Children provide all inner content (header, body, tabs, etc.).
   *
   * Desktop: inline flex item, collapses to a 32px clickable strip.
   * Mobile:  position: fixed overlay sliding from the appropriate edge.
   */

  import type { Snippet } from 'svelte';

  let {
    side,
    width    = side === 'left' ? 260 : 280,
    open     = $bindable(true),
    children,
  }: {
    side:      'left' | 'right';
    width?:    number;
    open?:     boolean;
    children?: Snippet;
  } = $props();

  const LS_KEY       = $derived(`panel-open-${side}`);
  const chevronClose = $derived(side === 'left' ? '‹' : '›');
  const chevronOpen  = $derived(side === 'left' ? '›' : '‹');

  $effect.pre(() => {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(LS_KEY);
    if (stored !== null) {
      open = stored === 'true';
    } else {
      open = window.innerWidth > 768;
    }
  });

  function toggle() {
    open = !open;
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, String(open));
  }
</script>

<!-- Mobile scrim — behind this panel when open -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="panel-scrim" class:visible={open} onclick={() => open = false}
  role="presentation" aria-hidden="true"></div>

<div class="panel panel-{side}" class:open style="--w:{width}px">

  <!-- Collapsed strip (desktop only — click to reopen) -->
  {#if !open}
    <button class="panel-strip" onclick={toggle}
      title="Open {side} panel" aria-label="Open {side} panel">
      {chevronOpen}
    </button>
  {/if}

  <!-- Panel content + toggle button overlay on the inner edge -->
  {#if open}
    <div class="panel-content">
      {@render children?.()}
    </div>
    <button class="panel-edge-toggle panel-edge-{side}" onclick={toggle}
      title="Collapse panel" aria-label="Collapse panel">
      {chevronClose}
    </button>
  {/if}

</div>

<style>
  /* ── Mobile scrim ── */
  .panel-scrim { display: none; }
  @media (max-width: 768px) {
    .panel-scrim {
      display: block;
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 190;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    .panel-scrim.visible { opacity: 1; pointer-events: auto; }
  }

  /* ── Panel base ── */
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    background: #111;
    flex-shrink: 0;
    transition: width 0.2s ease;
  }
  .panel-left  { width: var(--w); border-right: 1px solid #222; }
  .panel-right { width: var(--w); border-left:  1px solid #2a2a2a; }
  .panel-left:not(.open)  { width: 32px; }
  .panel-right:not(.open) { width: 32px; }

  /* ── Mobile overlay ── */
  @media (max-width: 768px) {
    .panel {
      position: fixed !important;
      top: 0; bottom: 36px;
      width: var(--w) !important;
      z-index: 200;
      transition: transform 0.2s ease;
    }
    .panel-left  { left: 0;  transform: translateX(-100%); }
    .panel-right { right: 0; transform: translateX(100%);  }
    .panel.open  { transform: translateX(0) !important; }
  }

  /* ── Collapsed strip (desktop, closed state) ── */
  .panel-strip {
    width: 32px;
    height: 100%;
    background: none;
    border: none;
    color: #444;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .panel-strip:hover { background: #1a1a1a; color: #888; }

  /* ── Content area ── */
  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  /* ── Edge toggle button (sits on inner edge when open) ── */
  .panel-edge-toggle {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 40px;
    background: #1a1a1a;
    border: 1px solid #333;
    color: #444;
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 0;
  }
  .panel-edge-toggle:hover { color: #aaa; background: #222; }
  .panel-edge-left  { right: -1px; border-radius: 0 4px 4px 0; }
  .panel-edge-right { left:  -1px; border-radius: 4px 0 0 4px; }

  /* On mobile: hide the edge toggle — panel closes via scrim */
  @media (max-width: 768px) {
    .panel-edge-toggle { display: none; }
  }
</style>
