<script lang="ts">
  import { goto } from '$app/navigation';
  import { searchFocusTrigger } from '$lib/searchFocus.js';
  import { onMount } from 'svelte';

  // Focus when the shell triggers Ctrl+K or clicking the Search activity bar button
  onMount(() => searchFocusTrigger.subscribe(v => { if (v > 0) inputEl?.focus(); }));

  interface SearchResult {
    path: string;
    title: string;
    type: string;
    excerpt: string;
    score: number;
  }

  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let loading = $state(false);
  let searched = $state(false);
  let inputEl: HTMLInputElement;
  let debounceTimer: ReturnType<typeof setTimeout>;

  export function focusSearch() {
    inputEl?.focus();
  }

  const TYPE_LABELS: Record<string, string> = {
    'proposal': 'Proposal',
    'approved-proposal': 'Approved',
    'plan': 'Plan',
    'completed-plan': 'Done',
    'policy': 'Policy',
    'sop': 'SOP',
    'doc': 'Doc',
  };

  const TYPE_COLORS: Record<string, string> = {
    'proposal': 'var(--accent-2, #7c6af7)',
    'approved-proposal': 'var(--accent-1, #4caf50)',
    'plan': 'var(--accent-3, #f59e0b)',
    'completed-plan': 'var(--muted, #888)',
    'policy': 'var(--accent-4, #ef4444)',
    'sop': 'var(--accent-5, #06b6d4)',
    'doc': 'var(--muted, #888)',
  };

  async function search(q: string) {
    if (q.length < 2) { results = []; searched = false; return; }
    loading = true;
    searched = true;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      results = data.results ?? [];
    } catch { results = []; }
    loading = false;
  }

  function onInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(query), 200);
  }

  function open(result: SearchResult) {
    goto('/' + result.path.replace(/\.md$/, ''));
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { query = ''; results = []; searched = false; }
  }
</script>

<div class="search-panel">
  <div class="search-input-wrap">
    <span class="search-icon">🔍</span>
    <input
      bind:this={inputEl}
      bind:value={query}
      oninput={onInput}
      onkeydown={onKeydown}
      class="search-input"
      type="search"
      placeholder="Search vault…"
      autocomplete="off"
      spellcheck="false"
    />
    {#if query}
      <button class="clear-btn" onclick={() => { query = ''; results = []; searched = false; inputEl?.focus(); }}>✕</button>
    {/if}
  </div>

  {#if loading}
    <div class="search-status">Searching…</div>
  {:else if searched && results.length === 0}
    <div class="search-status empty">No results for <em>{query}</em></div>
  {:else if results.length > 0}
    <ul class="results">
      {#each results as r}
        <li class="result" onclick={() => open(r)}>
          <div class="result-header">
            <span class="result-title">{r.title}</span>
            <span class="result-badge" style="background:{TYPE_COLORS[r.type] ?? '#888'}">{TYPE_LABELS[r.type] ?? r.type}</span>
          </div>
          <div class="result-path">{r.path}</div>
          <div class="result-excerpt">{r.excerpt}</div>
        </li>
      {/each}
    </ul>
  {:else if !searched}
    <div class="search-hint">Type at least 2 characters to search</div>
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

  .search-status, .search-hint {
    padding: 16px 12px; font-size: 12px; color: var(--muted, #666);
    text-align: center;
  }
  .search-status.empty em { color: var(--fg, #ddd); font-style: normal; }

  .results {
    list-style: none; margin: 0; padding: 4px 0;
    overflow-y: auto; flex: 1;
  }
  .result {
    padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border, #2a2a2a);
    transition: background 0.1s;
  }
  .result:hover { background: var(--bg-hover, #252525); }
  .result-header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .result-title {
    font-size: 12px; font-weight: 600; color: var(--fg, #ddd);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
  }
  .result-badge {
    font-size: 9px; font-weight: 700; padding: 1px 5px;
    border-radius: 3px; color: #fff; white-space: nowrap; opacity: 0.85;
    flex-shrink: 0;
  }
  .result-path {
    font-size: 10px; color: var(--muted, #666); margin-bottom: 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .result-excerpt {
    font-size: 11px; color: var(--fg-dim, #999); line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
