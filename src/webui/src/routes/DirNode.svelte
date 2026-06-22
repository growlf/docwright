<script lang="ts">
  import { getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import DirNode from './DirNode.svelte';
  import FileNode from './FileNode.svelte';
  import { fileChanged } from '$lib/fileChanges';

  interface TreeItem {
    name: string;
    path: string;
    type: 'dir' | 'file';
    children?: TreeItem[];
  }

  let { item, currentPath }: { item: TreeItem; currentPath: string } = $props();

  const sidebar = getContext<{
    viewMode: 'docs' | 'all';
    showArchived: boolean;
    hiddenDirs: string[];
  }>('sidebar');

  let collapsed = $state(true);
  let showMenu = $state(false);
  let menuX = $state(0);
  let menuY = $state(0);
  let creating = $state(false);
  let createType = $state<'file' | 'folder'>('file');
  let newName = $state('');

  // If the folder contains index.base, clicking navigates to the base view
  // instead of expanding/collapsing the directory.
  let indexBase = $derived(
    (item.children ?? []).find(c => c.type === 'file' && c.name === 'index.base') ?? null
  );

  function toggle() {
    if (indexBase) { goto('/' + indexBase.path); return; }
    if (!creating) collapsed = !collapsed;
  }

  function handleContext(e: MouseEvent) {
    e.preventDefault();
    showMenu = true;
    menuX = e.clientX;
    menuY = e.clientY;
  }
  function closeMenu() { showMenu = false; }

  function startCreate(type: 'file' | 'folder') {
    createType = type;
    creating = true;
    newName = type === 'file' ? 'untitled.md' : 'new-folder';
    showMenu = false;
    collapsed = false;
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
    fileChanged.set({ path: fullPath });
  }

  function handleNewNameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmCreate();
    else if (e.key === 'Escape') creating = false;
  }

  // Context-aware "+" — proposal/plan/policy templates vs generic file
  async function contextNew(e: MouseEvent) {
    e.stopPropagation();
    collapsed = false;
    const dir = item.path;
    const date = new Date().toISOString().slice(0, 10);

    if (dir === 'proposals' || dir.startsWith('proposals/')) {
      const title = prompt('Proposal title:');
      if (!title) return;
      const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.md';
      const content =
        '---\ntitle: "' + title + '"\nauthor: NetYeti\ncreated: ' + date +
        '\ntags: []\ncategory: []\ncomplexity: ""\nestimated_effort: ""\ndepends_on: []\n' +
        'approved: false\ncreated_by: "NetYeti@phoenix"\nassigned_to: ""\n---\n\n## Problem\n\n\n## Proposed Solution\n\n';
      const path = dir + '/' + slug;
      const res = await fetch('/api/write?path=' + encodeURIComponent(path), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) goto('/' + path.replace(/\.md$/, '') + '?new=1');

    } else if (dir === 'policies' || dir.startsWith('policies/')) {
      const title = prompt('Policy title:');
      if (!title) return;
      const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.md';
      const content =
        '---\ntitle: "' + title + '"\nstatus: draft\nauthor: NetYeti\ncreated: ' + date +
        '\nauthor-role: governance\ntags: []\n---\n\n## Statement\n\n\n## Rationale\n\n';
      const path = dir + '/' + slug;
      const res = await fetch('/api/write?path=' + encodeURIComponent(path), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) goto('/' + path.replace(/\.md$/, '') + '?new=1');

    } else if (dir === 'research' || dir.startsWith('research/')) {
      const title = prompt('Research title:');
      if (!title) return;
      const question = prompt('Research question (one sentence):');
      if (!question) return;
      const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.md';
      const content =
        '---\ntitle: "' + title + '"\n' +
        'status: active\n' +
        'question: "' + question + '"\n' +
        'conclusion: open\n' +
        'author: NetYeti\n' +
        'created: ' + date + '\n' +
        'author-role: contributor\n' +
        'tags: []\n' +
        'linked_proposals: []\n' +
        'related_research: []\n' +
        '---\n\n' +
        '## Questions Explored\n\n- ' + question + '\n\n' +
        '## Approaches Compared\n\n| Approach | Pros | Cons |\n|----------|------|------|\n| Option A | | |\n| Option B | | |\n\n' +
        '## Findings\n\n\n\n' +
        '## Sources\n\n- \n\n' +
        '## Conclusion\n\n> Update `status: concluded` and set `conclusion:` when done.\n';
      const p = 'research/' + slug;
      const res = await fetch('/api/write?path=' + encodeURIComponent(p), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) goto('/' + p.replace(/\.md$/, '') + '?new=1');

    } else {
      startCreate('file');
    }
  }

  // Filter children based on view mode and archived state.
  // When a folder has index.base, hide all its children — the folder click IS the view.
  let visibleChildren = $derived(
    indexBase ? [] : (item.children ?? []).filter(child => {
      if (sidebar.viewMode === 'all') return true;
      if (child.type === 'file' && !child.name.endsWith('.md') && !child.name.endsWith('.base')) return false;
      if (child.type === 'dir' && !sidebar.showArchived && sidebar.hiddenDirs.includes(child.path)) return false;
      return true;
    })
  );
</script>

{#if item.type === 'dir'}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="dir" onclick={closeMenu}>
    <div class="dir-row" oncontextmenu={handleContext}>
      <button class="dir-toggle" onclick={toggle}>
        <span class="arrow">{collapsed ? '▸' : '▾'}</span>
        <span class="dir-name">{item.path === 'research' ? '🔬 ' : ''}{item.name}</span>
      </button>
      <button class="add-btn" onclick={contextNew} title="New item">+</button>
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
      {#each visibleChildren as child}
        {#if child.type === 'dir'}
          <DirNode item={child} {currentPath} />
        {:else}
          <FileNode item={child} {currentPath} />
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../lib/tokens' as *;

  .dir-row {
    display: flex; align-items: center; position: relative;
    &:hover .add-btn { opacity: 1; }
  }

  .dir-toggle {
    @include flat-btn;
    color: $fg-dim;
    padding: 4px 8px; font-size: 13px;
    display: flex; align-items: center; gap: 4px; flex: 1; text-align: left;
    &:hover { background: $bg-hover; }
  }

  .arrow { font-size: 10px; width: 12px; color: $muted; flex-shrink: 0; }
  .dir-name { color: $fg-dim; }

  .add-btn {
    opacity: 0;
    background: none; border: 1px solid $border;
    color: $fg-dim; width: 20px; height: 20px;
    border-radius: 3px; cursor: pointer; font-size: 14px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    margin-right: 4px; transition: opacity 0.1s;
    &:hover { background: $bg-3; color: $fg; }
  }

  .children { padding-left: 16px; &.hidden { display: none; } }

  .context-menu {
    @include context-menu;
    position: fixed; z-index: 1000; min-width: 140px;
  }

  .inline-create { display: flex; align-items: center; gap: 4px; padding: 3px 8px 3px 20px; }
  .create-icon { font-size: 12px; }
  .create-input { @include inline-input; font-size: 13px; }
</style>
