<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fileChanged } from '$lib/fileChanges';
  import { gitSearchQuery } from '$lib/gitVc.js';

  interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    modified: string[];
    staged: string[];
    untracked: string[];
    latestTag: string;
    commits: { sha: string; message: string; }[];
    statuses?: Record<string, { x: string; y: string }>;
  }

  let expanded  = $state(false);
  let status    = $state<GitStatus | null>(null);
  let log       = $state('');
  let logTimer  = $state<ReturnType<typeof setTimeout> | null>(null);

  // Commit UI
  let committing   = $state(false);
  let commitMsg    = $state('');
  let commitError  = $state('');

  // Tag UI
  let tagging    = $state(false);
  let tagBump    = $state<'patch' | 'minor'>('patch');
  let tagName    = $state('');

  // CI watch state (active after a tag push)
  type CiState = 'idle' | 'waiting' | 'running' | 'success' | 'failure';
  let ciState   = $state<CiState>('idle');
  let ciMsg     = $state('');
  let ciUrl     = $state('');
  let ciSource: EventSource | null = null;

  // File list expansion
  let showModified  = $state(false);
  let showStaged    = $state(false);
  let showUntracked = $state(false);

  const MSG_RE = /^(feat|fix|docs|refactor|test|chore|policy|decision): .+/;

  async function loadStatus() {
    const res = await fetch('/api/git/status');
    if (res.ok) {
      status = await res.json();
      if (status && tagging) tagName = bumpTag(status.latestTag, tagBump);
    }
  }

  onMount(() => {
    loadStatus();
    return fileChanged.subscribe((c) => { if (c) loadStatus(); });
  });

  function bumpTag(latest: string, type: 'patch' | 'minor'): string {
    const m = latest.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!m) return 'v0.1.0';
    let [, maj, min, pat] = m.map(Number);
    if (type === 'patch') pat++;
    else { min++; pat = 0; }
    return `v${maj}.${min}.${pat}`;
  }

  function setLog(msg: string) {
    log = msg;
    if (logTimer) clearTimeout(logTimer);
    logTimer = setTimeout(() => { log = ''; }, 10000);
  }

  const total = $derived(
    status ? status.modified.length + status.staged.length + status.untracked.length : 0
  );
  const dotClass = $derived(
    !status ? 'dot-unknown'
    : total === 0 ? 'dot-clean'
    : status.staged.length > 0 ? 'dot-staged'
    : 'dot-dirty'
  );

  async function stageAll() {
    setLog('Staging all tracked changes…');
    const res = await fetch('/api/git/stage', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setLog('✓ Staged all tracked changes');
      await loadStatus();
    } else {
      setLog('✗ ' + (data.error || 'Stage failed'));
    }
  }

  async function stageFile(path: string) {
    setLog(`Staging ${path}…`);
    const res = await fetch('/api/git/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [path] }),
    });
    if (res.ok) {
      setLog(`✓ Staged ${path}`);
      await loadStatus();
    } else {
      const data = await res.json();
      setLog(`✗ ${data.error || 'Stage failed'}`);
    }
  }

  async function unstageFile(path: string) {
    setLog(`Unstaging ${path}…`);
    const res = await fetch('/api/git/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [path], staged: true }),
    });
    if (res.ok) {
      setLog(`✓ Unstaged ${path}`);
      await loadStatus();
    } else {
      const data = await res.json();
      setLog(`✗ ${data.error || 'Unstage failed'}`);
    }
  }

  async function discardChanges(path: string) {
    if (!confirm(`Are you sure you want to discard all changes in ${path}?`)) return;
    setLog(`Discarding changes in ${path}…`);
    const res = await fetch('/api/git/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [path], staged: false }),
    });
    if (res.ok) {
      setLog(`✓ Reverted ${path}`);
      await loadStatus();
    } else {
      const data = await res.json();
      setLog(`✗ ${data.error || 'Discard failed'}`);
    }
  }

  async function commit() {
    commitError = '';
    if (!MSG_RE.test(commitMsg)) {
      commitError = 'Must follow <type>: <description>';
      return;
    }
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commitMsg }),
    });
    const data = await res.json();
    if (res.ok) {
      setLog(`✓ ${data.sha} ${data.message}`);
      commitMsg = '';
      committing = false;
      await loadStatus();
    } else {
      setLog(data.error || 'Commit failed');
    }
  }

  async function push() {
    setLog('Pushing…');
    const res = await fetch('/api/git/push', { method: 'POST' });
    const data = await res.json();
    setLog(res.ok ? `✓ Pushed${data.output ? ': ' + data.output.split('\n')[0] : ''}` : `✗ ${data.error}`);
    if (res.ok) await loadStatus();
  }

  function startCiWatch(tag: string) {
    ciSource?.close();
    ciState = 'waiting';
    ciMsg   = 'Waiting for CI run to appear…';
    ciUrl   = '';

    ciSource = new EventSource(`/api/git/ci-watch?tag=${encodeURIComponent(tag)}`);

    ciSource.addEventListener('waiting',    (e) => { ciMsg = JSON.parse(e.data).message; });
    ciSource.addEventListener('found',      (e) => { ciState = 'running'; ciMsg = JSON.parse(e.data).message; ciUrl = JSON.parse(e.data).url; });
    ciSource.addEventListener('progress',   (e) => { ciMsg = JSON.parse(e.data).message; });
    ciSource.addEventListener('conclusion', (e) => {
      const d = JSON.parse(e.data);
      ciUrl   = d.url;
      ciState = d.conclusion === 'success' ? 'success' : 'failure';
      ciMsg   = d.conclusion === 'success' ? `✅ CI passed — release is green` : `🚨 CI FAILED — build is broken`;
      ciSource?.close();
    });
    ciSource.addEventListener('error', (e) => {
      ciState = 'failure';
      ciMsg   = JSON.parse(e.data).message;
      ciSource?.close();
    });
    ciSource.onerror = () => {
      if (ciState === 'waiting' || ciState === 'running') ciMsg = 'CI watch connection lost';
      ciSource?.close();
    };
  }

  async function createTag() {
    if (!tagName) return;
    setLog(`Tagging ${tagName}…`);
    const res = await fetch('/api/git/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tagName }),
    });
    const data = await res.json();
    if (res.ok) {
      const pushed = data.pushed as boolean;
      setLog(`✓ Tag ${data.tag}${pushed ? ' pushed' : ' created locally (push failed)'}`);
      tagging = false;
      if (pushed) startCiWatch(data.tag as string);
    } else {
      setLog(`✗ ${data.error}`);
    }
  }

  function openTagUI() {
    tagging = !tagging;
    committing = false;
    if (tagging && status) tagName = bumpTag(status.latestTag, tagBump);
  }

  let query = $derived($gitSearchQuery);
  const filteredStaged = $derived(
    status ? status.staged.filter(f => f.toLowerCase().includes(query.toLowerCase())) : []
  );
  const filteredModified = $derived(
    status ? status.modified.filter(f => f.toLowerCase().includes(query.toLowerCase())) : []
  );
  const filteredUntracked = $derived(
    status ? status.untracked.filter(f => f.toLowerCase().includes(query.toLowerCase())) : []
  );

  $effect(() => {
    if (tagging && status) tagName = bumpTag(status.latestTag, tagBump);
  });

  let selectedPaths = $state<string[]>([]);

  function toggleSelect(path: string) {
    if (selectedPaths.includes(path)) {
      selectedPaths = selectedPaths.filter(p => p !== path);
    } else {
      selectedPaths = [...selectedPaths, path];
    }
  }

  function isSelected(path: string) {
    return selectedPaths.includes(path);
  }

  function selectAllStaged(stagedFiles: string[], select: boolean) {
    if (select) {
      selectedPaths = Array.from(new Set([...selectedPaths, ...stagedFiles]));
    } else {
      selectedPaths = selectedPaths.filter(p => !stagedFiles.includes(p));
    }
  }

  function selectAllUnstaged(unstagedFiles: string[], select: boolean) {
    if (select) {
      selectedPaths = Array.from(new Set([...selectedPaths, ...unstagedFiles]));
    } else {
      selectedPaths = selectedPaths.filter(p => !unstagedFiles.includes(p));
    }
  }

  const unstagedFiles = $derived(status ? [...status.modified, ...status.untracked] : []);
  const hasSelectedStaged = $derived(selectedPaths.some(p => status?.staged.includes(p)));
  const hasSelectedUnstaged = $derived(selectedPaths.some(p => unstagedFiles.includes(p)));
  const hasSelectedModified = $derived(selectedPaths.some(p => status?.modified.includes(p)));

  let stagedCheckbox = $state<HTMLInputElement | null>(null);
  let unstagedCheckbox = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (stagedCheckbox && status) {
      const staged = status.staged;
      const count = staged.filter(p => selectedPaths.includes(p)).length;
      stagedCheckbox.indeterminate = count > 0 && count < staged.length;
    }
  });

  $effect(() => {
    if (unstagedCheckbox && status) {
      const count = unstagedFiles.filter(p => selectedPaths.includes(p)).length;
      unstagedCheckbox.indeterminate = count > 0 && count < unstagedFiles.length;
    }
  });

  async function stageSelected() {
    const toStage = selectedPaths.filter(p => status?.modified.includes(p) || status?.untracked.includes(p));
    if (toStage.length === 0) return;
    setLog(`Staging ${toStage.length} files…`);
    const res = await fetch('/api/git/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: toStage }),
    });
    if (res.ok) {
      setLog(`✓ Staged ${toStage.length} files`);
      selectedPaths = selectedPaths.filter(p => !toStage.includes(p));
      await loadStatus();
    } else {
      const data = await res.json();
      setLog(`✗ ${data.error || 'Stage failed'}`);
    }
  }

  async function unstageSelected() {
    const toUnstage = selectedPaths.filter(p => status?.staged.includes(p));
    if (toUnstage.length === 0) return;
    setLog(`Unstaging ${toUnstage.length} files…`);
    const res = await fetch('/api/git/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: toUnstage, staged: true }),
    });
    if (res.ok) {
      setLog(`✓ Unstaged ${toUnstage.length} files`);
      selectedPaths = selectedPaths.filter(p => !toUnstage.includes(p));
      await loadStatus();
    } else {
      const data = await res.json();
      setLog(`✗ ${data.error || 'Unstage failed'}`);
    }
  }

  async function discardSelected() {
    const toDiscard = selectedPaths.filter(p => status?.modified.includes(p));
    if (toDiscard.length === 0) return;
    if (!confirm(`Are you sure you want to discard all changes in ${toDiscard.length} selected files?`)) return;
    setLog(`Discarding changes in ${toDiscard.length} files…`);
    const res = await fetch('/api/git/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: toDiscard, staged: false }),
    });
    if (res.ok) {
      setLog(`✓ Discarded changes in ${toDiscard.length} files`);
      selectedPaths = selectedPaths.filter(p => !toDiscard.includes(p));
      await loadStatus();
    } else {
      const data = await res.json();
      setLog(`✗ ${data.error || 'Discard failed'}`);
    }
  }
