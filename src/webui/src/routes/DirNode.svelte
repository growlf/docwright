<script lang="ts">
  import DirNode from './DirNode.svelte';

  interface TreeItem {
    name: string;
    path: string;
    type: 'dir' | 'file';
    children?: TreeItem[];
  }

  let { item, currentPath }: { item: TreeItem; currentPath: string } = $props();

  let collapsed = $state(true);

  function toggle() {
    collapsed = !collapsed;
  }
</script>

{#if item.type === 'dir'}
  <div class="dir">
    <button class="dir-toggle" onclick={toggle}>
      <span class="arrow">{collapsed ? '▸' : '▾'}</span>
      <span class="dir-name">{item.name}</span>
    </button>
    {#if !collapsed && item.children}
      <div class="children">
        {#each item.children as child}
          {#if child.type === 'dir'}
              <DirNode item={child} {currentPath} />
          {:else}
            <a
              href="/{child.path.replace(/\.md$/, '')}"
              class="file-link"
              class:active={'/' + child.path.replace(/\.md$/, '') === currentPath}
            >
              {child.name.replace(/\.md$/, '')}
            </a>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .dir-toggle { background: none; border: none; color: #ccc; cursor: pointer; padding: 4px 8px; font-size: 13px; display: flex; align-items: center; gap: 4px; width: 100%; text-align: left; }
  .dir-toggle:hover { background: #1a1a1a; }
  .arrow { font-size: 10px; width: 12px; color: #666; flex-shrink: 0; }
  .dir-name { color: #999; }
  .children { padding-left: 16px; }
  .file-link { display: block; padding: 3px 8px 3px 20px; font-size: 13px; color: #aaa; text-decoration: none; cursor: pointer; }
  .file-link:hover { background: #1a1a1a; color: #fff; }
  .file-link.active { background: #2b5b84; color: #fff; }
</style>
