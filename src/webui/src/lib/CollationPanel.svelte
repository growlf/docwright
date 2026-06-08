<script lang="ts">
  let {
    matches,
    relationships = [] as Array<{
      target: string;
      type: string;
      confidence: number;
      targetTitle: string;
    }>,
    alreadyRelated = [] as string[],
    loading = false,
    planMode = false,
    onaddrelated,
    onadddepends,
    onaddblocks,
    onsubsume,
    onclose,
    onrecheck,
    oncreateplan,
  }: {
    matches: Array<{
      path: string;
      title: string;
      score: number;
      sections: Array<{ heading: string; content: string }>;
    }>;
    relationships?: Array<{
      target: string;
      type: string;
      confidence: number;
      targetTitle: string;
    }>;
    alreadyRelated?: string[];
    loading?: boolean;
    planMode?: boolean;
    onaddrelated?: (path: string) => void;
    onadddepends?: (path: string) => void;
    onaddblocks?: (path: string) => void;
    onsubsume?: (path: string) => void;
    onclose?: () => void;
    onrecheck?: () => void;
    oncreateplan?: () => void;
  } = $props();

  let expanded  = $state<Set<string>>(new Set());
  let subsumed  = $state<Set<string>>(new Set());
  let justAdded = $state<Set<string>>(new Set());
  let dismissed = $state<Set<string>>(new Set());

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

  function getRel(path: string) {
    return relationships.find(r => r.target === path);
  }

  function relLabel(type: string): string {
    const labels: Record<string, string> = {
      depends_on: 'Depends on',
      blocks: 'Blocks',
      merge_candidate: 'Merge candidate',
      supersedes: 'Supersedes',
      related_to: 'Related',
      parallel: 'Parallel',
    };
    return labels[type] || type;
  }

  function isRelated(path: string): boolean {
    const norm = path.replace(/\.md$/, '');
    return justAdded.has(path) ||
      alreadyRelated.some(r => r === path || r === norm || r.replace(/\.md$/, '') === norm);
  }

  function isDismissed(path: string): boolean {
    return dismissed.has(path);
  }

  function handleAddRelated(path: string) {
    onaddrelated?.(path);
    const next = new Set(justAdded);
    next.add(path);
    justAdded = next;
  }

  function handleAddDepends(path: string) {
    onadddepends?.(path);
    const next = new Set(justAdded);
    next.add(path);
    justAdded = next;
  }

  function handleAddBlocks(path: string) {
    onaddblocks?.(path);
    const next = new Set(justAdded);
    next.add(path);
    justAdded = next;
  }

  function handleDismiss(path: string) {
    const next = new Set(dismissed);
    next.add(path);
    dismissed = next;
  }

  function handleSubsume(matchPath: string) {
    const next = new Set(subsumed);
    next.add(matchPath);
    subsumed = next;
    onsubsume?.(matchPath);
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
    <div class="loading">
      <span class="spinner">⟳</span> Scanning for related proposals…
      <div class="loading-sub">Matching by keywords, tags, and wikilinks</div>
    </div>
  {:else if matches.length === 0}
    {#if planMode}
      <div class="empty">No related proposals found.</div>
      <button class="create-plan-btn" onclick={() => oncreateplan?.()}
        title="Scaffold a plan from this proposal">
        + Create Plan from This Proposal
      </button>
    {:else}
      <div class="empty">No related proposals found.</div>
    {/if}
  {:else}
    {#if planMode}
      <button class="create-plan-btn" onclick={() => oncreateplan?.()}
        title="Scaffold a plan bundling this proposal with the related proposals below">
        + Create Plan — Bundle {matches.length + 1} Proposal{matches.length > 0 ? 's' : ''}
      </button>
    {/if}
    <div class="hint">
      {planMode ? 'Related proposals that will be bundled. ' : ''}Accept relationships to write them to frontmatter.
    </div>
    {#each matches as match}
      {@const rel = getRel(match.path)}
      <div class="match" class:subsumed={subsumed.has(match.path)} class:dismissed={isDismissed(match.path)}>
        <button class="match-header" onclick={() => toggleExpand(match.path)} title="Click to expand sections">
          <span class="match-title">{match.title || match.path}</span>
          {#if rel}
            <span class="rel-type {rel.type}">{relLabel(rel.type)}</span>
          {/if}
          <span class="score {scoreLabel(match.score)}">{Math.round(match.score * 100)}%</span>
          <span class="expand-icon">{expanded.has(match.path) ? '▾' : '▸'}</span>
        </button>

        <div class="match-actions">
          {#if isRelated(match.path)}
            <span class="accepted-badge" title="Added to frontmatter">✓ Accepted</span>
          {:else if isDismissed(match.path)}
            <span class="dismissed-badge">✕ Dismissed</span>
          {:else}
            {#if rel?.type === 'depends_on'}
              <button class="action-btn depends-btn" onclick={() => handleAddDepends(match.path)}
                title="Sets depends_on: in this proposal">
                + Accept as Depends on
              </button>
            {:else if rel?.type === 'blocks'}
              <button class="action-btn blocks-btn" onclick={() => handleAddBlocks(match.path)}
                title="Sets blocks: in this proposal">
                + Accept as Blocks
              </button>
            {:else if rel?.type === 'merge_candidate'}
              <button class="action-btn merge-btn" onclick={() => handleAddRelated(match.path)}
                title="Marks as related — merge decision at Plan time">
                + Accept as Related
              </button>
            {:else}
              <button class="action-btn related-btn" onclick={() => handleAddRelated(match.path)}
                title="Add to related_to: frontmatter">
                + Accept as Related
              </button>
            {/if}
            <button class="dismiss-btn" onclick={() => handleDismiss(match.path)}
              title="Dismiss this suggestion">✕</button>
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
                <label class="subsume-label">
                  <input type="checkbox" onchange={() => handleSubsume(match.path)} />
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

<style lang="scss">
  @use 'tokens' as *;

  .panel { display: flex; flex-direction: column; flex: 1; overflow: hidden; height: 100%; }
  .panel > div:not(.panel-header) { overflow-y: auto; }

  .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid $border; flex-shrink: 0; }
  .panel-title  { @include section-header; padding: 0; }
  .recheck-btn  { @include flat-btn; border: 1px solid $border; border-radius: 3px; padding: 1px 6px; font-size: 13px; &:hover:not(:disabled) { color: $blue; border-color: $blue-bdr; } &:disabled { opacity: 0.4; cursor: default; } }
  .close-btn    { @include flat-btn; border: 1px solid $border; border-radius: 3px; font-size: 10px; padding: 1px 6px; white-space: nowrap; &:hover { color: $fg-dim; border-color: $muted; } }

  .loading, .empty { padding: 24px 16px; color: $muted; font-size: 13px; text-align: center; }
  .loading-sub { font-size: 11px; color: $muted; margin-top: 6px; opacity: 0.7; }
  .spinner { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hint { padding: 8px 16px; font-size: 11px; color: $muted; border-bottom: 1px solid $border; }

  .create-plan-btn { display: block; width: calc(100% - 32px); margin: 8px 16px; padding: 8px 12px; border: 1px solid $magenta-bdr; border-radius: 6px; background: $magenta-bg; color: $magenta; font-size: 12px; font-weight: 600; cursor: pointer; text-align: center; &:hover { background: #2a1a3a; border-color: #7b4ba4; } }

  .match { border-bottom: 1px solid $border; overflow: hidden; &.subsumed { opacity: 0.5; } &.dismissed { opacity: 0.35; } }
  .match-header { display: flex; align-items: center; gap: 8px; padding: 10px 16px; cursor: pointer; user-select: none; width: 100%; background: none; border: none; text-align: left; color: inherit; font: inherit; &:hover { background: $bg-hover; } }
  .match-title  { flex: 1; font-size: 12px; color: $fg; }

  .rel-type { font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 6px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.3px; }
  .rel-type.depends_on      { color: #e87; border-color: #e87; background: #2a1a10; }
  .rel-type.blocks          { color: #e55; border-color: #e55; background: #2a1010; }
  .rel-type.merge_candidate { color: $teal; border-color: $teal-bdr; background: $teal-bg; }
  .rel-type.supersedes      { color: $amber; border-color: $amber-bdr; background: #2a2a10; }
  .rel-type.related_to      { color: #6af; border-color: #6af; background: #10202a; }
  .rel-type.parallel        { color: $muted; border-color: $border; background: $bg-2; }

  .score { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 8px; border: 1px solid; }
  .score.high   { color: #e87; border-color: #e87; background: #2a1a10; }
  .score.medium { color: $amber; border-color: $amber-bdr; background: #2a2a10; }
  .score.low    { color: #78a; border-color: #78a; background: #101a2a; }
  .expand-icon  { color: $muted; font-size: 11px; }

  .match-body { padding: 0 16px 12px; overflow-y: auto; max-height: 400px; }
  .section { margin-top: 10px; }
  .section-heading { display: flex; justify-content: space-between; align-items: center; @include section-header; padding: 0; margin-bottom: 4px; }
  .match-actions { padding: 4px 12px 6px; display: flex; gap: 4px; align-items: center; }

  .action-btn   { flex: 1; background: none; border: 1px solid $blue-bdr; color: $blue; font-size: 11px; padding: 3px 10px; border-radius: 4px; cursor: pointer; text-align: left; &:hover { background: $blue-bg; } }
  .depends-btn  { border-color: #c85; color: #e87; &:hover { background: #2a1a10; } }
  .blocks-btn   { border-color: #c55; color: #e55; &:hover { background: #2a1010; } }
  .merge-btn    { border-color: $teal-bdr; color: $teal; &:hover { background: $teal-bg; } }
  .dismiss-btn  { @include flat-btn; border: 1px solid $border; font-size: 11px; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; &:hover { color: $fg-dim; border-color: $muted; } }

  .accepted-badge  { font-size: 11px; color: $green; padding: 2px 0; display: block; }
  .dismissed-badge { font-size: 11px; color: $muted; padding: 2px 0; display: block; }

  .section-preview { font-size: 11px; color: $muted; line-height: 1.5; white-space: pre-wrap; background: $bg; border-radius: 3px; padding: 6px 8px; &.muted { font-style: italic; } }
  .subsume-row   { margin-top: 10px; }
  .subsume-label { font-size: 11px; color: $muted; cursor: pointer; display: flex; align-items: center; gap: 6px; input { cursor: pointer; } }
  .subsumed-note { font-size: 11px; color: $green; margin-top: 10px; }
</style>
