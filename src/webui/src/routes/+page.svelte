<script lang="ts">
  import { onMount } from 'svelte';
  import MarkdownRenderer from './MarkdownRenderer.svelte';

  let content = $state('');
  let frontmatter = $state<Record<string, any> | null>(null);

  onMount(async () => {
    const res = await fetch('/api/read?path=PROPOSAL.md');
    if (res.ok) {
      const data = await res.json();
      const parts = splitFrontmatter(data.content);
      frontmatter = parts.frontmatter;
      content = parts.body;
    }
  });

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
</script>

<div class="welcome">
  <h2>docwright</h2>
  <p class="subtitle">Organizational Operating System</p>
  <hr />
  {#if frontmatter}
    <div class="fm">
      {#each Object.entries(frontmatter) as [key, val]}
        <span class="fm-entry"><strong>{key}:</strong> {val}</span>
      {/each}
    </div>
  {/if}
  <div class="body">
    <MarkdownRenderer {content} />
  </div>
</div>

<style>
  .welcome { max-width: 720px; margin: 0 auto; padding: 32px; }
  h2 { font-size: 24px; font-weight: 600; color: #fff; margin: 0 0 4px; }
  .subtitle { color: #888; font-size: 14px; margin: 0 0 24px; }
  hr { border: none; border-top: 1px solid #333; margin: 0 0 24px; }
  .fm { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 12px; background: #222; border-radius: 6px; margin-bottom: 24px; font-size: 12px; }
  .fm-entry { color: #aaa; }
  .fm-entry strong { color: #fff; }
  .body { line-height: 1.6; }
</style>
