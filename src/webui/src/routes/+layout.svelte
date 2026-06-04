<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import FileTree from './FileTree.svelte';
  import GitPanel from '$lib/GitPanel.svelte';
  import { page } from '$app/stores';
  import { fileChanged } from '$lib/fileChanges';
  import { toasts, dismissToast } from '$lib/toast';
  import { showPropsPane, showChatPanel } from '$lib/pane';
  import ChatPanel from '$lib/ChatPanel.svelte';
  import Panel from '$lib/Panel.svelte';
  import PropertiesPane from '$lib/PropertiesPane.svelte';
  import CollationPanel from '$lib/CollationPanel.svelte';
  import { currentDoc } from '$lib/currentDoc';

  interface ProjectEntry {
    name: string;
    path: string;
    profile: string;
    last_session?: string;
  }

  interface BrandConfig { name: string; logoPath: string | null; }

  let projects     = $state<ProjectEntry[]>([]);
  let brand        = $state<BrandConfig>({ name: 'DocWright', logoPath: null });
  let showNewMenu  = $state(false);
  let showSidebar  = $state(true);
  let showRightPanel = $state(true);
  let rightTab     = $state<'properties' | 'related'>('properties');
  let collationMatches = $state<any[]>([]);
  let collationLoading = $state(false);

  // Clear collation when navigating to a new doc
  $effect(() => {
    $currentDoc.filePath;  // reactive dependency
    collationMatches = [];
    collationLoading = false;
    rightTab = 'properties';  // reset to properties tab on navigation
  });

  async function findRelated(filePath: string) {
    if (!filePath) return;
    rightTab = 'related';
    showRightPanel = true;
    collationLoading = true;
    collationMatches = [];
    const res = await fetch('/api/overlap?path=' + encodeURIComponent(filePath));
    collationLoading = false;
    if (res.ok) { const { matches } = await res.json(); collationMatches = matches; }
  }

  // Close sidebar on navigation (mobile only)
  $effect(() => {
    $page.url;
    if (window.innerWidth <= 768) showSidebar = false;
  });

  function toggleSidebar() { showSidebar = !showSidebar; }
  function closeMenus() { showNewMenu = false; }

  function newFile() {
    showNewMenu = false;
    let name = prompt('New file path (e.g. docs/my-doc.md):');
    if (!name) return;
    if (!name.endsWith('.md')) name += '.md';
    fetch('/api/write?path=' + encodeURIComponent(name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '# ' + name.replace(/\.md$/, '') + '\n\n' }),
    }).then(r => {
      if (r.ok) goto('/' + name.replace(/\.md$/, ''));
    });
  }

  function newProposal() {
    showNewMenu = false;
    let title = prompt('Proposal title:');
    if (!title) return;
    const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.md';
    const date = new Date().toISOString().slice(0, 10);
    const user = 'NetYeti';
    const host = 'phoenix';
    const content = '---\n' +
      `title: "${title}"\n` +
      `author: ${user}\n` +
      `created: ${date}\n` +
      'tags: []\n' +
      'category: []\n' +
      'complexity: ""\n' +
      'estimated_effort: ""\n' +
      'depends_on: []\n' +
      `approved: false\n` +
      `created_by: "${user}@${host}"\n` +
      'assigned_to: ""\n' +
      '---\n' +
      '\n## Problem\n\n' +
      '\n## Proposed Solution\n\n';
    fetch('/api/write?path=proposals/' + slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(r => {
      if (r.ok) goto('/proposals/' + slug.replace(/\.md$/, '') + '?new=1');
    });
  }

  function loadProjects() {
    fetch('/api/registry')
      .then(r => r.json())
      .then(data => { projects = data.projects || []; })
      .catch(() => { projects = []; });
  }

  function loadBrand() {
    fetch('/api/brand')
      .then(r => r.json())
      .then(data => { brand = data; })
      .catch(() => {});
  }

  onMount(() => {
    loadBrand();
    loadProjects();
    const es = new EventSource('/api/watch');
    es.addEventListener('filechange', (e: MessageEvent) => {
      fileChanged.set(JSON.parse(e.data));
    });
  });
</script>

<!-- Mobile top bar (hidden on desktop via CSS) -->
<div class="mobile-topbar">
  <button class="hamburger" onclick={toggleSidebar} aria-label="Toggle menu">☰</button>
  <a href="/status" class="home-btn" title="Status dashboard">⌂</a>
  <span class="mobile-title">
    {#if brand.logoPath}
      <img class="brand-logo" src="/api/brand/logo" alt={brand.name} />
    {:else}
      {brand.name}
    {/if}
  </span>
  <button class="gear-btn" onclick={() => showPropsPane.update(v => !v)} aria-label="Toggle properties">⚙</button>
</div>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div id="app" onclick={closeMenus}>
  <Panel side="left" bind:open={showSidebar}>
    <div class="sidebar-header">
      <a href="/status" class="home-btn" title="Status dashboard">⌂</a>
      <a href="/status" class="brand" title="Go to {brand.name} status">
        {#if brand.logoPath}
          <img class="brand-logo" src="/api/brand/logo" alt={brand.name} />
        {:else}
          <span class="brand-name">{brand.name}</span>
        {/if}
      </a>
      <div class="new-group">
        <button class="new-btn" onclick={(e) => { e.stopPropagation(); showNewMenu = !showNewMenu; }}>+</button>
        {#if showNewMenu}
          <div class="new-menu" onclick={(e) => e.stopPropagation()}>
            <button class="new-menu-item" onclick={newFile}>New File</button>
            <button class="new-menu-item" onclick={newProposal}>New Proposal</button>
          </div>
        {/if}
      </div>
    </div>
    <FileTree currentPath={$page.url.pathname} />
    {#if projects.length > 0}
      <div class="project-section">
        <div class="project-heading">Projects</div>
        {#each projects as p}
          <a class="project-link" href={p.path}>
            <span class="project-name">{p.name}</span>
            <span class="project-profile">{p.profile}</span>
          </a>
        {/each}
      </div>
    {/if}
    <GitPanel />
  </Panel>
  <!-- Main content + chat at bottom -->
  <main id="content">
    <div id="page-slot">
      <slot />
    </div>
    <!-- AI chat — springs up from bottom of main pane -->
    {#if $showChatPanel}
      <div id="chat-bottom" class:expanded={$showChatPanel}>
        <ChatPanel />
      </div>
    {/if}
  </main>

  <!-- Right sidebar — full height, always present -->
  <Panel side="right" bind:open={showRightPanel}>
    <div class="right-tab-bar">
      <button class="right-tab" class:active={rightTab === 'properties'}
        onclick={() => rightTab = 'properties'}>Properties</button>
      <button class="right-tab" class:active={rightTab === 'related'}
        onclick={() => { rightTab = 'related'; if (!collationMatches.length && $currentDoc.filePath) findRelated($currentDoc.filePath); }}>
        Related{collationMatches.length > 0 ? ` (${collationMatches.length})` : ''}
      </button>
    </div>

    {#if rightTab === 'properties'}
      {#key $currentDoc.filePath}
        {#if $currentDoc.frontmatter}
          <PropertiesPane
            bind:frontmatter={$currentDoc.frontmatter}
            docType={$currentDoc.docType}
            mode={$currentDoc.mode}
            onsave={$currentDoc.onSave}
            onapprove={$currentDoc.onApprove}
            onfindrelated={() => { rightTab = 'related'; findRelated($currentDoc.filePath); }}
          />
        {:else}
          <div class="right-empty">Open a document to see its properties</div>
        {/if}
      {/key}
    {:else}
      <CollationPanel
        matches={collationMatches}
        loading={collationLoading}
        oninsert={(slug, heading, content) => $currentDoc.onInsert?.(slug, heading, content)}
        onsubsume={(path) => $currentDoc.onSubsume?.(path)}
        onrecheck={() => { if ($currentDoc.filePath) findRelated($currentDoc.filePath); }}
        onclose={() => { rightTab = 'properties'; collationMatches = []; }}
      />
    {/if}
  </Panel>

  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div class="toast">
        <span class="toast-msg">{toast.message}</span>
        {#if toast.action}
          <button class="toast-action" onclick={() => { toast.action!.onclick(); dismissToast(toast.id); }}>{toast.action.label}</button>
        {/if}
        <button class="toast-close" onclick={() => dismissToast(toast.id)}>✕</button>
      </div>
    {/each}
  </div>
</div>

<!-- Chat toggle button — bottom of viewport, above footer -->
<button
  class="chat-toggle"
  class:active={$showChatPanel}
  onclick={() => showChatPanel.update(v => !v)}
  title={$showChatPanel ? 'Close AI chat' : 'Open AI chat (⚡)'}
>
  {$showChatPanel ? '✕ Chat' : '⚡ Chat'}
</button>

<footer class="app-footer">
  <a href="https://github.com/growlf/docwright" target="_blank" rel="noopener" class="footer-link">
    DocWright
  </a>
  <span class="footer-sep">·</span>
  <span>MIT License</span>
  <span class="footer-sep">·</span>
  <a href="https://github.com/growlf/docwright" target="_blank" rel="noopener" class="footer-link">
    github.com/growlf/docwright
  </a>
</footer>

<style>
  /* ── Mobile top bar ─────────────────────────────────────────────────────── */
  .mobile-topbar {
    display: none;          /* shown only at ≤ 768px */
    position: fixed; top: 0; left: 0; right: 0; height: 48px;
    align-items: center; gap: 12px; padding: 0 16px;
    background: #111; border-bottom: 1px solid #222; z-index: 150;
  }
  .hamburger {
    background: none; border: none; color: #aaa; font-size: 20px;
    cursor: pointer; padding: 0 4px; line-height: 1;
    min-width: 44px; min-height: 44px; display: flex; align-items: center;
  }
  .hamburger:hover { color: #fff; }
  .home-btn {
    background: none; border: none; color: #555; font-size: 16px; text-decoration: none;
    line-height: 1; padding: 0 2px;
  }
  .home-btn:hover { color: #aaa; }
  .mobile-title { font-size: 14px; font-weight: 600; color: #fff; flex: 1; }
  .gear-btn {
    background: none; border: none; color: #aaa; font-size: 18px;
    cursor: pointer; padding: 0 4px; line-height: 1;
    min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;
  }
  .gear-btn:hover { color: #fff; }

  /* ── Sidebar scrim (mobile only) ────────────────────────────────────────── */
  /* ── Core layout ────────────────────────────────────────────────────────── */
  #app { display: flex; flex: 1; min-height: 0; font-family: system-ui, -apple-system, sans-serif; }
  .sidebar-header { padding: 10px 12px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; gap: 4px; flex-shrink: 0; }

  .brand { flex: 1; min-width: 0; overflow: hidden; text-decoration: none; cursor: pointer; }
  .brand-name { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; }
  .brand:hover .brand-name { color: #aaa; }
  .brand:hover .brand-logo { opacity: 0.8; }
  .brand-logo { max-height: 24px; max-width: 120px; object-fit: contain; display: block; }

  .app-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 10px;
    color: #333;
    border-top: 1px solid #1a1a1a;
    background: #0d0d0d;
    flex-shrink: 0;   /* never compress — always full height */
    z-index: 50;
  }
  .footer-link { color: #333; text-decoration: none; }
  .footer-link:hover { color: #666; }
  .footer-sep { color: #222; }

  /* chat-fab replaced by chat-toggle (see above) */
  .sidebar-toggle { flex-shrink: 0; background: none; border: none; color: #aaa; font-size: 12px; cursor: pointer; padding: 0 4px; line-height: 1; }
  .sidebar-toggle:hover { color: #fff; }
  .new-group { position: relative; flex-shrink: 0; }
  .new-btn { background: none; border: 1px solid #444; color: #aaa; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center; }
  .new-btn:hover { background: #222; color: #fff; }
  .new-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; z-index: 1000; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
  .new-menu-item { display: block; width: 100%; background: none; border: none; color: #ccc; padding: 6px 16px; font-size: 13px; text-align: left; cursor: pointer; }
  .new-menu-item:hover { background: #2b5b84; color: #fff; }
  #content { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #1a1a1a; color: #e0e0e0; overflow: hidden; }
  #page-slot { flex: 1; overflow-y: auto; scroll-behavior: smooth; }
  #chat-bottom { flex-shrink: 0; height: 420px; border-top: 1px solid #2a2a2a; position: relative; }
  #chat-bottom :global(.chat-panel) { position: absolute; inset: 0; height: 100% !important; bottom: 0 !important; }

  /* Right sidebar tab bar */
  .right-tab-bar { display: flex; border-bottom: 1px solid #1e1e1e; flex-shrink: 0; }
  .right-tab { flex: 1; background: none; border: none; border-bottom: 2px solid transparent; color: #555; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 4px 6px; cursor: pointer; }
  .right-tab:hover  { color: #aaa; }
  .right-tab.active { color: #ccc; border-bottom-color: #58a6ff; }
  .right-empty { padding: 16px; font-size: 12px; color: #444; text-align: center; margin-top: 32px; }

  /* Chat toggle — replaces FAB, sits at bottom of viewport above footer */
  .chat-toggle {
    position: fixed;
    bottom: 44px;
    left: 50%;
    transform: translateX(-50%);
    padding: 5px 18px;
    background: #1a2f4a;
    border: 1px solid #2b5b84;
    border-radius: 16px;
    color: #58a6ff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    z-index: 350;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    transition: background 0.15s;
  }
  .chat-toggle:hover  { background: #1e4a70; }
  .chat-toggle.active { background: #2b5b84; }
  .toast-container { position: fixed; bottom: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 10000; }
  .toast { display: flex; align-items: center; gap: 8px; background: #222; border: 1px solid #444; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #e0e0e0; box-shadow: 0 4px 12px rgba(0,0,0,0.4); min-width: 260px; }
  .toast-msg { flex: 1; }
  .toast-action { background: none; border: 1px solid #2b5b84; color: #58a6ff; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .toast-action:hover { background: #1a3a5a; }
  .toast-close { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; padding: 0 2px; }
  .project-section { border-top: 1px solid #222; padding: 8px 0; }
  .project-heading { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 16px; white-space: nowrap; overflow: hidden; }
  .project-link { display: block; padding: 4px 16px; font-size: 13px; color: #aaa; text-decoration: none; }
  .project-link:hover { background: #1a1a1a; color: #fff; }
  .project-name { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .project-profile { font-size: 11px; color: #555; white-space: nowrap; overflow: hidden; }

  /* ── Mobile (≤ 768px) ────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .mobile-topbar { display: flex; }
    #content { padding-top: 48px; }
    .toast-container { bottom: 80px; }
  }
</style>
