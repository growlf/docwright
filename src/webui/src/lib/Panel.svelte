<script lang="ts">
  /**
   * Panel — unified side panel component.
   * Provides: open/close animation, collapsed strip, mobile overlay + scrim,
   * and a drag handle for resizing (desktop only, persisted to localStorage).
   *
   * Desktop: inline flex item, collapses to a 32px clickable strip.
   * Mobile:  position: fixed overlay sliding from the appropriate edge.
   */

  import type { Snippet } from 'svelte';

  const DEFAULT_WIDTH = { left: 260, right: 280 };
  const MIN_WIDTH     = { left: 180, right: 200 };
  const MAX_WIDTH     = { left: 480, right: 480 };

  let {
    side,
    open     = $bindable(true),
    children,
  }: {
    side:      'left' | 'right';
    open?:     boolean;
    children?: Snippet;
  } = $props();

  const LS_KEY       = $derived(`panel-open-${side}`);
  const LS_WIDTH_KEY = $derived(`panel-width-${side}`);
  const chevronClose = $derived(side === 'left' ? '‹' : '›');
  const chevronOpen  = $derived(side === 'left' ? '›' : '‹');

  let panelWidth = $state(DEFAULT_WIDTH[side]);
  let dragging   = $state(false);

  $effect.pre(() => {
    if (typeof localStorage === 'undefined') return;
    const storedOpen = localStorage.getItem(LS_KEY);
    if (storedOpen !== null) open = storedOpen === 'true';
    else open = window.innerWidth > 768;

    const storedW = localStorage.getItem(LS_WIDTH_KEY);
    if (storedW) panelWidth = Math.min(MAX_WIDTH[side], Math.max(MIN_WIDTH[side], parseInt(storedW, 10)));
  });

  function toggle() {
    open = !open;
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, String(open));
  }

  function startResize(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    const startX = e.clientX;
    const startW = panelWidth;

    function onMove(ev: MouseEvent) {
      const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
      panelWidth = Math.min(MAX_WIDTH[side], Math.max(MIN_WIDTH[side], startW + delta));
    }
    function onUp() {
      dragging = false;
      if (typeof localStorage !== 'undefined') localStorage.setItem(LS_WIDTH_KEY, String(panelWidth));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function resetWidth() {
    panelWidth = DEFAULT_WIDTH[side];
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_WIDTH_KEY);
  }
</script>

<!-- Mobile scrim — behind this panel when open -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="panel-scrim" class:visible={open} onclick={() => open = false}
  role="presentation" aria-hidden="true"></div>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="panel panel-{side}" class:open class:dragging style="--w:{panelWidth}px">

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
    <!-- Resize handle (desktop only) — drag to resize, double-click to reset -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="resize-handle resize-handle-{side}"
      onmousedown={startResize}
      ondblclick={resetWidth}
      title="Drag to resize · Double-click to reset"
      role="separator"
      aria-orientation="vertical">
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
  .panel.dragging { transition: none; user-select: none; }
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

  /* ── Resize handle (desktop only) ── */
  .resize-handle {
    position: absolute;
    top: 0; bottom: 0;
    width: 5px;
    cursor: col-resize;
    z-index: 20;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .resize-handle:hover, .panel.dragging .resize-handle { opacity: 1; }
  .resize-handle::after {
    content: '';
    position: absolute;
    top: 0; bottom: 0;
    width: 2px;
    background: var(--accent, #7c6af7);
    opacity: 0.6;
  }
  .resize-handle-left  { right: 0; }
  .resize-handle-left::after  { right: 0; }
  .resize-handle-right { left: 0; }
  .resize-handle-right::after { left: 0; }
  @media (max-width: 768px) {
    .resize-handle { display: none; }
  }
</style>
