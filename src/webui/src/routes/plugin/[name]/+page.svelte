<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { showToast } from '$lib/toast.js';
  import { notifications } from '$lib/notifications.js';
  import { pluginRightHtml, pluginRightLabel, pluginRightFocus } from '$lib/pluginPanel.js';

  interface PluginMeta { name: string; displayName: string; icon: string; description: string; }

  let pluginName = $derived($page.params.name);
  let pluginInfo = $state<PluginMeta | null>(null);
  let status = $state<'loading' | 'ready' | 'no-bundle' | 'error' | 'not-found'>('loading');
  let errorMsg = $state('');
  let errorStack = $state('');

  // Error boundary — catches runtime errors thrown inside the plugin bundle
  let errorHandler: (e: ErrorEvent) => void;

  function setupBridge(name: string) {
    (window as any).__docwright = {
      pluginName: name,
      apiBase: '',
      toast: (msg: string, duration?: number) => showToast(msg, duration ?? 4000),
      notify: (opts: {
        type: 'info' | 'warning' | 'error' | 'success';
        title: string;
        message: string;
        persistent?: boolean;
      }) => notifications.add({ ...opts, persistent: opts.persistent ?? false }),
      setRightPanel: (html: string, label?: string) => {
        pluginRightHtml.set(html);
        pluginRightLabel.set(label ?? 'Info');
        pluginRightFocus.update(n => n + 1); // triggers auto-focus in layout
      },
      clearRightPanel: () => {
        pluginRightHtml.set('');
      },
    };
  }

  function setupErrorBoundary(name: string) {
    errorHandler = (e: ErrorEvent) => {
      if (e.filename && e.filename.includes(`/api/plugin/${name}/`)) {
        e.preventDefault(); // suppress browser console error
        status = 'error';
        errorMsg = e.message ?? 'Unknown plugin error';
        errorStack = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '';
      }
    };
    window.addEventListener('error', errorHandler);
  }

  function teardown() {
    if (typeof window === 'undefined') return;
    if (errorHandler) window.removeEventListener('error', errorHandler);
    delete (window as any).__docwright;
    pluginRightHtml.set('');
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

    // Load stylesheet if present
    const styleUrl = `/api/plugin/${pluginName}/client/style.css`;
    const styleProbe = await fetch(styleUrl, { method: 'HEAD' });
    if (styleProbe.ok) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = styleUrl;
      document.head.appendChild(link);
    }

    // Wire bridge and error boundary before the bundle executes
    setupBridge(pluginName);
    setupErrorBoundary(pluginName);

    const script = document.createElement('script');
    script.src = bundleUrl;
    script.onerror = () => {
      status = 'error';
      errorMsg = 'Bundle failed to load (network error or syntax error)';
    };
    script.onload = () => {
      // Only mark ready if the error boundary hasn't already caught a runtime error
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
