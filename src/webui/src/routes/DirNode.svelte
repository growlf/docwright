<script lang="ts">
  import DirNode from './DirNode.svelte';
  import { fileChanged } from '$lib/fileChanges';

  interface TreeItem {
    name: string;
    path: string;
    type: 'dir' | 'file';
    children?: TreeItem[];
  }

  let { item, currentPath }: { item: TreeItem; currentPath: string } = $props();

  let collapsed = $state(true);
  let showMenu = $state(false);
  let menuX = $state(0);
  let menuY = $state(0);
  let creating = $state(false);
  let createType = $state<'file' | 'folder'>('file');
  let newName = $state('');

  function toggle() {
    if (!creating) collapsed = !collapsed;
  }

  function handleContext(e: MouseEvent) {
    e.preventDefault();
    showMenu = true;
    menuX = e.clientX;
    menuY = e.clientY;
  }

  function closeMenu() {
    showMenu = false;
  }

  function startCreate(type: 'file' | 'folder') {
    createType = type;
    creating = true;
    newName = type === 'file' ? 'untitled.md' : 'new-folder';
    showMenu = false;
  }

  async function confirmCreate() {
    if (!newName.trim()) { creating = false; return; }
    const name = createType === 'file' && !newName.endsWith('.md') ? newName + '.md' : newName;
    const fullPath = item.path + '/' + name;

    if (createType === 'folder') {
      await fetch('/api/mkdir?path=' + encodeURIComponent(fullPath), { method: 'POST' });
    } else {
      await fetch('/api/write?path=' + encodeURIComponent(fullPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# ' + name.replace(/\.md$/, '') + '\n\n' }),
      });
    }

    creating = false;
    collapsed = false;
    fileChanged.set({ path: fullPath });
  }

  function handleNewNameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmCreate();
    else if (e.key === 'Escape') creating = false;
  }
</script>

{#if item.type === 'dir'}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="dir" onclick={closeMenu}>
    <div class="dir-row" oncontextmenu={handleContext}>
      <button class="dir-toggle" onclick={toggle}>
        <span class="arrow">{collapsed ? '▸' : '▾'}</span>
        <span class="dir-name">{item.name}</span>
      </button>
      <button class="add-btn" onclick={() => { collapsed = false; startCreate('file'); }} title="New file">+</button>
    </div>

    {#if showMenu}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="context-menu" style="left: {menuX}px; top: {menuY}px;" onclick={() => {}}>
        <button class="menu-item" onclick={() => startCreate('file')}>New File</button>
        <button class="menu-item" onclick={() => startCreate('folder')}>New Folder</button>
      </div>
    {/if}

    <div class="children" class:hidden={collapsed && !creating}>
      {#if creating}
        <div class="inline-create">
          <span class="create-icon">{createType === 'folder' ? '📁' : '📄'}</span>
          <input
            class="create-input"
            bind:value={newName}
            onkeydown={handleNewNameKey}
            onblur={confirmCreate}
            autofocus
          />
        </div>
      {/if}
      {#if item.children}
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
      {/if}
    </div>
  </div>
{/if}

<style>
  .dir-row { display: flex; align-items: center; position: relative; }
  .dir-row:hover .add-btn { opacity: 1; }
  .dir-toggle { background: none; border: none; color: #ccc; cursor: pointer; padding: 4px 8px; font-size: 13px; display: flex; align-items: center; gap: 4px; flex: 1; text-align: left; }
  .dir-toggle:hover { background: #1a1a1a; }
  .arrow { font-size: 10px; width: 12px; color: #666; flex-shrink: 0; }
  .dir-name { color: #999; }
  .add-btn { opacity: 0; background: none; border: 1px solid #444; color: #aaa; width: 20px; height: 20px; border-radius: 3px; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; margin-right: 4px; transition: opacity 0.1s; }
  .add-btn:hover { background: #222; color: #fff; }
  .children { padding-left: 16px; }
  .children.hidden { display: none; }
  .file-link { display: block; padding: 3px 8px 3px 20px; font-size: 13px; color: #aaa; text-decoration: none; cursor: pointer; }
  .file-link:hover { background: #1a1a1a; color: #fff; }
  .file-link.active { background: #2b5b84; color: #fff; }
  .context-menu { position: fixed; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 4px 0; z-index: 1000; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
  .menu-item { display: block; width: 100%; background: none; border: none; color: #ccc; padding: 6px 16px; font-size: 13px; text-align: left; cursor: pointer; }
  .menu-item:hover { background: #2b5b84; color: #fff; }
  .inline-create { display: flex; align-items: center; gap: 4px; padding: 3px 8px 3px 20px; }
  .create-icon { font-size: 12px; }
  .create-input { background: #0a0a0a; border: 1px solid #2b5b84; border-radius: 3px; color: #e0e0e0; padding: 2px 6px; font-size: 13px; font-family: monospace; width: 100%; outline: none; }
</style>
