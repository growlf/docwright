<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import FileTree from './FileTree.svelte';
  import { page } from '$app/stores';
  import { fileChanged } from '$lib/fileChanges';

  interface ProjectEntry {
    name: string;
    path: string;
    profile: string;
    last_session?: string;
  }

  let projects = $state<ProjectEntry[]>([]);

  function newFile() {
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

<div id="app">
  <aside id="sidebar">
    <div class="sidebar-header">
      <h1>docwright</h1>
      <button class="new-btn" onclick={newFile}>+</button>
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
</div>

<style>
  #app { display: flex; height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
  #sidebar { width: 260px; min-width: 260px; background: #111; color: #ccc; display: flex; flex-direction: column; overflow-y: auto; }
  .sidebar-header { padding: 12px 16px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; }
  .sidebar-header h1 { font-size: 14px; font-weight: 600; color: #fff; margin: 0; }
  .new-btn { background: none; border: 1px solid #444; color: #aaa; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center; }
  .new-btn:hover { background: #222; color: #fff; }
  #content { flex: 1; overflow-y: auto; background: #1a1a1a; color: #e0e0e0; scroll-behavior: smooth; }
  .project-section { border-top: 1px solid #222; padding: 8px 0; }
  .project-heading { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 16px; }
  .project-link { display: block; padding: 4px 16px; font-size: 13px; color: #aaa; text-decoration: none; }
  .project-link:hover { background: #1a1a1a; color: #fff; }
  .project-name { display: block; }
  .project-profile { font-size: 11px; color: #555; }
</style>
