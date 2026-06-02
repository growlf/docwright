<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MarkdownRenderer from '../MarkdownRenderer.svelte';
  import { fileChanged } from '$lib/fileChanges';

  let raw = $state('');
  let content = $state('');
  let frontmatter = $state<Record<string, any> | null>(null);
  let error = $state<string | null>(null);
  let editing = $state(false);

  function splitFrontmatter(raw: string) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      const fm: Record<string, any> = {};
      for (const line of match[1].split('\n')) {
        const sep = line.indexOf(':');
        if (sep > 0) fm[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
      }
      return { frontmatter: fm, body: match[2] };
    }
    return { frontmatter: null, body: raw };
  }

  $effect(() => {
    loadFile();
  });

  onMount(() => {
    return fileChanged.subscribe((change) => {
      if (!change || editing) return;
      if (change.path === filePath() || change.path.endsWith('/' + filePath())) {
        loadFile();
      }
    });
  });

  async function loadFile() {
    let filePath = $page.params.path;
    if (!filePath.endsWith('.md')) filePath += '.md';
    const res = await fetch('/api/read?path=' + encodeURIComponent(filePath));
    if (!res.ok) {
      if (res.status === 404) {
        raw = '';
        content = '';
        frontmatter = null;
        error = null;
      } else {
        error = 'Failed to load file';
      }
      return;
    }
    error = null;
    const data = await res.json();
    raw = data.content;
    const parsed = splitFrontmatter(data.content);
    frontmatter = parsed.frontmatter;
    content = parsed.body;
  }

  function filePath(): string {
    let p = $page.params.path;
    if (!p.endsWith('.md')) p += '.md';
    return p;
  }

  async function save() {
    const res = await fetch('/api/write?path=' + encodeURIComponent(filePath()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: raw }),
    });
    if (res.ok) {
      editing = false;
      const parsed = splitFrontmatter(raw);
      frontmatter = parsed.frontmatter;
      content = parsed.body;
    }
  }

  async function deleteFile() {
    if (!confirm('Delete ' + filePath() + '?')) return;
    const res = await fetch('/api/delete?path=' + encodeURIComponent(filePath()), {
      method: 'DELETE',
    });
    if (res.ok) goto('/');
  }
</script>

<div class="page">
  <div class="toolbar">
    <span class="path">{filePath()}</span>
    <div class="actions">
      {#if editing}
        <button class="btn save" onclick={save}>Save</button>
        <button class="btn cancel" onclick={() => { editing = false; loadFile(); }}>Cancel</button>
      {:else}
        <button class="btn edit" onclick={() => editing = true}>Edit</button>
        <button class="btn del" onclick={deleteFile}>Delete</button>
      {/if}
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {:else if editing}
    <textarea class="editor" bind:value={raw}></textarea>
  {:else}
    {#if frontmatter}
      <div class="fm">
        {#each Object.entries(frontmatter) as [key, val]}
          <span class="fm-entry"><strong>{key}:</strong> {val}</span>
        {/each}
      </div>
    {/if}
    <div class="body">
      {#if content}
        <MarkdownRenderer {content} />
      {:else}
        <p class="muted">Empty file</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page { max-width: 780px; margin: 0 auto; padding: 32px; }
  .error { color: #e44; padding: 16px; background: #2a1111; border-radius: 6px; }
  .fm { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 12px; background: #222; border-radius: 6px; margin-bottom: 24px; font-size: 12px; }
  .fm-entry { color: #aaa; }
  .fm-entry strong { color: #fff; }
  .body { line-height: 1.6; }
  .muted { color: #666; }

  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #333; }
  .path { font-size: 12px; color: #666; font-family: monospace; }
  .actions { display: flex; gap: 6px; }
  .btn { padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid #444; background: #222; color: #ccc; }
  .btn:hover { background: #333; color: #fff; }
  .btn.save { border-color: #2b5b84; color: #58a6ff; }
  .btn.save:hover { background: #1a3a5a; }
  .btn.cancel { border-color: #555; color: #999; }
  .btn.del { border-color: #842b2b; color: #e44; }
  .btn.del:hover { background: #3a1a1a; }

  .editor { width: 100%; min-height: 60vh; background: #0a0a0a; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 16px; font-family: monospace; font-size: 13px; line-height: 1.5; resize: vertical; }
</style>
