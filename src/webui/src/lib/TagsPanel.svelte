<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  interface TagEntry { tag: string; count: number; }

  let tags = $state<TagEntry[]>([]);
  let loading = $state(true);
  let filter = $state('');
  let filterInput: HTMLInputElement;

  export function focus() { filterInput?.focus(); }

  async function load() {
    loading = true;
    try {
      const res = await fetch('/api/tags');
      const d = await res.json();
      tags = d.tags ?? [];
    } catch { tags = []; }
    loading = false;
  }

  onMount(load);

  const visible = $derived(
    filter.trim()
      ? tags.filter(t => t.tag.includes(filter.trim().toLowerCase()))
      : tags
  );

  function searchTag(tag: string) {
    goto(`/status`);
    // Navigate to search results for this tag
    setTimeout(() => {
      const url = new URL(window.location.href);
      window.history.pushState({}, '', '/');
      // Use the search panel — dispatch a custom event the layout can pick up
      window.dispatchEvent(new CustomEvent('dw:search', { detail: { q: tag } }));
    }, 50);
  }
</script>

<div class="tags-panel">
  <div class="tags-filter-wrap">
    <input
      bind:this={filterInput}
      bind:value={filter}
      class="tags-filter"
      type="search"
      placeholder="Filter tags…"
      autocomplete="off"
    />
  </div>

  {#if loading}
    <div class="tags-status">Loading…</div>
  {:else if visible.length === 0}
    <div class="tags-status">No tags found</div>
  {:else}
    <div class="tags-header-row">
      <span class="tags-label-col">Tag</span>
      <span class="tags-count-col">Docs</span>
    </div>
    <ul class="tags-list">
      {#each visible as { tag, count }}
        <li class="tag-row" onclick={() => searchTag(tag)}>
          <span class="tag-name">#{tag}</span>
          <span class="tag-count">{count}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .tags-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .tags-filter-wrap {
    padding: 8px 10px; border-bottom: 1px solid var(--border, #2a2a2a);
    background: var(--bg-2, #1a1a1a); flex-shrink: 0;
  }
  .tags-filter {
    width: 100%; background: none; border: none; outline: none;
    color: var(--fg, #ddd); font-size: 13px; font-family: inherit;
    box-sizing: border-box;
  }
  .tags-filter::placeholder { color: var(--muted, #666); }
  .tags-filter::-webkit-search-cancel-button { display: none; }

  .tags-status { padding: 16px 12px; font-size: 12px; color: var(--muted, #666); text-align: center; }

  .tags-header-row {
    display: flex; justify-content: space-between;
    padding: 4px 12px; font-size: 10px; font-weight: 600;
    color: var(--muted, #555); text-transform: uppercase; letter-spacing: 0.4px;
    border-bottom: 1px solid var(--border, #222); flex-shrink: 0;
  }
  .tags-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
  .tag-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 12px; cursor: pointer; font-size: 12px;
    border-bottom: 1px solid var(--border, #1a1a1a);
    transition: background 0.1s;
  }
  .tag-row:hover { background: var(--bg-hover, #252525); }
  .tag-name { color: var(--accent, #7c9ef7); font-family: monospace; }
  .tag-count {
    font-size: 10px; color: var(--muted, #666);
    background: var(--bg-3, #2a2a2a); padding: 1px 6px; border-radius: 8px;
  }
</style>
