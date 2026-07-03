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
</script>

<div class="git-panel">
  <!-- Collapsed header — always visible -->
  <button class="git-header" onclick={() => { expanded = !expanded; if (expanded) loadStatus(); }}>
    <span class="git-branch">⎇ {status?.branch ?? '…'}</span>
    {#if status && (status.ahead > 0 || status.behind > 0)}
      <span class="ahead-behind">
        {#if status.ahead > 0}<span class="ahead">↑{status.ahead}</span>{/if}
        {#if status.behind > 0}<span class="behind">↓{status.behind}</span>{/if}
      </span>
    {/if}
    <span class="dot {dotClass}"></span>
    <span class="chevron">{expanded ? '▾' : '▸'}</span>
  </button>

  {#if expanded}
    <div class="git-body">
      <!-- File counts -->
      {#if status}
        <div class="counts">
          <button class="count-btn" onclick={() => showStaged = !showStaged}>
            Staged <span class="badge">{filteredStaged.length}</span>
          </button>
          <button class="count-btn" onclick={() => showModified = !showModified}>
            Modified <span class="badge">{filteredModified.length}</span>
          </button>
          <button class="count-btn" onclick={() => showUntracked = !showUntracked}>
            New <span class="badge">{filteredUntracked.length}</span>
          </button>
        </div>

        {#if showStaged && filteredStaged.length}
          <ul class="file-list">
            {#each filteredStaged as f}
              <li><button class="file-btn" onclick={() => goto('/' + f.replace(/\.md$/, ''))}>{f}</button></li>
            {/each}
          </ul>
        {/if}
        {#if showModified && filteredModified.length}
          <ul class="file-list">
            {#each filteredModified as f}
              <li><button class="file-btn" onclick={() => goto('/' + f.replace(/\.md$/, ''))}>{f}</button></li>
            {/each}
          </ul>
        {/if}
        {#if showUntracked && filteredUntracked.length}
          <ul class="file-list untracked">
            {#each filteredUntracked as f}
              <li>{f}</li>
            {/each}
          </ul>
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
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .git-panel { border-top: 1px solid $border; flex-shrink: 0; }

  .git-header {
    display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 12px;
    background: none; border: none; color: $muted; cursor: pointer; font-size: 11px; text-align: left;
    &:hover { background: $bg-hover; color: $fg-dim; }
  }
  .git-branch    { flex: 1; font-size: 11px; }
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

  .counts { display: flex; gap: 2px; padding: 0 8px 6px; }
  .count-btn {
    flex: 1; background: none; border: 1px solid $border; border-radius: 3px;
    color: $muted; font-size: 10px; padding: 2px 4px; cursor: pointer; text-align: center;
    &:hover { border-color: $muted; color: $fg-dim; }
  }
  .badge { display: inline-block; background: $bg-2; border-radius: 8px; padding: 0 4px; margin-left: 2px; }

  .file-list { list-style: none; margin: 0 0 4px; padding: 0 8px; max-height: 80px; overflow-y: auto; }
  .file-btn { @include flat-btn; font-size: 10px; padding: 1px 0; text-align: left; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; &:hover { color: $fg-dim; } }
  .file-list.untracked li { color: $muted; font-size: 10px; padding: 1px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .actions { display: flex; gap: 3px; padding: 0 8px 4px; }
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

  @media (max-width: 768px) {
    .git-header, .act-btn, .go-btn, .cancel-btn, .count-btn { min-height: 44px; font-size: 12px; }
  }
</style>
