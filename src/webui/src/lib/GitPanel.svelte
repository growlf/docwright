<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fileChanged } from '$lib/fileChanges';

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
  let tagBump    = $state<'patch' | 'minor' | 'release'>('patch');
  let tagName    = $state('');

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

  function bumpTag(latest: string, type: 'patch' | 'minor' | 'release'): string {
    const m = latest.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!m) return 'v0.1.0';
    let [, maj, min, pat] = m.map(Number);
    if (type === 'patch')   pat++;
    else if (type === 'minor') { min++; pat = 0; }
    else { maj++; min = 0; pat = 0; }
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
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '__stage_only__' }), // we just need git add
    });
    // Actually, use bash via a new endpoint — for now do git add via status reload
    // Stage all is handled by committing with a pre-stage step; for prototype just
    // call the existing write/rename which triggers SSE. A dedicated stage endpoint
    // is a follow-up task.
    setLog('Stage all: use git add -u in terminal for now — dedicated endpoint coming');
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
      setLog(`✓ Tag ${data.tag}${data.pushed ? ' pushed' : ' created locally (push failed)'}`);
      tagging = false;
    } else {
      setLog(`✗ ${data.error}`);
    }
  }

  function openTagUI() {
    tagging = !tagging;
    committing = false;
    if (tagging && status) tagName = bumpTag(status.latestTag, tagBump);
  }

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
            Staged <span class="badge">{status.staged.length}</span>
          </button>
          <button class="count-btn" onclick={() => showModified = !showModified}>
            Modified <span class="badge">{status.modified.length}</span>
          </button>
          <button class="count-btn" onclick={() => showUntracked = !showUntracked}>
            New <span class="badge">{status.untracked.length}</span>
          </button>
        </div>

        {#if showStaged && status.staged.length}
          <ul class="file-list">
            {#each status.staged as f}
              <li><button class="file-btn" onclick={() => goto('/' + f.replace(/\.md$/, ''))}>{f}</button></li>
            {/each}
          </ul>
        {/if}
        {#if showModified && status.modified.length}
          <ul class="file-list">
            {#each status.modified as f}
              <li><button class="file-btn" onclick={() => goto('/' + f.replace(/\.md$/, ''))}>{f}</button></li>
            {/each}
          </ul>
        {/if}
        {#if showUntracked && status.untracked.length}
          <ul class="file-list untracked">
            {#each status.untracked as f}
              <li>{f}</li>
            {/each}
          </ul>
        {/if}
      {/if}

      <!-- Action row -->
      <div class="actions">
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
            {#each ['patch', 'minor', 'release'] as b}
              <button
                class="bump-btn {tagBump === b ? 'active' : ''}"
                onclick={() => { tagBump = b as any; }}
              >{b}</button>
            {/each}
          </div>
          <input class="commit-input" bind:value={tagName} placeholder="v1.0.0" />
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
    </div>
  {/if}
</div>

<style>
  .git-panel { border-top: 1px solid #1a1a1a; flex-shrink: 0; }

  .git-header {
    display: flex; align-items: center; gap: 6px;
    width: 100%; padding: 8px 12px;
    background: none; border: none; color: #666; cursor: pointer;
    font-size: 11px; text-align: left;
  }
  .git-header:hover { background: #141414; color: #aaa; }
  .git-branch { flex: 1; font-size: 11px; }
  .ahead-behind { display: flex; gap: 3px; font-size: 10px; }
  .ahead  { color: #58a6ff; }
  .behind { color: #e87; }
  .chevron { color: #333; font-size: 10px; }

  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot-clean   { background: #2d7d46; }
  .dot-staged  { background: #58a6ff; }
  .dot-dirty   { background: #cc8800; }
  .dot-unknown { background: #444; }

  .git-body { padding: 6px 0 8px; }

  .counts { display: flex; gap: 2px; padding: 0 8px 6px; }
  .count-btn {
    flex: 1; background: none; border: 1px solid #222; border-radius: 3px;
    color: #555; font-size: 10px; padding: 2px 4px; cursor: pointer; text-align: center;
  }
  .count-btn:hover { border-color: #333; color: #888; }
  .badge { display: inline-block; background: #1a1a1a; border-radius: 8px; padding: 0 4px; margin-left: 2px; }

  .file-list { list-style: none; margin: 0 0 4px; padding: 0 8px; max-height: 80px; overflow-y: auto; }
  .file-btn { background: none; border: none; color: #666; font-size: 10px; cursor: pointer; padding: 1px 0; text-align: left; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-btn:hover { color: #aaa; }
  .file-list.untracked li { color: #555; font-size: 10px; padding: 1px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .actions { display: flex; gap: 3px; padding: 0 8px 4px; }
  .act-btn {
    flex: 1; background: #141414; border: 1px solid #252525; border-radius: 3px;
    color: #666; font-size: 10px; padding: 3px 4px; cursor: pointer;
  }
  .act-btn:hover { border-color: #333; color: #aaa; }
  .act-btn.push { color: #58a6ff; border-color: #1e3a5a; }
  .act-btn.push:disabled { color: #2a2a2a; border-color: #1a1a1a; cursor: default; }
  .act-btn.tag { color: #8b8; border-color: #1e3a1e; }
  .act-btn.refresh { flex: 0; padding: 3px 6px; }

  .commit-form, .tag-form { padding: 0 8px 4px; display: flex; flex-direction: column; gap: 4px; }
  .commit-input {
    width: 100%; background: #0a0a0a; border: 1px solid #2b5b84;
    border-radius: 3px; color: #e0e0e0; padding: 4px 6px;
    font-size: 11px; font-family: monospace; outline: none; box-sizing: border-box;
  }
  .commit-input.error { border-color: #842b2b; }
  .commit-error { font-size: 10px; color: #e44; }
  .commit-actions { display: flex; gap: 4px; }
  .go-btn {
    flex: 1; background: #1a3a5a; border: 1px solid #2b5b84; border-radius: 3px;
    color: #58a6ff; font-size: 10px; padding: 3px; cursor: pointer;
  }
  .go-btn:disabled { opacity: 0.4; cursor: default; }
  .cancel-btn { background: none; border: 1px solid #222; border-radius: 3px; color: #444; font-size: 10px; padding: 3px 6px; cursor: pointer; }

  .bump-row { display: flex; gap: 3px; }
  .bump-btn { flex: 1; background: #141414; border: 1px solid #222; border-radius: 3px; color: #555; font-size: 10px; padding: 3px; cursor: pointer; text-transform: capitalize; }
  .bump-btn.active { border-color: #2b5b2b; color: #8b8; background: #0a1a0a; }

  .git-log { margin: 4px 8px 0; padding: 6px 8px; background: #0a0a0a; border-radius: 3px; font-size: 10px; color: #8b8; font-family: monospace; word-break: break-all; }
</style>
