<script lang="ts">
  /**
   * TreePanel — generic collapsible tree widget.
   *
   * Stub: API contract defined here; full implementation extracted from
   * FileTree.svelte in Step 9 (Files View Container extraction).
   *
   * Usage:
   *   <TreePanel items={tree} onselect={(item) => goto('/' + item.path)} />
   *
   * Props:
   *   items      — TreeItem[]  — flat or nested tree data
   *   selected   — string      — currently selected item path
   *   onselect   — (item) => void — called on item click
   *   loading    — boolean     — show skeleton while loading
   */

  export interface TreeItem {
    name: string;
    path: string;
    type: 'dir' | 'file';
    children?: TreeItem[];
  }

  let {
    items = [],
    selected = '',
    onselect,
    loading = false,
  }: {
    items?: TreeItem[];
    selected?: string;
    onselect?: (item: TreeItem) => void;
    loading?: boolean;
  } = $props();
</script>

{#if loading}
  <div class="tree-loading">Loading…</div>
{:else if items.length === 0}
  <div class="tree-empty">No items</div>
{:else}
  <ul class="tree-root">
    {#each items as item}
      <li class="tree-item" class:selected={item.path === selected}>
        <button class="tree-btn" onclick={() => onselect?.(item)}>
          {item.type === 'dir' ? '📁' : '📄'} {item.name}
        </button>
        {#if item.children?.length}
          <ul class="tree-children">
            {#each item.children as child}
              <li class="tree-item" class:selected={child.path === selected}>
                <button class="tree-btn" onclick={() => onselect?.(child)}>
                  {child.type === 'dir' ? '📁' : '📄'} {child.name}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style lang="scss">
  @use 'tokens' as *;

  .tree-loading, .tree-empty {
    padding: 12px 16px;
    font-size: 12px;
    color: $muted;
  }
  .tree-root, .tree-children {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tree-children { padding-left: 14px; }
  .tree-btn {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 3px 12px;
    font-size: 13px;
    color: $fg-dim;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    &:hover { background: $bg-hover; color: $fg; }
  }
  .tree-item.selected > .tree-btn { color: $accent; background: $bg-2; }
</style>
