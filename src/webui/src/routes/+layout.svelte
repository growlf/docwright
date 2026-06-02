<script lang="ts">
  import { goto } from '$app/navigation';
  import FileTree from './FileTree.svelte';
  import { page } from '$app/stores';

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
</script>

<div id="app">
  <aside id="sidebar">
    <div class="sidebar-header">
      <h1>docwright</h1>
      <button class="new-btn" onclick={newFile}>+</button>
    </div>
    <FileTree currentPath={$page.url.pathname} />
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
</style>
