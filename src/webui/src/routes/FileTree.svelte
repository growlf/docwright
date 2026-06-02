<script lang="ts">
  import { onMount } from 'svelte';
  import DirNode from './DirNode.svelte';

  let { currentPath }: { currentPath: string } = $props();

  interface TreeItem {
    name: string;
    path: string;
    type: 'dir' | 'file';
    children?: TreeItem[];
  }

  let tree = $state<TreeItem[]>([]);
  let loading = $state(true);

  onMount(async () => {
    const res = await fetch('/api/list');
    tree = await res.json();
    loading = false;
  });
</script>

{#if loading}
  <p class="muted">Scanning...</p>
{:else}
  <nav class="tree">
    {#each tree as item}
      {#if item.type === 'file'}
        <a
          href="/{item.path.replace(/\.md$/, '')}"
          class="file-link"
          class:active={'/' + item.path.replace(/\.md$/, '') === currentPath}
        >
          {item.name.replace(/\.md$/, '')}
        </a>
      {:else}
        <DirNode {item} {currentPath} />
      {/if}
    {/each}
  </nav>
{/if}

<style>
  .muted { padding: 12px 16px; color: #666; font-size: 13px; }
  .tree { padding: 8px 0; flex: 1; overflow-y: auto; }
  .file-link { display: block; padding: 3px 8px 3px 20px; font-size: 13px; color: #aaa; text-decoration: none; cursor: pointer; }
  .file-link:hover { background: #1a1a1a; color: #fff; }
  .file-link.active { background: #2b5b84; color: #fff; }
</style>
