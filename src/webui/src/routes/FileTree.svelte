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
      <DirNode {item} {currentPath} />
    {/each}
  </nav>
{/if}

<style>
  .muted { padding: 12px 16px; color: #666; font-size: 13px; }
  .tree { padding: 8px 0; flex: 1; overflow-y: auto; }
</style>