</script>

<div class="git-panel">
  <!-- Static header — always visible -->
  <div class="git-header">
    <span class="git-branch">⎇ {status?.branch ?? '…'}</span>
    {#if status && (status.ahead > 0 || status.behind > 0)}
      <span class="ahead-behind">
        {#if status.ahead > 0}<span class="ahead">↑{status.ahead}</span>{/if}
        {#if status.behind > 0}<span class="behind">↓{status.behind}</span>{/if}
      </span>
    {/if}
    <span class="dot {dotClass}"></span>
  </div>

  <div class="git-body">
      <!-- Sync Status & Tag badge -->
      {#if status}
        <div class="sync-info">
          {#if status.latestTag}
            <span class="tag-badge" title="Latest Release Tag">🏷 {status.latestTag}</span>
          {/if}
          <span class="status-summary">
            {#if status.ahead === 0 && status.behind === 0}
              ✓ Up to date
            {:else}
              {#if status.ahead > 0}↑ {status.ahead} ahead{/if}
              {#if status.behind > 0}↓ {status.behind} behind{/if}
            {/if}
          </span>
        </div>

        <!-- Bulk operations bar -->
        {#if selectedPaths.length > 0}
          <div class="bulk-ops-bar">
            <span class="sel-count">{selectedPaths.length} selected</span>
            <div class="bulk-ops-actions">
              {#if hasSelectedUnstaged}
                <button class="bulk-btn stage" onclick={stageSelected} title="Stage selected">Stage</button>
              {/if}
              {#if hasSelectedStaged}
                <button class="bulk-btn unstage" onclick={unstageSelected} title="Unstage selected">Unstage</button>
              {/if}
              {#if hasSelectedModified}
                <button class="bulk-btn discard" onclick={discardSelected} title="Discard selected">Discard</button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Staged Changes Section -->
        <div class="section-header">
          <label class="select-all-label">
            <input
              type="checkbox"
              bind:this={stagedCheckbox}
              checked={status.staged.length > 0 && status.staged.every(p => selectedPaths.includes(p))}
              onchange={(e) => selectAllStaged(status?.staged ?? [], e.currentTarget.checked)}
            />
            <span class="section-title">Staged Changes ({status.staged.length})</span>
          </label>
        </div>

        {#if status.staged.length > 0}
          <ul class="file-list select-mode">
            {#each status.staged as f}
              <li class="file-row" class:selected={isSelected(f)}>
                <label class="file-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isSelected(f)}
                    onchange={() => toggleSelect(f)}
                  />
                  <span class="file-status staged" title="Staged">
                    {status.statuses?.[f]?.x || 'A'}
                  </span>
                  <span class="file-name" title={f}>{f}</span>
                </label>
                <div class="row-actions">
                  <button class="row-btn unstage" onclick={() => unstageFile(f)} title="Unstage file">-</button>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="empty-state">No staged changes</div>
        {/if}
 
        <!-- Unstaged Changes Section -->
        <div class="section-header">
          <label class="select-all-label">
            <input
              type="checkbox"
              bind:this={unstagedCheckbox}
              checked={unstagedFiles.length > 0 && unstagedFiles.every(p => selectedPaths.includes(p))}
              onchange={(e) => selectAllUnstaged(unstagedFiles, e.currentTarget.checked)}
            />
            <span class="section-title">Unstaged Changes ({unstagedFiles.length})</span>
          </label>
        </div>
 
        {#if unstagedFiles.length > 0}
          <ul class="file-list select-mode">
            {#each status.modified as f}
              <li class="file-row" class:selected={isSelected(f)}>
                <label class="file-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isSelected(f)}
                    onchange={() => toggleSelect(f)}
                  />
                  <span class="file-status modified" title="Modified">
                    {status.statuses?.[f]?.y || 'M'}
                  </span>
                  <span class="file-name" title={f}>{f}</span>
                </label>
                <div class="row-actions">
                  <button class="row-btn stage" onclick={() => stageFile(f)} title="Stage file">+</button>
                  <button class="row-btn discard" onclick={() => discardChanges(f)} title="Discard changes">↶</button>
                </div>
              </li>
            {/each}
            {#each status.untracked as f}
              <li class="file-row" class:selected={isSelected(f)}>
                <label class="file-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isSelected(f)}
                    onchange={() => toggleSelect(f)}
                  />
                  <span class="file-status untracked" title="Untracked">U</span>
                  <span class="file-name" title={f}>{f}</span>
                </label>
                <div class="row-actions">
                  <button class="row-btn stage" onclick={() => stageFile(f)} title="Stage file">+</button>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="empty-state">No unstaged changes</div>
        {/if}
      {/if}

      <!-- Action row -->
      <div class="actions">
        <button class="act-btn" onclick={stageAll}>Stage all</button>
        <button class="act-btn" onclick={() => { committing = !committing; tagging = false; commitError = ''; }}>Commit</button>
        <button class="act-btn push" onclick={push} disabled={!status || status.ahead === 0}>Push{status && status.ahead > 0 ? ` (${status.ahead})` : ''}</button>
        <button class="act-btn tag" onclick={openTagUI}>Tag</button>
        <button class="act-btn refresh" onclick={loadStatus} title="Refresh">↻</button>
      </div>

      <!-- Commit input -->
      {#if committing}
        <div class="commit-form">
          <input
            class="commit-input {commitError ? 'error' : ''}"
            placeholder="feat: description"
            bind:value={commitMsg}
            onkeydown={(e) => e.key === 'Enter' && commit()}
          />
          {#if commitError}<div class="commit-error">{commitError}</div>{/if}
          <div class="commit-actions">
            <button class="go-btn" onclick={commit} disabled={!commitMsg}>Commit</button>
            <button class="cancel-btn" onclick={() => { committing = false; commitError = ''; }}>Cancel</button>
          </div>
        </div>
      {/if}

      <!-- Tag input -->
      {#if tagging}
        <div class="tag-form">
          <div class="bump-row">
            {#each (['patch', 'minor'] as const) as b}
              <button
                class="bump-btn {tagBump === b ? 'active' : ''}"
                onclick={() => { tagBump = b; }}
              >{b}</button>
            {/each}
          </div>
          <input class="commit-input" bind:value={tagName} placeholder="v0.2.1" />
          <div class="commit-actions">
            <button class="go-btn" onclick={createTag} disabled={!tagName}>Create & Push</button>
            <button class="cancel-btn" onclick={() => tagging = false}>Cancel</button>
          </div>
        </div>
      {/if}

      <!-- Log output -->
      {#if log}
        <div class="git-log">{log}</div>
      {/if}

      <!-- CI watch panel (shown after a tag push until the run completes) -->
      {#if ciState !== 'idle'}
        <div class="ci-panel ci-{ciState}">
          <span class="ci-msg">{ciMsg}</span>
          {#if ciUrl}
            <a class="ci-link" href={ciUrl} target="_blank" rel="noreferrer">view run ↗</a>
          {/if}
          {#if ciState === 'failure'}
            <div class="ci-options">
              <span>Options:</span>
              <button class="ci-opt-btn" onclick={() => ciState = 'idle'}>dismiss</button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
</div>

<style lang="scss">
  @use 'tokens' as *;

  .git-panel { border-top: 1px solid $border; flex-shrink: 0; }

  .git-header {
    display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 12px;
    color: $fg-dim; font-size: 11px; font-weight: 600;
  }
  .git-branch    { flex: 1; font-size: 11px; color: $fg-dim; }
  .ahead-behind  { display: flex; gap: 3px; font-size: 10px; }
  .ahead  { color: $blue; }
  .behind { color: #e87; }
  .chevron { color: $border; font-size: 10px; }

  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot-clean   { background: #2d7d46; }
  .dot-staged  { background: $blue; }
  .dot-dirty   { background: #cc8800; }
  .dot-unknown { background: $border; }

  .git-body { padding: 6px 0 8px; }

  .file-list {
    list-style: none; margin: 0 0 8px; padding: 0 8px; max-height: 220px; overflow-y: auto;
    &.select-mode {
      border: 1px solid $border;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.15);
      padding: 4px;
    }
  }

  .file-checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    flex: 1;
    min-width: 0;
    padding: 2px 4px;
    border-radius: 3px;
    input[type="checkbox"] {
      margin: 0;
      cursor: pointer;
    }
    &:hover {
      background: rgba(255, 255, 255, 0.03);
    }
  }

  .file-status {
    font-family: monospace;
    font-size: 9px;
    font-weight: bold;
    width: 13px;
    height: 13px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    &.staged { color: #2d7d46; background: rgba(45, 125, 70, 0.15); }
    &.modified { color: #cc8800; background: rgba(204, 136, 0, 0.15); }
    &.untracked { color: $muted; background: $bg-2; }
  }

  .section-header {
    padding: 8px 8px 4px;
    margin-top: 4px;
  }
  .select-all-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    color: $muted;
    input[type="checkbox"] {
      margin: 0;
      cursor: pointer;
    }
    &:hover {
      color: $fg-dim;
    }
  }
  .section-title {
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 9px;
  }

  .empty-state {
    padding: 6px 12px;
    font-size: 9px;
    color: $muted;
    font-style: italic;
    border: 1px dashed $border;
    border-radius: 4px;
    margin: 0 8px 8px;
    text-align: center;
  }

  .bulk-ops-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: $bg-2;
    border: 1px solid $border;
    border-radius: 4px;
    padding: 4px 8px;
    margin: 4px 8px;
  }
  .sel-count {
    font-size: 9px;
    font-weight: 600;
    color: $fg-dim;
  }
  .bulk-ops-actions {
    display: flex;
    gap: 4px;
  }
  .bulk-btn {
    background: none;
    border: 1px solid $border;
    border-radius: 3px;
    font-size: 9px;
    padding: 2px 6px;
    cursor: pointer;
    &.stage {
      color: $blue;
      border-color: $blue-bdr;
      &:hover { background: $blue-bg; }
    }
    &.unstage {
      color: $teal;
      border-color: $teal-bdr;
      &:hover { background: $teal-bg; }
    }
    &.discard {
      color: $red;
      border-color: $red-bdr;
      &:hover { background: rgba(200, 50, 50, 0.1); }
    }
  }

  .actions { display: flex; gap: 3px; padding: 4px 8px; }
  .act-btn {
    flex: 1; background: $bg-2; border: 1px solid $border; border-radius: 3px;
    color: $muted; font-size: 10px; padding: 3px 4px; cursor: pointer;
    &:hover { border-color: $muted; color: $fg-dim; }
    &.push { color: $blue; border-color: $blue-bdr; &:disabled { color: $border; border-color: $bg-2; cursor: default; } }
    &.tag  { color: $teal; border-color: $teal-bdr; }
    &.refresh { flex: 0; padding: 3px 6px; }
  }

  .commit-form, .tag-form { padding: 0 8px 4px; display: flex; flex-direction: column; gap: 4px; }
  .commit-input { @include inline-input; font-size: 11px; padding: 4px 6px; &.error { border-color: $red-bdr; } }
  .commit-error { font-size: 10px; color: $red; }
  .commit-actions { display: flex; gap: 4px; }
  .go-btn {
    flex: 1; background: $blue-bg; border: 1px solid $blue-bdr; border-radius: 3px;
    color: $blue; font-size: 10px; padding: 3px; cursor: pointer;
    &:disabled { opacity: 0.4; cursor: default; }
  }
  .cancel-btn { background: none; border: 1px solid $border; border-radius: 3px; color: $muted; font-size: 10px; padding: 3px 6px; cursor: pointer; }

  .bump-row { display: flex; gap: 3px; }
  .bump-btn {
    flex: 1; background: $bg-2; border: 1px solid $border; border-radius: 3px;
    color: $muted; font-size: 10px; padding: 3px; cursor: pointer; text-transform: capitalize;
    &.active { @include act-variant($teal, $teal-bg, $teal-bdr); }
  }

  .git-log { margin: 4px 8px 0; padding: 6px 8px; background: $bg; border-radius: 3px; font-size: 10px; color: $teal; font-family: monospace; word-break: break-all; }

  .ci-panel {
    margin: 6px 8px 0; padding: 6px 8px; border-radius: 3px; font-size: 10px;
    display: flex; flex-direction: column; gap: 3px;
    &.ci-waiting, &.ci-running { background: $bg; border: 1px solid $border; color: $muted; }
    &.ci-success { background: rgba(45,125,70,.15); border: 1px solid #2d7d46; color: #4caf70; }
    &.ci-failure { background: rgba(200,50,50,.12); border: 1px solid $red-bdr; color: $red; }
  }
  .ci-msg  { font-family: monospace; word-break: break-all; }
  .ci-link { color: $blue; font-size: 10px; text-decoration: none; &:hover { text-decoration: underline; } }
  .ci-options { display: flex; align-items: center; gap: 6px; margin-top: 2px; color: $muted; }
  .ci-opt-btn { background: none; border: 1px solid $border; border-radius: 3px; color: $muted; font-size: 10px; padding: 2px 6px; cursor: pointer; &:hover { border-color: $muted; } }

  // Sync status
  .sync-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 10px 6px;
    font-size: 10px;
    color: $muted;
  }
  .tag-badge {
    background: $bg-2;
    border: 1px solid $border;
    border-radius: 4px;
    padding: 1px 4px;
    font-size: 9px;
    color: $teal;
  }
  .status-summary {
    font-style: italic;
  }

  // Interactive File list styling
  .file-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 2px 0;
    &:hover {
      .row-actions {
        opacity: 1;
      }
    }
  }
  .file-name {
    font-size: 10px;
    color: $fg-dim;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  .row-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .row-btn {
    background: $bg-2;
    border: 1px solid $border;
    color: $muted;
    border-radius: 3px;
    font-size: 9px;
    line-height: 1;
    width: 15px;
    height: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    &:hover {
      color: $fg-dim;
      border-color: $muted;
    }
    &.stage {
      color: $blue;
      border-color: $blue-bdr;
      &:hover { background: $blue-bg; }
    }
    &.unstage {
      color: $teal;
      border-color: $teal-bdr;
      &:hover { background: $teal-bg; }
    }
    &.discard {
      color: $red;
      border-color: $red-bdr;
      &:hover { background: rgba(200,50,50,0.1); }
    }
  }

  @media (max-width: 768px) {
    .git-header, .act-btn, .go-btn, .cancel-btn, .count-btn { min-height: 44px; font-size: 12px; }
  }
</style>
