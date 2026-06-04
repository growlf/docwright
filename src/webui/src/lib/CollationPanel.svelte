<script lang="ts">
  let {
    matches,
    alreadyRelated = [] as string[],
    loading = false,
    onaddrelated,
    onsubsume,
    onclose,
    onrecheck,
  }: {
    matches: Array<{
      path: string;
      title: string;
      score: number;
      sections: Array<{ heading: string; content: string }>;
    }>;
    alreadyRelated?: string[];
    loading?: boolean;
    onaddrelated?: (path: string) => void;
    onsubsume?: (path: string) => void;
    onclose?: () => void;
    onrecheck?: () => void;
  } = $props();

  let expanded  = $state<Set<string>>(new Set());
  let subsumed  = $state<Set<string>>(new Set());
  let justAdded = $state<Set<string>>(new Set());

  function toggleExpand(p: string) {
    const next = new Set(expanded);
    next.has(p) ? next.delete(p) : next.add(p);
    expanded = next;
  }

  function scoreLabel(s: number) {
    if (s >= 0.4) return 'high';
    if (s >= 0.25) return 'medium';
    return 'low';
  }

  function isRelated(path: string): boolean {
    const norm = path.replace(/\.md$/, '');
    return justAdded.has(path) ||
      alreadyRelated.some(r => r === path || r === norm || r.replace(/\.md$/, '') === norm);
  }

  function handleAddRelated(path: string) {
    onaddrelated?.(path);
    const next = new Set(justAdded);
    next.add(path);
    justAdded = next;
  }

  function handleSubsume(match: { path: string }) {
    const next = new Set(subsumed);
    next.add(match.path);
    subsumed = next;
    onsubsume?.(match.path);
  }
</script>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">
      {#if loading}Scanning…{:else}{matches.length} related{/if}
    </span>
    <button class="recheck-btn" onclick={onrecheck} title="Re-scan for related proposals" disabled={loading}>
      ↺
    </button>
    <button class="close-btn" onclick={onclose} title="Back to Properties">← Props</button>
  </div>

  {#if loading}
    <div class="loading">Scanning for related proposals…</div>
  {:else if matches.length === 0}
    <div class="empty">No related proposals found.<br><small>Open a proposal and click ↺ to scan.</small></div>
  {:else}
    <div class="hint">
      <strong>Add as related</strong> writes to <code>related_to:</code> frontmatter — the correct way to link documents in the governance system.
    </div>
    {#each matches as match}
      <div class="match" class:subsumed={subsumed.has(match.path)}>
        <button class="match-header" onclick={() => toggleExpand(match.path)} title="Click to expand sections">
          <span class="match-title">{match.title || match.path}</span>
          <span class="score {scoreLabel(match.score)}">{Math.round(match.score * 100)}%</span>
          <span class="expand-icon">{expanded.has(match.path) ? '▾' : '▸'}</span>
        </button>

        <div class="match-actions">
          {#if isRelated(match.path)}
            <span class="related-badge" title="Already in related_to: frontmatter">✓ Related</span>
          {:else}
            <button class="add-related-btn" onclick={() => handleAddRelated(match.path)}
              title="Add to related_to: frontmatter — creates a structured, queryable link">
              + Add as related
            </button>
          {/if}
        </div>

        {#if expanded.has(match.path)}
          <div class="match-body">
            {#each match.sections as section}
              <div class="section">
                <div class="section-heading"><span>{section.heading}</span></div>
                {#if section.content.trim()}
                  <div class="section-preview">{section.content.slice(0, 200)}{section.content.length > 200 ? '…' : ''}</div>
                {:else}
                  <div class="section-preview muted">(empty)</div>
                {/if}
              </div>
            {/each}

            {#if !subsumed.has(match.path)}
              <div class="subsume-row">
                <label class="subsume-label" title="Mark the related proposal as absorbed into this one — sets subsumed_by in its frontmatter so it no longer appears as a standalone open proposal">
                  <input type="checkbox" onchange={() => handleSubsume(match)} />
                  Mark as subsumed by this proposal
                </label>
              </div>
            {:else}
              <div class="subsumed-note">Marked as subsumed ✓</div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .panel {
    /* Fills the right sidebar tab — no longer a fixed overlay */
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    height: 100%;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #222;
    flex-shrink: 0;
  }
  .panel-title { font-size: 12px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
  .recheck-btn { background: none; border: 1px solid #333; color: #666; cursor: pointer; font-size: 13px; padding: 1px 6px; border-radius: 3px; }
  .recheck-btn:hover:not(:disabled) { color: #58a6ff; border-color: #2b5b84; }
  .recheck-btn:disabled { opacity: 0.4; cursor: default; }
  .close-btn { background: none; border: 1px solid #333; color: #555; cursor: pointer; font-size: 10px; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
  .close-btn:hover { color: #aaa; border-color: #555; }

  .loading, .empty {
    padding: 24px 16px;
    color: #555;
    font-size: 13px;
    text-align: center;
  }

  .hint {
    padding: 8px 16px;
    font-size: 11px;
    color: #555;
    border-bottom: 1px solid #1a1a1a;
  }

  .match {
    border-bottom: 1px solid #1a1a1a;
    overflow: hidden;
  }
  .match.subsumed { opacity: 0.5; }

  .match-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    cursor: pointer;
    user-select: none;
    width: 100%;
    background: none;
    border: none;
    text-align: left;
    color: inherit;
    font: inherit;
  }
  .match-header:hover { background: #1a1a1a; }
  .match-title { flex: 1; font-size: 12px; color: #ccc; }
  .score {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 8px;
    border: 1px solid;
  }
  .score.high   { color: #e87; border-color: #e87; background: #2a1a10; }
  .score.medium { color: #cc6; border-color: #cc6; background: #2a2a10; }
  .score.low    { color: #78a; border-color: #78a; background: #101a2a; }
  .expand-icon  { color: #555; font-size: 11px; }

  .match-body {
    padding: 0 16px 12px;
    overflow-y: auto;
    max-height: 400px;
  }

  .section { margin-top: 10px; }
  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
  }
  .match-actions { padding: 4px 12px 6px; }
  .add-related-btn {
    background: none;
    border: 1px solid #2b5b84;
    color: #58a6ff;
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    text-align: left;
  }
  .add-related-btn:hover { background: #1a3a5a; }
  .related-badge { font-size: 11px; color: #6d6; padding: 2px 0; display: block; }

  .section-preview {
    font-size: 11px;
    color: #666;
    line-height: 1.5;
    white-space: pre-wrap;
    background: #0d0d0d;
    border-radius: 3px;
    padding: 6px 8px;
  }
  .section-preview.muted { font-style: italic; }

  .subsume-row { margin-top: 10px; }
  .subsume-label { font-size: 11px; color: #555; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .subsume-label input { cursor: pointer; }
  .subsumed-note { font-size: 11px; color: #6d6; margin-top: 10px; }

  .panel > div:not(.panel-header) { overflow-y: auto; }
</style>
