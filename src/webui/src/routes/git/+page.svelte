<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { gitSearchQuery } from '$lib/gitVc.js';
  import { showToast } from '$lib/toast.js';

  let { data } = $props();

  let copiedHash = $state('');
  let refreshing = $state(false);

  // Filter commits in real time using the sidebar search query
  let filteredCommits = $derived(
    data.commits.filter((c: any) =>
      c.subject.toLowerCase().includes($gitSearchQuery.toLowerCase()) ||
      c.hash.toLowerCase().includes($gitSearchQuery.toLowerCase()) ||
      c.author.toLowerCase().includes($gitSearchQuery.toLowerCase())
    )
  );

  async function handleRefresh() {
    refreshing = true;
    await invalidateAll();
    refreshing = false;
    showToast('Git status refreshed', 'info');
  }

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
      copiedHash = hash;
      showToast(`Hash ${hash} copied to clipboard`, 'success');
      setTimeout(() => {
        if (copiedHash === hash) copiedHash = '';
      }, 2000);
    } catch {
      showToast('Failed to copy hash', 'error');
    }
  }
</script>

<div class="git-dashboard">
  <div class="git-header">
    <div class="git-title-section">
      <span class="git-icon">⎇</span>
      <h1>Version Control</h1>
    </div>
    <button class="git-refresh-btn" class:refreshing onclick={handleRefresh} disabled={refreshing}>
      <span class="btn-icon">🔄</span>
      <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
    </button>
  </div>

  <!-- Sync Status Card -->
  <div class="git-sync-card">
    <div class="branch-info">
      <div class="branch-meta">
        <span class="meta-label">Active Branch</span>
        <span class="branch-name">{data.branch}</span>
      </div>
      {#if data.remote}
        <div class="branch-meta">
          <span class="meta-label">Tracking Remote</span>
          <span class="remote-name">{data.remote}/{data.branch}</span>
        </div>
      {/if}
      {#if data.latestTag}
        <div class="branch-meta">
          <span class="meta-label">Latest Tag</span>
          <span class="tag-pill">{data.latestTag}</span>
        </div>
      {/if}
    </div>

    <div class="sync-metrics">
      <div class="metric-pill" class:has-count={data.ahead > 0}>
        <span class="metric-icon">📤</span>
        <span class="metric-val">{data.ahead}</span>
        <span class="metric-lbl">ahead to push</span>
      </div>
      <div class="metric-pill" class:has-count={data.behind > 0}>
        <span class="metric-icon">📥</span>
        <span class="metric-val">{data.behind}</span>
        <span class="metric-lbl">behind to pull</span>
      </div>
    </div>
  </div>

  <!-- Commit Log Timeline Section -->
  <div class="git-log-section">
    <div class="section-header">
      <h2>Commit History</h2>
      {#if $gitSearchQuery}
        <span class="search-indicator">Filtering by "{$gitSearchQuery}"</span>
      {/if}
    </div>

    {#if filteredCommits.length === 0}
      <div class="git-empty-state">
        <span class="empty-icon">📂</span>
        <p class="empty-title">No commits found</p>
        <p class="empty-desc">
          {$gitSearchQuery ? 'Try adjusting your search filter' : 'No commit log history exists on this branch.'}
        </p>
      </div>
    {:else}
      <div class="timeline-container">
        <div class="timeline-line"></div>
        <div class="timeline-list">
          {#each filteredCommits as commit, index}
            <div class="timeline-item">
              <div class="timeline-marker">
                <div class="marker-dot"></div>
              </div>
              <div class="timeline-card">
                <div class="commit-header">
                  <button class="hash-btn" onclick={() => copyHash(commit.hash)} title="Click to copy hash">
                    <code>{commit.hash}</code>
                    <span class="copy-indicator">{copiedHash === commit.hash ? 'copied!' : 'copy'}</span>
                  </button>
                  <span class="commit-date">{commit.date}</span>
                </div>
                <p class="commit-subject">{commit.subject}</p>
                <div class="commit-footer">
                  <span class="commit-author">👤 {commit.author}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  @use '../../lib/_tokens.scss' as *;

  .git-dashboard {
    max-width: 900px;
    margin: 0 auto;
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    color: var(--fg, #e2e8f0);
  }

  /* ── Header ────────────────────────────────────────────── */
  .git-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border, #334155);
    padding-bottom: 16px;
  }
  .git-title-section {
    display: flex;
    align-items: center;
    gap: 12px;

    .git-icon {
      font-size: 28px;
      color: var(--accent, #3b82f6);
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }
  }
  .git-refresh-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-3, #1e293b);
    border: 1px solid var(--border, #334155);
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-dim, #cbd5e1);
    transition: background 0.2s, border-color 0.2s, transform 0.1s;

    &:hover:not(:disabled) {
      background: var(--bg-hover, #2d3748);
      border-color: var(--accent, #3b82f6);
      color: var(--fg, #f8fafc);
    }
    &:active:not(:disabled) {
      transform: scale(0.98);
    }
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-icon {
      font-size: 14px;
    }
    &.refreshing .btn-icon {
      animation: spin 1s linear infinite;
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ── Sync status card ───────────────────────────────────── */
  .git-sync-card {
    background: var(--bg-2, #0f172a);
    border: 1px solid var(--border, #334155);
    border-radius: 12px;
    padding: 20px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .branch-info {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
  }
  .branch-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--muted, #64748b);
      font-weight: 600;
    }
    .branch-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--accent, #3b82f6);
    }
    .remote-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--fg-dim, #cbd5e1);
    }
    .tag-pill {
      font-size: 12px;
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent, #3b82f6);
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 600;
      border: 1px solid rgba(59, 130, 246, 0.3);
      width: fit-content;
    }
  }
  .sync-metrics {
    display: flex;
    gap: 12px;
  }
  .metric-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-3, #1e293b);
    border: 1px solid var(--border, #334155);
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 13px;
    color: var(--muted, #64748b);
    transition: background 0.2s, border-color 0.2s;

    .metric-icon {
      font-size: 14px;
    }
    .metric-val {
      font-weight: 700;
      font-size: 15px;
    }
    &.has-count {
      border-color: var(--accent, #3b82f6);
      background: rgba(59, 130, 246, 0.08);
      color: var(--fg, #f8fafc);
      .metric-val {
        color: var(--accent, #3b82f6);
      }
    }
  }

  /* ── Commit History Timeline ────────────────────────────── */
  .git-log-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h2 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }
    .search-indicator {
      font-size: 12px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px dashed rgba(59, 130, 246, 0.4);
      color: var(--accent, #3b82f6);
      padding: 4px 10px;
      border-radius: 4px;
    }
  }

  .timeline-container {
    position: relative;
    padding-left: 24px;
  }
  .timeline-line {
    position: absolute;
    top: 12px;
    bottom: 12px;
    left: 7px;
    width: 2px;
    background: var(--border, #334155);
  }
  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .timeline-item {
    position: relative;
    display: flex;
    align-items: flex-start;
  }
  .timeline-marker {
    position: absolute;
    left: -24px;
    top: 12px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg, #0f172a);
  }
  .marker-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border, #334155);
    transition: background-color 0.2s, transform 0.2s;
  }
  .timeline-card {
    flex: 1;
    background: var(--bg-2, #0f172a);
    border: 1px solid var(--border, #334155);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: transform 0.2s, border-color 0.2s, background-color 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

    &:hover {
      background-color: var(--bg-hover, #1e293b);
      border-color: var(--accent, #3b82f6);
      transform: translateX(4px);

      & ~ .timeline-marker .marker-dot,
      .timeline-marker .marker-dot {
        background-color: var(--accent, #3b82f6);
        transform: scale(1.3);
      }
    }
  }

  // Hovering card triggers dot highlight
  .timeline-item:hover .marker-dot {
    background-color: var(--accent, #3b82f6);
    transform: scale(1.3);
  }

  .commit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .hash-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-3, #1e293b);
    border: 1px solid var(--border, #334155);
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
    color: var(--accent, #3b82f6);
    transition: background 0.15s;

    &:hover {
      background: var(--border, #334155);
    }
    .copy-indicator {
      font-size: 9px;
      text-transform: uppercase;
      opacity: 0;
      transition: opacity 0.15s;
      color: var(--muted, #64748b);
    }
    &:hover .copy-indicator {
      opacity: 1;
    }
  }
  .commit-date {
    font-size: 11px;
    color: var(--muted, #64748b);
  }
  .commit-subject {
    font-size: 13px;
    font-weight: 500;
    margin: 0;
    color: var(--fg, #f8fafc);
    line-height: 1.4;
  }
  .commit-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--muted, #64748b);
  }

  /* ── Empty & Loading States ────────────────────────────── */
  .git-empty-state {
    text-align: center;
    padding: 48px 24px;
    background: var(--bg-2, #0f172a);
    border: 1px dashed var(--border, #334155);
    border-radius: 12px;

    .empty-icon {
      font-size: 32px;
      display: block;
      margin-bottom: 12px;
    }
    .empty-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--fg, #f8fafc);
      margin: 0 0 6px 0;
    }
    .empty-desc {
      font-size: 12px;
      color: var(--muted, #64748b);
      margin: 0;
    }
  }

  /* ── Light theme styles ────────────────────────────────── */
  :global(html[data-theme="light"]) {
    .git-refresh-btn {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #475569;
      &:hover:not(:disabled) {
        background: #e2e8f0;
        border-color: #3b82f6;
        color: #0f172a;
      }
    }
    .git-sync-card {
      background: #ffffff;
      border-color: #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .branch-meta {
      .branch-name {
        color: #2563eb;
      }
      .remote-name {
        color: #334155;
      }
      .tag-pill {
        background: rgba(37, 99, 235, 0.08);
        color: #2563eb;
        border-color: rgba(37, 99, 235, 0.2);
      }
    }
    .metric-pill {
      background: #f8fafc;
      border-color: #e2e8f0;
      &.has-count {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.04);
        color: #0f172a;
      }
    }
    .git-empty-state {
      background: #ffffff;
      border-color: #e2e8f0;
      .empty-title { color: #0f172a; }
    }
    .timeline-card {
      background: #ffffff;
      border-color: #e2e8f0;
      &:hover {
        background-color: #f8fafc;
        border-color: #2563eb;
      }
      .commit-subject {
        color: #0f172a;
      }
    }
    .hash-btn {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #2563eb;
      &:hover {
        background: #e2e8f0;
      }
    }
  }
</style>
