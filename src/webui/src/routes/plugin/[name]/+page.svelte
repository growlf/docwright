<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { rightPanelClaim } from '$lib/pluginPanel.js';

  interface PluginMeta { name: string; displayName: string; icon: string; description: string; }

  let pluginName = $derived($page.params.name);
  let pluginInfo = $state<PluginMeta | null>(null);
  let status = $state<'loading' | 'ready' | 'no-bundle' | 'error' | 'not-found'>('loading');
  let errorMsg = $state('');
  let errorStack = $state('');

  // Error boundary — catches runtime errors thrown inside the plugin bundle
  let errorHandler: (e: ErrorEvent) => void;
  let rejectionHandler: (e: PromiseRejectionEvent) => void;
  let originalConsole: { error: typeof console.error; warn: typeof console.warn; log: typeof console.log; info: typeof console.info } | null = null;

  function setPluginName(name: string) {
    // Augment the layout bridge with the active plugin name; do not replace the bridge.
    const dw = (window as any).__docwright;
    if (dw?.bridge) dw.bridge.pluginName = name;
  }

  function setupConsoleScope(name: string) {
    if (originalConsole) return;
    const prefix = `[plugin:${name}]`;
    originalConsole = {
      error: console.error.bind(console),
      warn:  console.warn.bind(console),
      log:   console.log.bind(console),
      info:  console.info.bind(console),
    };
    console.error = (...args) => originalConsole!.error(prefix, ...args);
    console.warn  = (...args) => originalConsole!.warn(prefix, ...args);
    console.log   = (...args) => originalConsole!.log(prefix, ...args);
    console.info  = (...args) => originalConsole!.info(prefix, ...args);
  }

  function setupErrorBoundary(name: string) {
    errorHandler = (e: ErrorEvent) => {
      if (e.filename && e.filename.includes(`/api/plugin/${name}/`)) {
        e.preventDefault();
        status = 'error';
        errorMsg = e.message ?? 'Unknown plugin error';
        errorStack = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '';
      }
    };
    window.addEventListener('error', errorHandler);

    rejectionHandler = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const sig = reason?.stack ?? String(reason ?? '');
      if (sig.includes(`/api/plugin/${name}/`) || sig.includes(`plugin/${name}`)) {
        e.preventDefault();
        status = 'error';
        errorMsg = reason?.message ?? String(reason) ?? 'Unhandled promise rejection';
        errorStack = reason?.stack ? reason.stack.split('\n')[0] : '';
      }
    };
    window.addEventListener('unhandledrejection', rejectionHandler);
  }

  function teardown() {
    if (typeof window === 'undefined') return;
    if (errorHandler) window.removeEventListener('error', errorHandler);
    if (rejectionHandler) window.removeEventListener('unhandledrejection', rejectionHandler);
    if (originalConsole) {
      console.error = originalConsole.error;
      console.warn  = originalConsole.warn;
      console.log   = originalConsole.log;
      console.info  = originalConsole.info;
      originalConsole = null;
    }
    const dw = (window as any).__docwright;
    if (dw?.bridge) delete dw.bridge.pluginName;
    rightPanelClaim.set(null);
  }

  onDestroy(teardown);

  onMount(async () => {
    const res = await fetch('/api/plugins');
    if (res.ok) {
      const list: PluginMeta[] = await res.json();
      pluginInfo = list.find(p => p.name === pluginName) ?? null;
    }
    if (!pluginInfo) { status = 'not-found'; return; }

    const bundleUrl = `/api/plugin/${pluginName}/client/bundle.js`;
    const probe = await fetch(bundleUrl, { method: 'HEAD' });
    if (!probe.ok) { status = 'no-bundle'; return; }

    // Only probe for stylesheet if the plugin manifest declares one
    if (pluginInfo.clientStylesheet) {
      const styleUrl = `/api/plugin/${pluginName}/client/style.css`;
      const styleProbe = await fetch(styleUrl, { method: 'HEAD' });
      if (styleProbe.ok) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = styleUrl;
        document.head.appendChild(link);
      }
    }

    // Wire plugin name into bridge, console scope, and error boundary before bundle executes
    setPluginName(pluginName);
    setupConsoleScope(pluginName);
    setupErrorBoundary(pluginName);

    // Skip injection if pre-load already registered the plugin
    const alreadyLoaded = (window as any).__dw_plugins?.has(pluginName);
    if (alreadyLoaded) {
      if (status === 'loading') status = 'ready';
      return;
    }

    const script = document.createElement('script');
    script.src = bundleUrl;
    script.onerror = () => {
      status = 'error';
      errorMsg = 'Bundle failed to load (network error or syntax error)';
    };
    script.onload = () => {
      if (status === 'loading') status = 'ready';
    };
    document.head.appendChild(script);
  });
