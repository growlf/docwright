<script lang="ts">
  let {
    matches,
    loading = false,
    oninsert,
    onsubsume,
    onclose,
  }: {
    matches: Array<{
      path: string;
      title: string;
      score: number;
      sections: Array<{ heading: string; content: string }>;
    }>;
    loading?: boolean;
    oninsert?: (slug: string, heading: string, content: string) => void;
    onsubsume?: (path: string) => void;
    onclose?: () => void;
  } = $props();

  let expanded = $state<Set<string>>(new Set());
  let subsumed = $state<Set<string>>(new Set());
  let inserted = $state<Set<string>>(new Set());

  function toggleExpand(p: string) {
    const next = new Set(expanded);
    next.has(p) ? next.delete(p) : next.add(p);
    expanded = next;
  }

  function slug(p: string) {
    return p.replace(/^.*\//, '').replace(/\.md$/, '');
  }

  function scoreLabel(s: number) {
    if (s >= 0.4) return 'high';
    if (s >= 0.25) return 'medium';
    return 'low';
  }

  function handleInsert(match: { path: string }, section: { heading: string; content: string }) {
    const key = match.path + '#' + section.heading;
    oninsert?.(slug(match.path), section.heading, section.content);
    const next = new Set(inserted);
    next.add(key);
    inserted = next;
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
    <span class="panel-title">Related proposals</span>
    <button class="close-btn" onclick={onclose}>✕</button>
  </div>

  {#if loading}
    <div class="loading">Scanning for related proposals…</div>
  {:else if matches.length === 0}
    <div class="empty">No significant overlaps found.</div>
  {:else}
    <div class="hint">
      Click <strong>Insert</strong> to quote a section into this document.
    </div>
    {#each matches as match}
      <div class="match" class:subsumed={subsumed.has(match.path)}>
        <button class="match-header" onclick={() => toggleExpand(match.path)}>
          <span class="match-title">{match.title || match.path}</span>
          <span class="score {scoreLabel(match.score)}">{Math.round(match.score * 100)}%</span>
          <span class="expand-icon">{expanded.has(match.path) ? '▾' : '▸'}</span>
        </button>

        {#if expanded.has(match.path)}
          <div class="match-body">
            {#each match.sections as section}
              <div class="section">
                <div class="section-heading">
                  <span>{section.heading}</span>
                  {#if inserted.has(match.path + '#' + section.heading)}
                    <span class="inserted-badge">✓ inserted</span>
                  {:else if section.content.trim()}
                    <button class="insert-btn" onclick={() => handleInsert(match, section)}>
                      Insert ↓
                    </button>
                  {/if}
                </div>
                {#if section.content.trim()}
                  <div class="section-preview">{section.content.slice(0, 200)}{section.content.length > 200 ? '…' : ''}</div>
                {:else}
                  <div class="section-preview muted">(empty)</div>
                {/if}
              </div>
            {/each}

            {#if !subsumed.has(match.path)}
              <div class="subsume-row">
                <label class="subsume-label">
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
    position: fixed;
    top: 0; right: 0;
    width: 360px;
    height: 100vh;
    background: #111;
    border-left: 1px solid #2a2a2a;
    display: flex;
    flex-direction: column;
    z-index: 500;
    box-shadow: -4px 0 20px rgba(0,0,0,0.5);
    overflow: hidden;
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
  .close-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; padding: 2px 4px; }
  .close-btn:hover { color: #aaa; }

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
  .insert-btn {
    background: none;
    border: 1px solid #2b5b84;
    color: #58a6ff;
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 3px;
    cursor: pointer;
  }
  .insert-btn:hover { background: #1a3a5a; }
  .inserted-badge { font-size: 10px; color: #6d6; }

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
