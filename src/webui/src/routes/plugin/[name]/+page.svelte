<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  interface PluginMeta { name: string; displayName: string; icon: string; description: string; }

  let pluginName = $derived($page.params.name);
  let pluginInfo = $state<PluginMeta | null>(null);
  let status = $state<'loading' | 'ready' | 'no-bundle' | 'error' | 'not-found'>('loading');
  let errorMsg = $state('');

  onMount(async () => {
    const res = await fetch('/api/plugins');
    if (res.ok) {
      const list: PluginMeta[] = await res.json();
      pluginInfo = list.find(p => p.name === pluginName) ?? null;
    }
    if (!pluginInfo) { status = 'not-found'; return; }

    // Probe for client bundle
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

    // Load and execute the bundle
    try {
      const script = document.createElement('script');
      script.src = bundleUrl;
      script.onerror = () => { status = 'error'; errorMsg = 'Bundle failed to load'; };
      script.onload = () => { status = 'ready'; };
      document.head.appendChild(script);
    } catch (e) {
      status = 'error';
      errorMsg = String(e);
    }
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
        <div class="plugin-stub">
          <div class="plugin-stub-icon">⚠</div>
          <div class="plugin-stub-label">Plugin error</div>
          <div class="plugin-stub-msg">{errorMsg}</div>
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
  .plugin-stub-icon  { font-size: 44px; }
  .plugin-stub-label { font-size: 15px; font-weight: 600; color: var(--fg-muted, #888); }
  .plugin-stub-msg   { font-size: 12px; color: var(--muted, #555); text-align: center; max-width: 380px; line-height: 1.6; }

  :global(html[data-theme="light"]) {
    .plugin-header { border-bottom-color: #d0d0d0; }
    .plugin-title  { color: #1a1a2e; }
    .plugin-desc   { color: #888; }
    .plugin-stub-label { color: #555; }
  }
</style>
