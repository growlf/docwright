<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import DirNode from './DirNode.svelte';
  import FileNode from './FileNode.svelte';
  import { fileChanged } from '$lib/fileChanges';

  let { currentPath }: { currentPath: string } = $props();

  interface TreeItem {
    name: string;
    path: string;
    type: 'dir' | 'file';
    children?: TreeItem[];
  }

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

  let viewMode = $state<'docs' | 'all'>(stored('sidebar-mode', 'docs') as 'docs' | 'all');
  let showArchived = $state(stored('sidebar-archived', 'false') === 'true');

  function setMode(m: 'docs' | 'all') {
    viewMode = m;
    sessionStorage.setItem('sidebar-mode', m);
    fetchTree();
  }
  function toggleArchived() {
    showArchived = !showArchived;
    sessionStorage.setItem('sidebar-archived', String(showArchived));
  }

  // Share state with DirNode descendants via context
  setContext('sidebar', {
    get viewMode() { return viewMode; },
    get showArchived() { return showArchived; },
    hiddenDirs: HIDDEN_DIRS,
  });

  let tree = $state<TreeItem[]>([]);
  let loading = $state(true);
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  async function fetchTree() {
    loading = true;
    const url = '/api/list' + (viewMode === 'all' ? '?all=1' : '');
    const res = await fetch(url);
    tree = await res.json();
    loading = false;
  }

  onMount(() => {
    fetchTree();
    return fileChanged.subscribe(() => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(fetchTree, 200);
    });
  });

  // Filter root-level items
  let filtered = $derived(tree.filter(item => {
    if (viewMode === 'all') return true;
    if (item.type === 'file' && EXCLUDE_ROOT.has(item.name)) return false;
    if (item.type === 'dir' && !showArchived && HIDDEN_DIRS.includes(item.path)) return false;
    return true;
  }));
</script>

<!-- View mode toggle -->
<div class="mode-bar">
  <button class="mode-btn" class:active={viewMode === 'docs'} onclick={() => setMode('docs')}>Docs</button>
  <button class="mode-btn" class:active={viewMode === 'all'}  onclick={() => setMode('all')}>All files</button>
</div>

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
  </nav>
{/if}

<!-- Archived toggle -->
{#if viewMode === 'docs'}
  <div class="archived-toggle">
    <button class="archived-btn" onclick={toggleArchived}>
      {showArchived ? '🗂 Hide archived' : '🗂 Show archived'}
    </button>
  </div>
{/if}

<style>
  .mode-bar { display: flex; gap: 0; padding: 8px 12px 4px; }
  .mode-btn {
    flex: 1; padding: 3px 0; font-size: 11px; cursor: pointer;
    border: 1px solid var(--border, #333); background: var(--bg, #0d0d0d); color: var(--muted, #555);
  }
  .mode-btn:first-child { border-radius: 4px 0 0 4px; }
  .mode-btn:last-child  { border-radius: 0 4px 4px 0; border-left: none; }
  .mode-btn.active { background: #1a3a5a; color: #58a6ff; border-color: #2b5b84; }
  .mode-btn:not(.active):hover { background: var(--bg-hover, #1a1a1a); color: var(--fg-dim, #aaa); }

  .muted { padding: 12px 16px; color: var(--muted, #666); font-size: 13px; }
  .tree { padding: 8px 0; flex: 1; overflow-y: auto; }
  .archived-toggle { padding: 6px 12px 8px; border-top: 1px solid var(--border, #1a1a1a); margin-top: auto; }
  .archived-btn { background: none; border: none; color: var(--muted, #444); font-size: 11px; cursor: pointer; padding: 2px 0; }
  .archived-btn:hover { color: var(--fg-dim, #888); }

  /* ── Mobile touch targets ───────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .mode-btn { min-height: 44px; font-size: 13px; }
    .archived-btn { min-height: 44px; display: flex; align-items: center; font-size: 13px; }
  }
</style>
