<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DirNode from './DirNode.svelte';
  import FileNode from './FileNode.svelte';
  import { fileChanged } from '$lib/fileChanges';
  import { filesSearchQuery } from '$lib/filesVc.js';

  // Optional callback: called when the user clicks `+` — the shell owns the new-file
  // menu so this stays a closure from the registration site. No-op when used standalone.
  let { onNewMenu }: { onNewMenu?: () => void } = $props();

  // Active path — drives highlight in file/dir nodes
  let currentPath = $derived($page.url.pathname);

  interface TreeItem {
    name: string;
    path: string;
    type: 'dir' | 'file';
    children?: TreeItem[];
  }

  interface ProjectEntry { name: string; path: string; profile: string; }

  // Sidebar config (matches org-operations/profile.json)
  const EXCLUDE_ROOT = new Set([
    'AGENTS.md', 'CHANGELOG.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'LICENSE',
    'NOTICE.md', 'SECURITY.md', 'SESSION-LOG.md',
  ]);
  const HIDDEN_DIRS = ['proposals/approved', 'plans/completed'];

  // Persisted state
  function stored(key: string, fallback: string): string {
    if (typeof sessionStorage === 'undefined') return fallback;
    return sessionStorage.getItem(key) ?? fallback;
  }

  let viewMode    = $state<'docs' | 'all'>(stored('sidebar-mode', 'docs') as 'docs' | 'all');
  let showArchived = $state(stored('sidebar-archived', 'false') === 'true');
  let showNewMenu  = $state(false);
  let searchQuery  = $state('');

  function setMode(m: 'docs' | 'all') {
    viewMode = m;
    sessionStorage.setItem('sidebar-mode', m);
    fetchTree();
  }
  function toggleArchived() {
    showArchived = !showArchived;
    sessionStorage.setItem('sidebar-archived', String(showArchived));
  }

  // Share state with DirNode/FileNode descendants via context
  setContext('sidebar', {
    get viewMode() { return viewMode; },
    get showArchived() { return showArchived; },
    hiddenDirs: HIDDEN_DIRS,
  });

  let tree     = $state<TreeItem[]>([]);
  let loading  = $state(true);
  let projects = $state<ProjectEntry[]>([]);
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  async function fetchTree() {
    loading = true;
    const url = '/api/list' + (viewMode === 'all' ? '?all=1' : '');
    const res = await fetch(url);
    tree = await res.json();
    loading = false;
  }

  async function fetchProjects() {
    try {
      const res = await fetch('/api/registry');
      if (res.ok) { const d = await res.json(); projects = d.projects ?? []; }
    } catch { projects = []; }
  }

  onMount(() => {
    fetchTree();
    fetchProjects();
    // Subscribe to shell search store (updated by per-VC search input in layout)
    const unsub = filesSearchQuery.subscribe(q => { searchQuery = q; });
    // Auto-refresh on file changes
    const unwatch = fileChanged.subscribe(() => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(fetchTree, 200);
    });
    return () => { unsub(); unwatch(); };
  });

  // Filter: if search query set, show only items whose name matches
  function matchesQuery(name: string): boolean {
    if (!searchQuery) return true;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  }

  function filterTree(items: TreeItem[]): TreeItem[] {
    if (!searchQuery) return items;
    return items.flatMap(item => {
      if (item.type === 'file') return matchesQuery(item.name) ? [item] : [];
      const children = filterTree(item.children ?? []);
      if (children.length > 0) return [{ ...item, children }];
      return matchesQuery(item.name) ? [{ ...item, children: [] }] : [];
    });
  }

  let filtered = $derived(filterTree(
    tree.filter(item => {
      if (viewMode === 'all') return true;
      if (item.type === 'file' && EXCLUDE_ROOT.has(item.name)) return false;
      if (item.type === 'dir' && !showArchived && HIDDEN_DIRS.includes(item.path)) return false;
      return true;
    })
  ));
</script>