</script>

<div class="plugin-page">
  {#if status === 'not-found'}
    <div class="plugin-notice">Plugin <code>{pluginName}</code> not found or not installed.</div>

  {:else if pluginInfo}
    <div class="plugin-header">
      <span class="plugin-icon">{pluginInfo.icon}</span>
      <div>
        <div class="plugin-title">{pluginInfo.displayName}</div>
        <div class="plugin-desc">{pluginInfo.description}</div>
      </div>
    </div>

    <div id="plugin-root">
      {#if status === 'loading'}
        <div class="plugin-notice">Loading {pluginInfo.displayName}…</div>

      {:else if status === 'no-bundle'}
        <div class="plugin-stub">
          <div class="plugin-stub-icon">{pluginInfo.icon}</div>
          <div class="plugin-stub-label">{pluginInfo.displayName}</div>
          <div class="plugin-stub-msg">
            Plugin UI not built yet.<br>
            Run the build step in <code>plugins/{pluginInfo.name}/</code> to generate <code>client/bundle.js</code>.
          </div>
        </div>

      {:else if status === 'error'}
        <div class="plugin-stub plugin-stub-error">
          <div class="plugin-stub-icon">⚠</div>
          <div class="plugin-stub-label">Plugin error — {pluginInfo.displayName} is isolated</div>
          <div class="plugin-stub-msg">{errorMsg}</div>
          {#if errorStack}<div class="plugin-stub-stack">{errorStack}</div>{/if}
          <button class="plugin-retry" onclick={() => { status = 'loading'; errorMsg = ''; errorStack = ''; location.reload(); }}>
            Reload plugin
          </button>
        </div>
      {/if}
      <!-- bundle mounts here when status === 'ready' -->
    </div>
  {/if}
</div>

<style>
  .plugin-page { display: flex; flex-direction: column; height: 100%; }
  .plugin-header {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 20px; border-bottom: 1px solid var(--border, #1e2030);
    flex-shrink: 0;
  }
  .plugin-icon  { font-size: 26px; }
  .plugin-title { font-size: 16px; font-weight: 700; color: var(--fg, #e0e0f0); }
  .plugin-desc  { font-size: 12px; color: var(--muted, #666); margin-top: 2px; }
  #plugin-root  { flex: 1; overflow: auto; }
  .plugin-notice { padding: 32px 20px; font-size: 13px; color: var(--muted, #666); }
  .plugin-stub  {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 280px; gap: 10px;
    color: var(--muted, #555);
  }
  .plugin-stub-error { background: rgba(218,54,51,.04); border-top: 2px solid rgba(218,54,51,.3); }
  .plugin-stub-icon  { font-size: 44px; }
  .plugin-stub-label { font-size: 15px; font-weight: 600; color: var(--fg-muted, #888); }
  .plugin-stub-msg   { font-size: 12px; color: var(--muted, #555); text-align: center; max-width: 420px; line-height: 1.6; }
  .plugin-stub-stack { font-size: 10px; font-family: monospace; color: #666; opacity: 0.7; }
  .plugin-retry {
    margin-top: 8px; padding: 5px 16px;
    background: none; border: 1px solid #444; border-radius: 4px;
    color: #888; font-size: 12px; cursor: pointer;
  }
  .plugin-retry:hover { border-color: #888; color: #ccc; }

  :global(html[data-theme="light"]) {
    .plugin-header { border-bottom-color: #d0d0d0; }
    .plugin-title  { color: #1a1a2e; }
    .plugin-desc   { color: #888; }
    .plugin-stub-label { color: #555; }
    .plugin-stub-error { background: rgba(218,54,51,.03); }
    .plugin-retry  { border-color: #ccc; color: #555; }
    .plugin-retry:hover { border-color: #888; color: #222; }
  }
</style>
