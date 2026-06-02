<script lang="ts">
  import { page } from '$app/stores';
  import MarkdownRenderer from '../MarkdownRenderer.svelte';

  let content = $state('');
  let frontmatter = $state<Record<string, any> | null>(null);
  let error = $state<string | null>(null);

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

  async function loadFile() {
    const filePath = $page.params.path + '.md';
    const res = await fetch('/api/read?path=' + encodeURIComponent(filePath));
    if (!res.ok) {
      if (res.status === 404) {
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
    const parsed = splitFrontmatter(data.content);
    frontmatter = parsed.frontmatter;
    content = parsed.body;
  }
</script>

<div class="page">
  {#if error}
    <p class="error">{error}</p>
  {:else if frontmatter}
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
</div>

<style>
  .page { max-width: 780px; margin: 0 auto; padding: 32px; }
  .error { color: #e44; padding: 16px; background: #2a1111; border-radius: 6px; }
  .fm { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 12px; background: #222; border-radius: 6px; margin-bottom: 24px; font-size: 12px; }
  .fm-entry { color: #aaa; }
  .fm-entry strong { color: #fff; }
  .body { line-height: 1.6; }
  .muted { color: #666; }
</style>
