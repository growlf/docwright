<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { searchFocusTrigger } from '$lib/searchFocus.js';

  interface TagEntry { tag: string; count: number; }

  let tags = $state<TagEntry[]>([]);
  let loading = $state(true);
  let filter = $state('');
  let filterInput: HTMLInputElement;

  // Focus when Ctrl+K or Search panel clicked
  onMount(() => searchFocusTrigger.subscribe(v => { if (v > 0) filterInput?.focus(); }));

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
    goto(`/search?q=${encodeURIComponent('#' + tag)}`);
  }
</script>

<div class="search-panel">
  <div class="search-input-wrap">
    <span class="search-icon">🏷️</span>
    <input
      bind:this={filterInput}
      bind:value={filter}
      class="search-input"
      type="search"
      placeholder="Filter tags…"
      autocomplete="off"
      spellcheck="false"
    />
    {#if filter}
      <button class="clear-btn" onclick={() => { filter = ''; filterInput?.focus(); }}>✕</button>
    {/if}
  </div>

  {#if loading}
    <div class="search-status">Loading tags…</div>
  {:else if visible.length === 0}
    <div class="search-status empty">No tags found</div>
  {:else}
    <div class="tags-header-row">
      <span class="tags-label-col">Tag</span>
      <span class="tags-count-col">Docs</span>
    </div>
    <ul class="results">
      {#each visible as { tag, count }}
        <li class="result-row" onclick={() => searchTag(tag)}>
          <span class="tag-name">#{tag}</span>
          <span class="tag-count">{count}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .search-input-wrap {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border, #2a2a2a);
    background: var(--bg-2, #1a1a1a);
    flex-shrink: 0;
  }
  .search-icon { font-size: 13px; opacity: 0.5; }
  .search-input {
    flex: 1; background: none; border: none; outline: none;
    color: var(--fg, #ddd); font-size: 13px;
    font-family: inherit;
  }
  .search-input::placeholder { color: var(--muted, #666); }
  .search-input::-webkit-search-cancel-button { display: none; }
  .clear-btn {
    background: none; border: none; color: var(--muted, #666);
    cursor: pointer; font-size: 11px; padding: 2px 4px;
  }
  .clear-btn:hover { color: var(--fg, #ddd); }

  .search-status {
    padding: 16px 12px; font-size: 12px; color: var(--muted, #666);
    text-align: center;
  }

  .tags-header-row {
    display: flex; justify-content: space-between;
    padding: 6px 12px; font-size: 10px; font-weight: 600;
    color: var(--muted, #555); text-transform: uppercase; letter-spacing: 0.4px;
    border-bottom: 1px solid var(--border, #222); flex-shrink: 0;
  }

  .results {
    list-style: none; margin: 0; padding: 0;
    overflow-y: auto; flex: 1;
  }
  .result-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; cursor: pointer; font-size: 12px;
    border-bottom: 1px solid var(--border, #1a1a1a);
    transition: background 0.1s;
  }
  .result-row:hover { background: var(--bg-hover, #252525); }
  .tag-name { color: var(--accent, #7c9ef7); font-family: monospace; font-weight: 600; }
  .tag-count {
    font-size: 10px; color: var(--muted, #888);
    background: var(--bg-3, #2a2a2a); padding: 1px 6px; border-radius: 8px;
  }
</style>
