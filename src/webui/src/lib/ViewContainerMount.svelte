<script lang="ts">
  /**
   * ViewContainerMount — error-isolated View Container lifecycle manager.
   *
   * Renders a container div and manages mount/unmount for the active VC.
   * - New API: calls vc.mount(el) with the actual DOM element (no RAF needed).
   * - Old API: falls back to vc.mountSidebar() with requestAnimationFrame for
   *   plugins that find their container by ID. Removed when all plugins migrate.
   * - Any throw from mount/mountSidebar is caught, displayed inline, and does
   *   NOT propagate to the shell layout.
   * - Calls vc.onDeactivate() + vc.unmount() on cleanup (effect re-run or destroy).
   */

  let { vcName }: { vcName: string } = $props();

  let containerEl   = $state<HTMLDivElement | null>(null);
  let errorMsg      = $state<string | null>(null);
  let bundleVersion = $state(0); // increment on bundle load to re-trigger effect

  $effect(() => {
    void bundleVersion; // reactive dependency — re-runs when bundle loads
    const el = containerEl;
    if (!el) return;

    errorMsg = null;
    const vc = (window as any).__dw_plugins?.get(vcName);

    // Lazy-load external plugin bundle on first activation if not yet registered.
    // Core VCs are pre-registered in layout onMount; only external plugins need this path.
    if (!vc) {
      const bundleUrl = `/api/plugin/${vcName}/client/bundle.js`;
      if (!document.querySelector(`script[src="${bundleUrl}"]`)) {
        const script = document.createElement('script');
        script.src = bundleUrl;
        script.onload  = () => { bundleVersion++; }; // triggers effect re-run
        script.onerror = () => { errorMsg = `Bundle failed to load: ${vcName}`; };
        document.head.appendChild(script);
      }
      return;
    }

    if (typeof vc.mount === 'function') {
      try {
        vc.mount(el);
        vc.onActivate?.();
      } catch (e: any) {
        errorMsg = e?.message ?? String(e);
        console.error(`[DocWright] Plugin "${vcName}" mount() threw:`, e);
      }
    } else if (typeof vc.mountSidebar === 'function') {
      // Backward compat — old plugins locate their container via #id themselves.
      // requestAnimationFrame kept for parity with old plugin expectations.
      // Remove this branch when all plugins use mount(el) (Step 3).
      requestAnimationFrame(() => {
        try {
          vc.mountSidebar();
        } catch (e: any) {
          errorMsg = e?.message ?? String(e);
          console.error(`[DocWright] Plugin "${vcName}" mountSidebar() threw:`, e);
        }
      });
    }

    return () => {
      // vc captured in this closure — always the VC that was activated here,
      // regardless of what vcName has become by the time cleanup runs.
      try { vc.onDeactivate?.(); vc.unmount?.(); } catch { /* non-fatal */ }
      // Auto-release any right panel claim this VC may have set.
      try { (window as any).__docwright?.bridge?.releaseRightPanel?.(); } catch { /* non-fatal */ }
    };
  });
</script>

{#if errorMsg}
  <div class="vc-error">
    <div class="vc-error-name">Plugin error — {vcName}</div>
    <pre class="vc-error-detail">{errorMsg}</pre>
  </div>
{/if}

<!-- id kept for backward compat: old plugins find this element by #id -->
<div
  id="{vcName}-sidebar-root"
  bind:this={containerEl}
  class="vc-container"
></div>

<style>
  .vc-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .vc-error {
    padding: 10px 14px;
    margin: 8px;
    background: rgba(218, 54, 51, 0.08);
    border-left: 3px solid #da3633;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .vc-error-name {
    font-size: 11px;
    font-weight: 600;
    color: #da3633;
    margin-bottom: 4px;
  }
  .vc-error-detail {
    font-size: 10px;
    color: #888;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
  }
</style>
