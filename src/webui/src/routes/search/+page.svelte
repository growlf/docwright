<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let searchInput = $state('');
  let results = $state<any[]>([]);
  let loading = $state(false);
  let searched = $state(false);

  // Watch page store query changes
  $effect(() => {
    const q = $page.url.searchParams.get('q') || '';
    searchInput = q;
    if (q.trim().length >= 2) {
      loading = true;
      searched = true;
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then(res => res.json())
        .then(data => {
          results = data.results || [];
          loading = false;
        })
        .catch(() => {
          results = [];
          loading = false;
        });
    } else {
      results = [];
      searched = false;
      loading = false;
    }
  });

  let debounceTimer: any;
  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const params = new URLSearchParams($page.url.searchParams);
      if (searchInput) {
        params.set('q', searchInput);
      } else {
        params.delete('q');
      }
      goto(`?${params.toString()}`, { keepFocus: true, replaceState: true });
    }, 200);
  }

  function openResult(r: any) {
    if (r.path.startsWith('/plugin/') || r.path.startsWith('plugin/')) {
      const target = r.path.startsWith('/') ? r.path : '/' + r.path;
      goto(target);
    } else {
      goto('/' + r.path.replace(/\.md$/, ''));
    }
  }

  // Grouped results computed properties
  let vaultResults = $derived(results.filter(r => !r.path.startsWith('plugin/') && !r.path.startsWith('/plugin/')));
  let pluginResults = $derived(results.filter(r => r.path.startsWith('plugin/') || r.path.startsWith('/plugin/')));

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
</script>

