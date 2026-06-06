<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  interface TreeItem {
    name: string;
    path: string;
    type: 'dir' | 'file';
    children?: TreeItem[];
  }

  let policyTree = $state<TreeItem | null>(null);
  let loading = $state(true);
  let collapsed = $state<Set<string>>(new Set());

  function titleFromName(name: string): string {
    return name.replace(/\.md$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function dirLabel(name: string): string {
    return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function toggle(dirPath: string) {
    const next = new Set(collapsed);
    if (next.has(dirPath)) next.delete(dirPath);
    else next.add(dirPath);
    collapsed = next;
  }

  function navigate(filePath: string) {
    goto('/' + filePath.replace(/\.md$/, ''));
  }

  async function load() {
    loading = true;
    try {
      const res = await fetch('/api/list');
      const tree: TreeItem[] = await res.json();
      policyTree = tree.find(n => n.name === 'policies' && n.type === 'dir') ?? null;
    } catch { policyTree = null; }
    loading = false;
  }

  onMount(load);

  const currentPath = $derived($page.url.pathname);
</script>

<div class="policies-panel">
  {#if loading}
    <div class="panel-status">Loading…</div>
  {:else if !policyTree}
    <div class="panel-status">No policies/ directory found.</div>
  {:else}
    <ul class="policy-list">
      {#each (policyTree.children ?? []) as item}
        {#if item.type === 'dir'}
          <li class="cat-item">
            <button class="cat-header" onclick={() => toggle(item.path)}>
              <span class="cat-arrow">{collapsed.has(item.path) ? '▶' : '▼'}</span>
              <span class="cat-label">{dirLabel(item.name)}</span>
              <span class="cat-count">{item.children?.filter(c => c.type === 'file').length ?? 0}</span>
            </button>
            {#if !collapsed.has(item.path)}
              <ul class="file-list">
                {#each (item.children ?? []).filter(c => c.type === 'file') as file}
                  <li class="file-item"
                    class:active={'/' + file.path.replace(/\.md$/, '') === currentPath}
                    onclick={() => navigate(file.path)}>
                    {titleFromName(file.name)}
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {:else if item.type === 'file'}
          <li class="file-item root-file"
            class:active={'/' + item.path.replace(/\.md$/, '') === currentPath}
            onclick={() => navigate(item.path)}>
            {titleFromName(item.name)}
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</div>

<style>
  .policies-panel { display: flex; flex-direction: column; height: 100%; overflow-y: auto; }

  .panel-status { padding: 16px 12px; font-size: 12px; color: var(--muted, #666); text-align: center; }

  .policy-list, .file-list { list-style: none; margin: 0; padding: 0; }

  .cat-item { border-bottom: 1px solid var(--border, #222); }

  .cat-header {
    display: flex; align-items: center; gap: 6px;
    width: 100%; padding: 7px 12px;
    background: none; border: none; cursor: pointer;
    color: var(--fg-dim, #999); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.4px;
    text-align: left;
  }
  .cat-header:hover { background: var(--bg-hover, #252525); }
  .cat-arrow { font-size: 9px; opacity: 0.6; }
  .cat-label { flex: 1; }
  .cat-count {
    font-size: 10px; background: var(--bg-3, #2a2a2a);
    color: var(--muted, #666); padding: 1px 5px; border-radius: 8px;
  }

  .file-item {
    padding: 6px 12px 6px 24px;
    font-size: 12px; color: var(--fg, #ccc);
    cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .file-item:hover { background: var(--bg-hover, #252525); color: var(--fg, #eee); }
  .file-item.active { color: var(--accent, #7c6af7); background: var(--bg-active, #1e1c3a); }
  .file-item.root-file { padding-left: 12px; }
</style>
