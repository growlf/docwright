<script lang="ts">
  import { goto } from '$app/navigation';
  import { showToast } from '$lib/toast';
  import { fileChanged } from '$lib/fileChanges';

  interface TreeItem { name: string; path: string; type: 'dir' | 'file'; }

  let { item, currentPath }: { item: TreeItem; currentPath: string } = $props();

  const isDoc  = item.name.endsWith('.md');
  const stem   = item.name.replace(/\.md$/, '');
  const ext    = isDoc ? '.md' : '';
  const href   = isDoc
    ? '/' + item.path.replace(/\.md$/, '')
    : '/api/read?path=' + encodeURIComponent(item.path);
  const isActive = isDoc && ('/' + item.path.replace(/\.md$/, '')) === currentPath;

  // Rename state
  let renaming = $state(false);
  let newStem  = $state('');

  function startRename() {
    newStem = stem;
    renaming = true;
    showMenu = false;
  }

  async function confirmRename() {
    const trimmed = newStem.trim();
    if (!trimmed || trimmed === stem) { renaming = false; return; }
    const dir = item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/') + 1) : '';
    const to  = dir + trimmed + ext;
    const res = await fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: item.path, to }),
    });
    renaming = false;
    if (res.ok) {
      const { path: newPath } = await res.json();
      fileChanged.set({ path: newPath });
      if (isDoc) goto('/' + newPath.replace(/\.md$/, ''));
    } else if (res.status === 409) {
      showToast('A file with that name already exists', 3000);
    } else {
      showToast('Rename failed', 3000);
    }
  }

  function handleRenameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmRename();
    else if (e.key === 'Escape') renaming = false;
  }

  // Context menu state
  let showMenu = $state(false);
  let menuX = $state(0);
  let menuY = $state(0);

  function handleContext(e: MouseEvent) {
    e.preventDefault();
    menuX = e.clientX;
    menuY = e.clientY;
    showMenu = true;
  }

  async function deleteFile() {
    showMenu = false;
    if (!confirm('Delete ' + item.path + '?\n\nThis cannot be undone from the sidebar.')) return;
    const res = await fetch('/api/delete?path=' + encodeURIComponent(item.path), { method: 'DELETE' });
    if (res.ok) {
      fileChanged.set({ path: item.path });
      showToast('Deleted ' + item.name, 3000);
      if (isActive) goto('/status');
    } else {
      showToast('Delete failed', 3000);
    }
  }
</script>

{#if renaming}
  <div class="renaming">
    <input
      class="rename-input"
      bind:value={newStem}
      onkeydown={handleRenameKey}
      onblur={confirmRename}
      autofocus
    />
  </div>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <a
    {href}
    class="file-link"
    class:active={isActive}
    target={isDoc ? undefined : '_blank'}
    rel={isDoc ? undefined : 'noopener'}
    ondblclick={(e) => { e.preventDefault(); if (isDoc) startRename(); }}
    oncontextmenu={handleContext}
  >
    {stem}
  </a>
{/if}

{#if showMenu}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="menu-backdrop" onclick={() => showMenu = false}
    role="presentation" aria-hidden="true"></div>
  <div class="context-menu" style="left:{menuX}px; top:{menuY}px;">
    <button class="menu-item" onclick={startRename} disabled={!isDoc}>Rename</button>
    <button class="menu-item danger" onclick={deleteFile}>Delete</button>
  </div>
{/if}

<style>
  .file-link { display: block; padding: 3px 8px 3px 20px; font-size: 13px; color: #aaa; text-decoration: none; }
  .file-link:hover { background: #1a1a1a; color: #fff; }
  .file-link.active { background: #2b5b84; color: #fff; }

  .renaming { padding: 2px 8px 2px 16px; }
  .rename-input {
    width: 100%; background: #0a0a0a; border: 1px solid #2b5b84;
    border-radius: 3px; color: #e0e0e0; padding: 2px 6px;
    font-size: 13px; font-family: inherit; outline: none; box-sizing: border-box;
  }

  .menu-backdrop { position: fixed; inset: 0; z-index: 999; }
  .context-menu {
    position: fixed; z-index: 1000;
    background: #1a1a1a; border: 1px solid #333; border-radius: 6px;
    padding: 4px 0; min-width: 120px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  .menu-item {
    display: block; width: 100%; background: none; border: none;
    color: #ccc; padding: 6px 16px; font-size: 13px; text-align: left; cursor: pointer;
  }
  .menu-item:hover:not(:disabled) { background: #2b5b84; color: #fff; }
  .menu-item:disabled { color: #444; cursor: default; }
  .menu-item.danger { color: #e44; }
  .menu-item.danger:hover { background: #3a1a1a; color: #f66; }

  @media (max-width: 768px) {
    .file-link { min-height: 44px; display: flex; align-items: center; padding: 0 8px 0 20px; }
    .menu-item { min-height: 44px; display: flex; align-items: center; }
  }
</style>