<div class="search-page-container">
  <div class="header-section">
    <h1>Vault Search</h1>
    <p class="subtitle">Search files, plans, proposals, policies, and active plugin objects</p>
  </div>

  <div class="search-box-wrapper">
    <span class="search-decor-icon">🔍</span>
    <input
      type="text"
      bind:value={searchInput}
      oninput={handleInput}
      placeholder="Type query to search files and plugin databases..."
      class="large-search-input"
      autocomplete="off"
      spellcheck="false"
      autofocus
    />
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Searching vault and active plugins...</span>
    </div>
  {:else if searched && results.length === 0}
    <div class="no-results-state">
      <div class="no-results-icon">📭</div>
      <h3>No results found</h3>
      <p>We couldn't find matches for "{searchInput}" in documents or plugins.</p>
    </div>
  {:else if searched}
    <div class="results-layout">
      <!-- Left Column: Vault Documents -->
      <div class="results-column">
        <h2 class="column-title">Vault Documents ({vaultResults.length})</h2>
        {#if vaultResults.length === 0}
          <p class="empty-column-msg">No matching vault documents</p>
        {:else}
          <div class="results-grid">
            {#each vaultResults as r}
              <div class="result-card" onclick={() => openResult(r)}>
                <div class="card-header">
                  <span class="card-type-badge" style="background: {TYPE_COLORS[r.type] ?? '#888'}">
                    {TYPE_LABELS[r.type] ?? r.type}
                  </span>
                  <span class="score-indicator">relevance: {r.score}</span>
                </div>
                <h3 class="card-title">{r.title}</h3>
                <span class="card-path">{r.path}</span>
                <p class="card-excerpt">{@html r.excerpt}</p>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Right Column: Plugin Data -->
      <div class="results-column">
        <h2 class="column-title">Plugin Objects ({pluginResults.length})</h2>
        {#if pluginResults.length === 0}
          <p class="empty-column-msg">No matching plugin database objects</p>
        {:else}
          <div class="results-grid">
            {#each pluginResults as r}
              <div class="result-card plugin-card" onclick={() => openResult(r)}>
                <div class="card-header">
                  <span class="card-type-badge" style="background: {r.badgeColor ?? '#7c6af7'}">
                    {r.badge ?? r.type}
                  </span>
                  <span class="plugin-source-indicator">🔌 {r.type}</span>
                </div>
                <h3 class="card-title">{r.title}</h3>
                <p class="card-excerpt">{@html r.excerpt}</p>
                <div class="card-action-bar">
                  <span class="action-btn">Open in Plugin →</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="initial-state">
      <div class="initial-icon">⚡</div>
      <h3>Search Everything</h3>
      <p>Enter a keyword to query full-text content in the vault files and query all active plugins.</p>
    </div>
  {/if}
</div>

<style>
  .search-page-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 30px 20px;
    color: var(--fg, #ddd);
    font-family: var(--font-sans, 'Inter', -apple-system, sans-serif);
  }

  .header-section {
    margin-bottom: 24px;
    text-align: center;
  }

  .header-section h1 {
    font-size: 2.2rem;
    font-weight: 800;
    margin: 0 0 6px 0;
    background: linear-gradient(135deg, #fff 30%, var(--accent-2, #7c6af7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--muted, #888);
    margin: 0;
  }

  .search-box-wrapper {
    position: relative;
    max-width: 700px;
    margin: 0 auto 40px auto;
  }

  .search-decor-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.1rem;
    opacity: 0.6;
  }

  .large-search-input {
    width: 100%;
    padding: 14px 16px 14px 44px;
    font-size: 1.05rem;
    border-radius: 12px;
    border: 1px solid var(--border, #2a2a2a);
    background: var(--bg-2, #161616);
    color: var(--fg, #ddd);
    outline: none;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    transition: border-color 0.25s, box-shadow 0.25s;
  }

  .large-search-input:focus {
    border-color: var(--accent-2, #7c6af7);
    box-shadow: 0 0 0 3px rgba(124, 106, 247, 0.15), 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  /* States */
  .loading-state, .no-results-state, .initial-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(255, 255, 255, 0.05);
    border-top-color: var(--accent-2, #7c6af7);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .no-results-icon, .initial-icon {
    font-size: 3rem;
    margin-bottom: 12px;
  }

  .no-results-state h3, .initial-state h3 {
    margin: 0 0 6px 0;
    font-size: 1.25rem;
    font-weight: 700;
  }

  .no-results-state p, .initial-state p {
    color: var(--muted, #888);
    font-size: 0.95rem;
    margin: 0;
    max-width: 400px;
  }

  /* Columns Layout */
  .results-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
  }

  @media (max-width: 900px) {
    .results-layout {
      grid-template-columns: 1fr;
    }
  }

  .results-column {
    display: flex;
    flex-direction: column;
  }

  .column-title {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border, #2a2a2a);
    color: var(--fg, #ddd);
  }

  .empty-column-msg {
    color: var(--muted, #666);
    font-size: 0.95rem;
    font-style: italic;
    padding: 20px 0;
  }

  .results-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Card Styles */
  .result-card {
    background: var(--bg-card, #1c1c1e);
    border: 1px solid var(--border, #2c2c2e);
    border-radius: 10px;
    padding: 16px;
    cursor: pointer;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }

  .result-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent-2, #7c6af7);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .card-type-badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .score-indicator, .plugin-source-indicator {
    font-size: 0.75rem;
    color: var(--muted, #888);
  }

  .card-title {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: var(--fg, #eee);
  }

  .card-path {
    display: block;
    font-size: 0.75rem;
    color: var(--muted, #666);
    margin-bottom: 8px;
    word-break: break-all;
  }

  .card-excerpt {
    font-size: 0.88rem;
    color: var(--fg-dim, #aaa);
    line-height: 1.5;
    margin: 0;
  }

  /* Plugin-specific styling */
  .plugin-card {
    border-left: 3px solid var(--accent-2, #7c6af7);
  }
  .plugin-card:hover {
    border-left-color: var(--accent-2, #7c6af7);
  }

  .card-action-bar {
    margin-top: 12px;
    text-align: right;
  }

  .action-btn {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--accent-2, #7c6af7);
  }
</style>
