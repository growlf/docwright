<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import FileTree from './FileTree.svelte';
  import GitPanel from '$lib/GitPanel.svelte';
  import { page } from '$app/stores';
  import { fileChanged } from '$lib/fileChanges';
  import { toasts, dismissToast } from '$lib/toast';
  import { showPropsPane } from '$lib/pane';

  interface ProjectEntry {
    name: string;
    path: string;
    profile: string;
    last_session?: string;
  }

  interface BrandConfig { name: string; logoPath: string | null; }

  let projects  = $state<ProjectEntry[]>([]);
  let brand     = $state<BrandConfig>({ name: 'DocWright', logoPath: null });
  let showNewMenu  = $state(false);
  let showSidebar  = $state(true);

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

<!-- Scrim behind open sidebar (mobile only) -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="sidebar-scrim" class:visible={showSidebar} onclick={toggleSidebar}></div>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div id="app" onclick={closeMenus}>
  <aside id="sidebar" class:open={showSidebar} class:collapsed={!showSidebar}>
    <div class="sidebar-header">
      <button class="sidebar-toggle" onclick={toggleSidebar} aria-label="Toggle sidebar">{showSidebar ? '◀' : '▶'}</button>
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
  </aside>
  <main id="content">
    <slot />
  </main>
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
  .sidebar-scrim {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.55); z-index: 149;
  }
  .sidebar-scrim.visible { display: block; }

  /* Desktop: scrim never shows — sidebar is inline layout, not overlay */
  @media (min-width: 769px) {
    .sidebar-scrim.visible { display: none; }
  }

  /* ── Core layout ────────────────────────────────────────────────────────── */
  #app { display: flex; height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
  #sidebar {
    width: 260px; min-width: 260px; background: #111; color: #ccc;
    display: flex; flex-direction: column; overflow-y: auto;
    transition: width 0.2s ease, min-width 0.2s ease;
  }
  #sidebar.collapsed {
    width: 32px; min-width: 32px; overflow: hidden;
  }
  /* Desktop: hover collapsed strip to peek full sidebar */
  @media (min-width: 769px) {
    #sidebar.collapsed:hover {
      width: 260px; min-width: 260px; overflow-y: auto;
    }
  }
  .sidebar-header { padding: 12px 16px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; gap: 4px; }

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
    flex-shrink: 0;
  }
  .footer-link { color: #333; text-decoration: none; }
  .footer-link:hover { color: #666; }
  .footer-sep { color: #222; }
  .sidebar-toggle { flex-shrink: 0; background: none; border: none; color: #aaa; font-size: 12px; cursor: pointer; padding: 0 4px; line-height: 1; }
  .sidebar-toggle:hover { color: #fff; }
  .new-group { position: relative; flex-shrink: 0; }
  .new-btn { background: none; border: 1px solid #444; color: #aaa; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center; }
  .new-btn:hover { background: #222; color: #fff; }
  .new-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; z-index: 1000; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
  .new-menu-item { display: block; width: 100%; background: none; border: none; color: #ccc; padding: 6px 16px; font-size: 13px; text-align: left; cursor: pointer; }
  .new-menu-item:hover { background: #2b5b84; color: #fff; }
  #content { flex: 1; overflow-y: auto; background: #1a1a1a; color: #e0e0e0; scroll-behavior: smooth; }
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

  /* ── Mobile (≤ 768px): overlay sidebar + top bar ────────────────────────── */
  @media (max-width: 768px) {
    .mobile-topbar { display: flex; }

    #sidebar {
      position: fixed; top: 0; left: -260px; height: 100vh;
      transition: left 0.2s ease; z-index: 200;
      width: 260px; min-width: 260px;
    }
    #sidebar.open { left: 0; }
    #sidebar.collapsed { width: 260px; min-width: 260px; } /* override desktop collapsed on mobile */

    #content { padding-top: 48px; } /* clear the fixed top bar */

    /* Shift toasts up from git panel area */
    .toast-container { bottom: 80px; }
  }
</style>
