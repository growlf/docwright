<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import FileTree from './FileTree.svelte';
  import GitPanel from '$lib/GitPanel.svelte';
  import { page } from '$app/stores';
  import { fileChanged } from '$lib/fileChanges';
  import { toasts, dismissToast } from '$lib/toast';
  import { showPropsPane, showChatPanel, showRelatedTab, collationMatches, collationRelationships, collationLoading, featureFlags } from '$lib/pane';
  import ChatPanel from '$lib/ChatPanel.svelte';
  import Panel from '$lib/Panel.svelte';
  import PropertiesPane from '$lib/PropertiesPane.svelte';
  import CollationPanel from '$lib/CollationPanel.svelte';
  import SearchPanel from '$lib/SearchPanel.svelte';
  import PoliciesPanel from '$lib/PoliciesPanel.svelte';
  import TagsPanel from '$lib/TagsPanel.svelte';
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
  const mobile = () => typeof window !== 'undefined' && window.innerWidth <= 768;
  let showSidebar    = $state(!mobile());
  let leftView       = $state<'files' | 'search' | 'policies' | 'tags' | 'settings' | 'git'>('files');
  type Theme = 'dark' | 'light' | 'system';
  const THEMES: Theme[] = ['dark', 'light', 'system'];
  const THEME_ICONS: Record<Theme, string> = { dark: '🌙', light: '☀️', system: '💻' };
  let theme = $state<Theme>('dark');

  function applyTheme(t: Theme) {
    theme = t;
    if (typeof localStorage !== 'undefined') localStorage.setItem('dw-theme', t);
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
  }
  function cycleTheme() { applyTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]); }
  let searchPanel: SearchPanel;
  let showRightPanel = $state(!mobile());
  let rightTab     = $state<'properties' | 'related'>('properties');

  // Subscribe to shared collation stores
  let cm = $state<any[]>([]); $effect(() => { const u = collationMatches.subscribe(v => cm = v); return u; });
  let cr = $state<any[]>([]); $effect(() => { const u = collationRelationships.subscribe(v => cr = v); return u; });
  let cl = $state(false);     $effect(() => { const u = collationLoading.subscribe(v => cl = v); return u; });

  // Fetch profile feature flags on mount
  onMount(async () => {
    try {
      const res = await fetch('/api/profile-config');
      if (res.ok) {
        const cfg = await res.json();
        const rel = cfg.relationshipEngine ?? {};
        featureFlags.set({
          showPlanButton: rel.show_plan_button !== false,
          autoDetectOnCreate: rel.auto_detect_on_create !== false,
          autoDetectOnUpdate: rel.auto_detect_on_update !== false,
          similarityThreshold: rel.similarity_threshold ?? 0.35,
        });
      }
    } catch { /* use defaults */ }
  });

  // On nav: clear stale collation data; honour active tab
  $effect(() => {
    const fp = $currentDoc.filePath;
    collationMatches.set([]);
    collationRelationships.set([]);
    collationLoading.set(false);
    if (rightTab === 'related' && fp) findRelated(fp);
  });

  // React to page's signal to switch to Related tab
  $effect(() => {
    const trigger = $showRelatedTab;
    if (trigger) {
      rightTab = 'related';
      showRightPanel = true;
      showRelatedTab.set(false);
      if ($currentDoc.filePath) findRelated($currentDoc.filePath);
    }
  });

  async function findRelated(filePath: string) {
    if (!filePath) return;
    rightTab = 'related';
    showRightPanel = true;
    collationLoading.set(true);
    collationMatches.set([]);
    collationRelationships.set([]);
    const res = await fetch('/api/overlap?path=' + encodeURIComponent(filePath));
    collationLoading.set(false);
    if (res.ok) {
      const data = await res.json();
      collationMatches.set(data.matches || []);
      collationRelationships.set(data.relationships || []);
    }
  }

  async function handleCreatePlan() {
    const fp = $currentDoc.filePath;
    if (!fp) return;
    const fm = $currentDoc.frontmatter;
    if (!fm) return;
    const res = await fetch('/api/create-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Plan: ' + (fm.title || fp),
        candidates: [fp.replace(/\.md$/, '')],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      goto('/' + data.path.replace(/\.md$/, '') + '?new=1');
      collationMatches.set([]);
      collationRelationships.set([]);
    }
  }

  // Close sidebar on navigation (mobile only)
  $effect(() => {
    $page.url;
    if (mobile()) { showSidebar = false; showRightPanel = false; }
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

    function handleGlobalKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const editing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        leftView = 'search';
        showSidebar = true;
        setTimeout(() => searchPanel?.focusSearch(), 50);
      } else if (e.ctrlKey && !e.shiftKey && e.key === '\\') {
        e.preventDefault();
        showSidebar = !showSidebar;
      } else if (e.ctrlKey && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        showRightPanel = !showRightPanel;
      } else if (e.key === 'Escape' && !editing) {
        if (leftView === 'search') { leftView = 'files'; }
      }
    }
    document.addEventListener('keydown', handleGlobalKey);

    // Restore persisted theme
    const saved = localStorage.getItem('dw-theme') as Theme | null;
    if (saved && THEMES.includes(saved)) applyTheme(saved);

    return () => document.removeEventListener('keydown', handleGlobalKey);
  });