<!-- Header: view mode toggle + new button -->
<div class="files-header">
  <div class="mode-bar">
    <button class="mode-btn" class:active={viewMode === 'docs'} onclick={() => setMode('docs')}>Docs</button>
    <button class="mode-btn" class:active={viewMode === 'all'}  onclick={() => setMode('all')}>All</button>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="new-group-inner" onclick={(e) => e.stopPropagation()}>
    <button class="new-btn-sm" onclick={(e) => { e.stopPropagation(); onNewMenu?.(); showNewMenu = !showNewMenu; }}
      title="New document">+</button>
    {#if showNewMenu}
      <div class="new-menu" onclick={(e) => e.stopPropagation()}>
        <button class="new-menu-item" onclick={() => { showNewMenu = false; onNewMenu?.(); }}>New File</button>
        <button class="new-menu-item" onclick={() => { showNewMenu = false; onNewMenu?.(); }}>New Proposal</button>
      </div>
    {/if}
  </div>
</div>

{#if searchQuery}
  <div class="search-hint">Filtering: <strong>{searchQuery}</strong></div>
{/if}

{#if loading}
  <p class="muted">Scanning…</p>
{:else}
  <nav class="tree">
    {#each filtered as item}
      {#if item.type === 'file'}
        <FileNode {item} {currentPath} />
      {:else}
        <DirNode {item} {currentPath} />
      {/if}
    {/each}
    {#if filtered.length === 0 && searchQuery}
      <p class="muted">No files match "{searchQuery}"</p>
    {/if}
  </nav>
{/if}

<!-- Archived toggle (docs mode only) -->
{#if viewMode === 'docs' && !searchQuery}
  <div class="archived-toggle">
    <button class="archived-btn" onclick={toggleArchived}>
      {showArchived ? '🗂 Hide archived' : '🗂 Show archived'}
    </button>
  </div>
{/if}

<!-- Project registry section -->
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

<style lang="scss">
  @use '../lib/tokens' as *;

  .files-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px 4px;
    flex-shrink: 0;
  }
  .mode-bar { display: flex; gap: 0; flex: 1; }
  .mode-btn {
    flex: 1; padding: 3px 0; font-size: 11px; cursor: pointer;
    border: 1px solid $border; background: $bg; color: $muted;
    &:first-child { border-radius: 4px 0 0 4px; }
    &:last-child  { border-radius: 0 4px 4px 0; border-left: none; }
    &.active      { @include act-variant($blue, $blue-bg, $blue-bdr); }
    &:not(.active):hover { background: $bg-hover; color: $fg-dim; }
  }
  .new-group-inner { position: relative; flex-shrink: 0; }
  .new-btn-sm {
    background: none; border: 1px solid $border; border-radius: 4px;
    color: $muted; font-size: 15px; line-height: 1; padding: 1px 6px;
    cursor: pointer;
    &:hover { color: $fg; border-color: $accent; }
  }
  .new-menu {
    position: absolute; right: 0; top: 100%; z-index: 200;
    background: $bg-2; border: 1px solid $border; border-radius: 6px;
    padding: 4px 0; box-shadow: 0 4px 12px rgba(0,0,0,.4); min-width: 140px;
  }
  .new-menu-item {
    display: block; width: 100%; background: none; border: none;
    color: $fg; padding: 6px 16px; font-size: 13px;
    text-align: left; cursor: pointer;
    &:hover { background: $blue-bg; color: #fff; }
  }
  .search-hint {
    padding: 4px 12px; font-size: 11px; color: $muted;
    border-bottom: 1px solid $border; flex-shrink: 0;
    strong { color: $fg-dim; }
  }
  .muted { padding: 12px 16px; color: $muted; font-size: 13px; }
  .tree { padding: 4px 0; flex: 1; overflow-y: auto; }
  .archived-toggle {
    padding: 6px 12px 8px; border-top: 1px solid $border; margin-top: auto; flex-shrink: 0;
  }
  .archived-btn { @include flat-btn; font-size: 11px; padding: 2px 0; &:hover { color: $fg-dim; } }
  .project-section { border-top: 1px solid $border; padding: 8px 0; flex-shrink: 0; }
  .project-heading {
    font-size: 11px; font-weight: 600; color: $muted;
    text-transform: uppercase; letter-spacing: 0.5px;
    padding: 4px 16px; white-space: nowrap; overflow: hidden;
  }
  .project-link {
    display: block; padding: 4px 16px; font-size: 13px; color: $fg-dim; text-decoration: none;
    &:hover { background: $bg-hover; color: $fg; }
  }
  .project-name { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .project-profile { font-size: 11px; color: $muted; white-space: nowrap; overflow: hidden; }

  @media (max-width: 768px) {
    .mode-btn { min-height: 44px; font-size: 13px; }
    .archived-btn { min-height: 44px; display: flex; align-items: center; font-size: 13px; }
  }

  :global(html[data-theme="light"]) {
    .new-menu { background: #fff; border-color: #d0d0d0; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
    .new-menu-item { color: #333; &:hover { background: #e0e8ff; color: #111; } }
    .project-link { color: #555; &:hover { background: #eaeaea; color: #111; } }
    .project-heading { color: #888; }
    .project-profile { color: #999; }
  }
</style>
