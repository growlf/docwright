<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import FileTree from './FileTree.svelte';
  import { page } from '$app/stores';
  import { fileChanged } from '$lib/fileChanges';
  import { toasts, dismissToast } from '$lib/toast';

  interface ProjectEntry {
    name: string;
    path: string;
    profile: string;
    last_session?: string;
  }

  let projects = $state<ProjectEntry[]>([]);
  let showNewMenu = $state(false);

  function closeMenus() { showNewMenu = false; }

  function newFile() {
    showNewMenu = false;
    let name = prompt('New file path (e.g. docs/my-doc.md):');
    if (!name) return;
    if (!name.endsWith('.md')) name += '.md';
    fetch('/api/write?path=' + encodeURIComponent(name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '# ' + name.replace(/\.md$/, '') + '\n\n' }),
    }).then(r => {
      if (r.ok) goto('/' + name.replace(/\.md$/, ''));
    });
  }

  function newProposal() {
    showNewMenu = false;
    let title = prompt('Proposal title:');
    if (!title) return;
    const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.md';
    const date = new Date().toISOString().slice(0, 10);
    const user = 'NetYeti';
    const host = 'phoenix';
    const content = '---\n' +
      `title: "${title}"\n` +
      `author: ${user}\n` +
      `created: ${date}\n` +
      'tags:\n' +
      '  - new\n' +
      `approved: false\n` +
      `created_by: "${user}@${host}"\n` +
      'assigned_to: ""\n' +
      '---\n' +
      '\n## Problem\n\n' +
      '\n## Proposed Solution\n\n';
    fetch('/api/write?path=proposals/' + slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(r => {
      if (r.ok) goto('/proposals/' + slug.replace(/\.md$/, '') + '?new=1');
    });
  }

  function loadProjects() {
    fetch('/api/registry')
      .then(r => r.json())
      .then(data => { projects = data.projects || []; })
      .catch(() => { projects = []; });
  }

  onMount(() => {
    loadProjects();

    const es = new EventSource('/api/watch');
    es.addEventListener('filechange', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      fileChanged.set(data);
    });
    es.addEventListener('error', () => {
      // SSE will auto-reconnect
    });
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div id="app" onclick={closeMenus}>
  <aside id="sidebar">
    <div class="sidebar-header">
      <h1>docwright</h1>
      <div class="new-group">
        <button class="new-btn" onclick={(e) => { e.stopPropagation(); showNewMenu = !showNewMenu; }}>+</button>
        {#if showNewMenu}
          <div class="new-menu" onclick={(e) => e.stopPropagation()}>
            <button class="new-menu-item" onclick={newFile}>New File</button>
            <button class="new-menu-item" onclick={newProposal}>New Proposal</button>
          </div>
        {/if}
      </div>
    </div>
    <FileTree currentPath={$page.url.pathname} />
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
  </aside>
  <main id="content">
    <slot />
  </main>
  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div class="toast">
        <span class="toast-msg">{toast.message}</span>
        {#if toast.action}
          <button class="toast-action" onclick={() => { toast.action!.onclick(); dismissToast(toast.id); }}>{toast.action.label}</button>
        {/if}
        <button class="toast-close" onclick={() => dismissToast(toast.id)}>✕</button>
      </div>
    {/each}
  </div>
</div>

<style>
  #app { display: flex; height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
  #sidebar { width: 260px; min-width: 260px; background: #111; color: #ccc; display: flex; flex-direction: column; overflow-y: auto; }
  .sidebar-header { padding: 12px 16px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; }
  .sidebar-header h1 { font-size: 14px; font-weight: 600; color: #fff; margin: 0; }
  .new-group { position: relative; }
  .new-btn { background: none; border: 1px solid #444; color: #aaa; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center; }
  .new-btn:hover { background: #222; color: #fff; }
  .new-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; z-index: 1000; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
  .new-menu-item { display: block; width: 100%; background: none; border: none; color: #ccc; padding: 6px 16px; font-size: 13px; text-align: left; cursor: pointer; }
  .new-menu-item:hover { background: #2b5b84; color: #fff; }
  #content { flex: 1; overflow-y: auto; background: #1a1a1a; color: #e0e0e0; scroll-behavior: smooth; }
  .toast-container { position: fixed; bottom: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 10000; }
  .toast { display: flex; align-items: center; gap: 8px; background: #222; border: 1px solid #444; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #e0e0e0; box-shadow: 0 4px 12px rgba(0,0,0,0.4); min-width: 260px; }
  .toast-msg { flex: 1; }
  .toast-action { background: none; border: 1px solid #2b5b84; color: #58a6ff; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .toast-action:hover { background: #1a3a5a; }
  .toast-close { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; padding: 0 2px; }
  .project-section { border-top: 1px solid #222; padding: 8px 0; }
  .project-heading { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 16px; }
  .project-link { display: block; padding: 4px 16px; font-size: 13px; color: #aaa; text-decoration: none; }
  .project-link:hover { background: #1a1a1a; color: #fff; }
  .project-name { display: block; }
  .project-profile { font-size: 11px; color: #555; }
</style>
