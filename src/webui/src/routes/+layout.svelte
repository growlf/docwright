<script lang="ts">
  import FileTree from './FileTree.svelte';
  import { page } from '$app/stores';
</script>

<div id="app">
  <aside id="sidebar">
    <div class="sidebar-header">
      <h1>docwright</h1>
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
  .sidebar-header { padding: 12px 16px; border-bottom: 1px solid #222; }
  .sidebar-header h1 { font-size: 14px; font-weight: 600; color: #fff; margin: 0; }
  #content { flex: 1; overflow-y: auto; background: #1a1a1a; color: #e0e0e0; scroll-behavior: smooth; }
</style>