</script>

<!-- Always-visible toolbar — all viewports -->
<div class="app-toolbar">
  <!-- Left: sidebar toggle -->
  <div class="toolbar-left">
    <button class="hamburger" onclick={toggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar">☰</button>
  </div>

  <!-- Center: brand — acts as home button -->
  <a href="/status" class="toolbar-brand" title="Home — {brand.name} status">
    {#if brand.logoPath}
      <img class="brand-logo" src="/api/brand/logo" alt={brand.name}
        onerror={(e) => { (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden'); }} />
      <span class="brand-name" hidden>{brand.name}</span>
    {:else}
      <span class="brand-name">{brand.name}</span>
    {/if}
  </a>

  <!-- Right: new + properties toggle -->
  <div class="toolbar-right">
    <div class="new-group">
      <button class="new-btn" onclick={(e) => { e.stopPropagation(); showNewMenu = !showNewMenu; }}>+ New</button>
      {#if showNewMenu}
        <div class="new-menu" onclick={(e) => e.stopPropagation()}>
          <button class="new-menu-item" onclick={newFile}>New File</button>
          <button class="new-menu-item" onclick={newProposal}>New Proposal</button>
        </div>
      {/if}
    </div>
    <button class="gear-btn" onclick={() => { showRightPanel = !showRightPanel; }} aria-label="Toggle properties panel" title="Toggle properties">⊞</button>
  </div>
</div>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div id="app" onclick={closeMenus}>

  <!-- Activity bar — switches left panel content -->
  <div class="activity-bar">
    <button class="act-btn" class:active={leftView === 'files'}
      onclick={() => { leftView = 'files'; showSidebar = true; }}
      title="Files">📄</button>
    <button class="act-btn" class:active={leftView === 'search'}
      onclick={() => { leftView = 'search'; showSidebar = true; setTimeout(() => searchPanel?.focusSearch(), 50); }}
      title="Search (Ctrl+K)">🔍</button>
    <button class="act-btn" class:active={leftView === 'policies'}
      onclick={() => { leftView = 'policies'; showSidebar = true; }}
      title="Policies">📋</button>
    <button class="act-btn" class:active={leftView === 'tags'}
      onclick={() => { leftView = 'tags'; showSidebar = true; }}
      title="Tags">🏷</button>
    <button class="act-btn" class:active={leftView === 'settings'}
      onclick={() => { leftView = 'settings'; showSidebar = true; }}
      title="Settings">⚙</button>
    <button class="act-btn" class:active={leftView === 'git'}
      onclick={() => { leftView = 'git'; showSidebar = true; }}
      title="Git">⎇</button>
  </div>

  <Panel side="left" bind:open={showSidebar}>
    <div class="sidebar-header">
      <span class="sidebar-view-label">
        {leftView === 'files' ? 'Files' : leftView === 'search' ? 'Search' : leftView === 'policies' ? 'Policies' : leftView === 'tags' ? 'Tags' : leftView === 'settings' ? 'Settings' : 'Git'}
      </span>
      {#if leftView === 'files'}
      <div class="new-group-inner">
        <button class="new-btn-sm" onclick={(e) => { e.stopPropagation(); showNewMenu = !showNewMenu; }} title="New document">+</button>
        {#if showNewMenu}
          <div class="new-menu" onclick={(e) => e.stopPropagation()}>
            <button class="new-menu-item" onclick={newFile}>New File</button>
            <button class="new-menu-item" onclick={newProposal}>New Proposal</button>
          </div>
        {/if}
      </div>
      {/if}
    </div>
    {#if leftView === 'search'}
      <SearchPanel bind:this={searchPanel} />
    {:else if leftView === 'policies'}
      <PoliciesPanel />
    {:else if leftView === 'tags'}
      <TagsPanel />
    {:else if leftView === 'files'}
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

    {:else if leftView === 'settings'}
      <div class="settings-view">
        <div class="settings-group">
          <div class="settings-group-label">AI Instructions</div>
          <a class="settings-file" href="/CLAUDE">CLAUDE.md</a>
          <a class="settings-file" href="/AGENTS">AGENTS.md</a>
        </div>
        <div class="settings-group">
          <div class="settings-group-label">Templates</div>
          <a class="settings-file" href="/templates/proposal-template">proposal-template.md</a>
          <a class="settings-file" href="/templates/plan-template">plan-template.md</a>
        </div>
        <div class="settings-group">
          <div class="settings-group-label">Project</div>
          <a class="settings-file" href="/CONTRIBUTING">CONTRIBUTING.md</a>
          <a class="settings-file" href="/SECURITY">SECURITY.md</a>
          <a class="settings-file" href="/CHANGELOG">CHANGELOG.md</a>
          <a class="settings-file" href="/NOTICE">NOTICE.md</a>
        </div>
        <div class="settings-group">
          <div class="settings-group-label">Brand</div>
          <a class="settings-file" href="/brand.json">brand.json</a>
          <a class="settings-file" href="/brand/theme.css">brand/theme.css</a>
        </div>
        <div class="settings-hint">
          Edit these files to customise DocWright.<br>
          See <a href="/docs/customization">docs/customization.md</a> for details.
        </div>
      </div>

    {:else}
      <GitPanel />
    {/if}
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
            body={$currentDoc.body}
            docType={$currentDoc.docType}
            mode={$currentDoc.mode}
            onsave={$currentDoc.onSave}
            onapprove={$currentDoc.onApprove}
            onfindrelated={() => { rightTab = 'related'; findRelated($currentDoc.filePath); }}
            onplan={() => { rightTab = 'related'; findRelated($currentDoc.filePath); }}
          />
        {:else}
          <div class="right-empty">Open a document to see its properties</div>
        {/if}
      {/key}
    {:else}
      <CollationPanel
        matches={cm}
        relationships={cr}
        loading={cl}
        planMode={$currentDoc.docType === 'proposal' && $currentDoc.frontmatter?.approved === true}
        alreadyRelated={Array.isArray($currentDoc.frontmatter?.related_to) ? $currentDoc.frontmatter.related_to : []}
        onaddrelated={(path) => $currentDoc.onAddRelated?.(path)}
        onadddepends={(path) => $currentDoc.onAddDepends?.(path)}
        onaddblocks={(path) => $currentDoc.onAddBlocks?.(path)}
        onsubsume={(path) => $currentDoc.onSubsume?.(path)}
        oncreateplan={() => handleCreatePlan()}
        onrecheck={() => { if ($currentDoc.filePath) findRelated($currentDoc.filePath); }}
        onclose={() => { rightTab = 'properties'; collationMatches.set([]); collationRelationships.set([]); }}
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
  <span class="footer-spacer"></span>
  <button class="theme-btn" onclick={cycleTheme}
    title="Theme: {theme} · Click to cycle (dark → light → system)">
    {THEME_ICONS[theme]} {theme}
  </button>
</footer>

<style>
  /* old mobile-topbar removed — replaced by app-toolbar (always visible) */
  /* ── Always-visible toolbar ─────────────────────────────────────────────── */
  .app-toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 44px;
    padding: 0 10px;
    background: #0f0f12;
    border-bottom: 1px solid #1e2030;
    flex-shrink: 0;
    z-index: 100;
  }
  .toolbar-left  { display: flex; align-items: center; gap: 4px; justify-content: flex-start; }
  .toolbar-right { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
  .toolbar-brand {
    display: flex; align-items: center; justify-content: center;
    text-decoration: none; padding: 4px 8px; border-radius: 4px;
  }
  .toolbar-brand:hover { background: #1a1a2a; }
  .hamburger { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 3px; }
  .hamburger:hover { color: #aaa; background: #1a1a1a; }
  .home-btn { color: #666; font-size: 16px; text-decoration: none; padding: 4px 6px; border-radius: 3px; }
  .home-btn:hover { color: #aaa; background: #1a1a1a; }
  .gear-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 3px; }
  .gear-btn:hover { color: #aaa; background: #1a1a1a; }

  /* ── Activity bar ────────────────────────────────────────────────────────── */
  .activity-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 40px;
    background: #0a0a0d;
    border-right: 1px solid #1e2030;
    flex-shrink: 0;
    padding-top: 4px;
    gap: 2px;
  }
  .act-btn {
    width: 36px; height: 36px;
    background: none; border: none;
    color: #444; cursor: pointer;
    font-size: 16px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
  }
  .act-btn:hover  { color: #aaa; background: #1a1a1a; }
  .act-btn.active { color: #ccc; background: #1a1a2a; border-left: 2px solid #58a6ff; border-radius: 0 4px 4px 0; }

  /* ── Core layout ────────────────────────────────────────────────────────── */
  #app { display: flex; flex: 1; min-height: 0; font-family: system-ui, -apple-system, sans-serif; }
  .sidebar-header { padding: 8px 12px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; gap: 4px; flex-shrink: 0; min-height: 36px; }
  .sidebar-view-label { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; flex: 1; }
  .new-btn-sm { background: none; border: 1px solid #444; color: #aaa; width: 20px; height: 20px; border-radius: 3px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
  .new-btn-sm:hover { background: #222; color: #fff; }
  .new-group-inner { position: relative; }

  /* ── Settings view ───────────────────────────────────────────────────────── */
  .settings-view { padding: 8px 0; flex: 1; overflow-y: auto; }
  .settings-group { margin-bottom: 16px; }
  .settings-group-label { font-size: 10px; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 16px 2px; }
  .settings-file { display: block; padding: 4px 16px; font-size: 12px; color: #888; text-decoration: none; font-family: monospace; }
  .settings-file:hover { background: #1a1a1a; color: #58a6ff; }
  .settings-hint { padding: 12px 16px; font-size: 11px; color: #444; line-height: 1.5; border-top: 1px solid #1a1a1a; margin-top: 8px; }
  .settings-hint a { color: #58a6ff; text-decoration: none; }
  .settings-hint a:hover { text-decoration: underline; }

  .brand-name { font-size: 13px; font-weight: 600; color: #58a6ff; white-space: nowrap; letter-spacing: 0.02em; }
  .toolbar-brand:hover .brand-name { color: #88c4ff; }
  .brand-logo { height: 22px; width: auto; max-width: 140px; display: block; }
  .toolbar-brand:hover .brand-logo { opacity: 0.8; }

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
  /* sidebar-toggle removed — Panel.svelte provides the edge toggle */
  .new-group { position: relative; flex-shrink: 0; }
  .new-btn { background: none; border: 1px solid #444; color: #aaa; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
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
    #content { padding-top: 0; } /* toolbar is in flow, no fixed offset needed */
    .toast-container { bottom: 80px; }
    .activity-bar { display: none; } /* activity bar hidden on mobile — hamburger + toolbar covers it */
  }

  /* ── Theme picker button ─────────────────────────────────────────────────── */
  .footer-spacer { flex: 1; }
  .theme-btn {
    background: none; border: 1px solid var(--border, #2a2a2a);
    color: var(--muted, #666); border-radius: 4px;
    padding: 1px 8px; font-size: 11px; cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .theme-btn:hover { color: var(--fg, #ccc); border-color: var(--muted, #666); }
</style>

<svelte:head>
  <style>
    /* ── CSS variable definitions ─────────────────────────────────────────── */
    :root {
      --bg:       #111;
      --bg-2:     #161616;
      --bg-3:     #2a2a2a;
      --bg-hover: #1e1e1e;
      --fg:       #ddd;
      --fg-dim:   #aaa;
      --muted:    #666;
      --border:   #2a2a2a;
      --accent:   #7c9ef7;
    }

    /* ── Light theme ──────────────────────────────────────────────────────── */
    html[data-theme="light"] {
      --bg:       #f5f5f5;
      --bg-2:     #ffffff;
      --bg-3:     #e8e8e8;
      --bg-hover: #ebebeb;
      --fg:       #1a1a1a;
      --fg-dim:   #444;
      --muted:    #777;
      --border:   #d0d0d0;
      --accent:   #4a6cf7;
      color-scheme: light;
    }
    html[data-theme="light"] body {
      background: var(--bg);
      color: var(--fg);
    }
    html[data-theme="light"] .app-toolbar {
      background: #fff;
      border-bottom-color: #d0d0d0;
    }
    html[data-theme="light"] .app-footer {
      background: #fff;
      border-top-color: #d0d0d0;
      color: #666;
    }
    html[data-theme="light"] .act-btn { color: #888; }
    html[data-theme="light"] .act-btn:hover { background: #ebebeb; color: #333; }
    html[data-theme="light"] .act-btn.active { color: #333; background: #e0e8ff; border-left-color: #4a6cf7; }
    html[data-theme="light"] .activity-bar { background: #f0f0f0; border-right-color: #d0d0d0; }
    html[data-theme="light"] .app-layout { background: var(--bg); }
    html[data-theme="light"] a { color: #4a6cf7; }

    /* ── System theme: follows OS preference ─────────────────────────────── */
    @media (prefers-color-scheme: light) {
      html[data-theme="system"] {
        --bg:       #f5f5f5;
        --bg-2:     #ffffff;
        --bg-3:     #e8e8e8;
        --bg-hover: #ebebeb;
        --fg:       #1a1a1a;
        --fg-dim:   #444;
        --muted:    #777;
        --border:   #d0d0d0;
        --accent:   #4a6cf7;
        color-scheme: light;
      }
      html[data-theme="system"] body { background: var(--bg); color: var(--fg); }
      html[data-theme="system"] .app-toolbar { background: #fff; border-bottom-color: #d0d0d0; }
      html[data-theme="system"] .app-footer  { background: #fff; border-top-color: #d0d0d0; }
      html[data-theme="system"] .activity-bar { background: #f0f0f0; border-right-color: #d0d0d0; }
      html[data-theme="system"] .act-btn { color: #888; }
      html[data-theme="system"] .act-btn:hover { background: #ebebeb; color: #333; }
      html[data-theme="system"] .act-btn.active { color: #333; background: #e0e8ff; border-left-color: #4a6cf7; }
    }
  </style>
</svelte:head>
