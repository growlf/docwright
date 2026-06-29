<script lang="ts">
  interface HunkLine { type: 'add' | 'del' | 'ctx' | 'hunk'; text: string; oldLine?: number; newLine?: number; }
  interface FileDiff { path: string; binary: boolean; hunks: HunkLine[][]; }

  interface FieldChange { field: string; before: string; after: string; }
  type GovFlag = 'approval' | 'gate-status' | 'ai-stamp' | 'lifecycle' | 'priority';
  interface DiffAnnotation {
    changedFields: FieldChange[];
    statusTransition?: { from: string; to: string };
    gateFlags: GovFlag[];
  }

  let {
    diff = '',
    sessionId = '',
    onclose,
  }: {
    diff?: string;
    sessionId?: string;
    onclose?: () => void;
  } = $props();

  let parsed = $derived<FileDiff[]>(parseDiff(diff));
  let mode = $state<'side-by-side' | 'unified'>('side-by-side');
  let govAnnotations = $state(new Map<string, DiffAnnotation>());

  // Selective staging state
  let rejectedPaths = $state(new Set<string>());
  let commitMsg = $state('docs: apply reviewed AI session changes');
  let commitState = $state<'idle' | 'working' | 'done' | 'error'>('idle');
  let commitError = $state('');

  let acceptedPaths = $derived(parsed.map(f => f.path).filter(p => !rejectedPaths.has(p)));

  function toggleAccept(path: string) {
    const next = new Set(rejectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    rejectedPaths = next;
  }

  // Reset per-file state when diff changes
  $effect(() => {
    void parsed;
    rejectedPaths = new Set();
    commitState = 'idle';
    commitError = '';
  });

  async function commitAccepted() {
    if (acceptedPaths.length === 0 || commitState === 'working') return;
    commitState = 'working';
    commitError = '';
    try {
      if (rejectedPaths.size > 0) {
        const r = await fetch('/api/git/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [...rejectedPaths] }),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? 'Restore failed');
      }
      const r2 = await fetch('/api/git/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: acceptedPaths }),
      });
      if (!r2.ok) throw new Error((await r2.json()).error ?? 'Stage failed');
      const r3 = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMsg }),
      });
      if (!r3.ok) throw new Error((await r3.json()).error ?? 'Commit failed');
      commitState = 'done';
    } catch (e) {
      commitState = 'error';
      commitError = (e as Error).message;
    }
  }

  $effect(() => {
    const paths = parsed.map(f => f.path);
    if (paths.length === 0) { govAnnotations = new Map(); return; }
    fetch('/api/diff-annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const m = new Map<string, DiffAnnotation>();
        for (const [k, v] of Object.entries(data)) m.set(k, v as DiffAnnotation);
        govAnnotations = m;
      })
      .catch(() => {});
  });

  function parseDiff(text: string): FileDiff[] {
    if (!text) return [];
    const files: FileDiff[] = [];
    const fileBlocks = text.split(/(?=^diff --git )/m);
    for (const block of fileBlocks) {
      if (!block.trim()) continue;
      const pathMatch = block.match(/^diff --git a\/(.*?) b\/(.*?)$/m);
      if (!pathMatch) continue;
      const path = pathMatch[2];
      const binary = block.includes('Binary files');
      const hunks: HunkLine[][] = [];
      const hunkBlocks = block.split(/(?=^@@ )/m);
      for (const hunkBlock of hunkBlocks) {
        if (!hunkBlock.trim() || hunkBlock.startsWith('diff ')) continue;
        const headerMatch = hunkBlock.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/m);
        if (!headerMatch) continue;
        const lines: HunkLine[] = [];
        const bodyLines = hunkBlock.split('\n');
        let oldLine = parseInt(headerMatch[1]);
        let newLine = parseInt(headerMatch[2]);
        for (const l of bodyLines) {
          if (l.startsWith('@@')) {
            lines.push({ type: 'hunk', text: l, oldLine, newLine });
            continue;
          }
          if (l.startsWith('+')) {
            lines.push({ type: 'add', text: l, newLine });
            newLine++;
          } else if (l.startsWith('-')) {
            lines.push({ type: 'del', text: l, oldLine });
            oldLine++;
          } else {
            lines.push({ type: 'ctx', text: l, oldLine, newLine });
            if (!l.startsWith('\\')) { oldLine++; newLine++; }
          }
        }
        if (lines.length > 0) hunks.push(lines);
      }
      files.push({ path, binary, hunks });
    }
    return files;
  }
</script>

<div class="session-diff-panel">
  <div class="diff-bar">
    <span class="diff-title">Changes in session</span>
    {#if parsed.length > 0}
      <span class="diff-count">{parsed.length} file{parsed.length !== 1 ? 's' : ''}</span>
    {/if}
    <button class="mode-btn" onclick={() => mode = mode === 'side-by-side' ? 'unified' : 'side-by-side'}>
      {mode === 'side-by-side' ? '⊞ Unified' : '⊟ Side-by-side'}
    </button>
    <button class="close-btn" onclick={onclose} title="Close diff view">✕</button>
  </div>

  <div class="diff-content">
    {#if !diff}
      <div class="diff-empty">No diff available — session may not have produced changes yet.</div>
    {:else if parsed.length === 0}
      <div class="diff-empty">Could not parse diff output.</div>
    {:else}
      {#each parsed as file}
        {@const ann = govAnnotations.get(file.path)}
        {@const rejected = rejectedPaths.has(file.path)}
        <div class="diff-file" class:rejected>
          <div class="file-header">
            <div class="file-header-row">
              <input
                type="checkbox"
                class="accept-cb"
                checked={!rejected}
                onchange={() => toggleAccept(file.path)}
                title={rejected ? 'Rejected — click to accept' : 'Accepted — click to reject'}
              />
              <span class="file-path" class:file-rejected={rejected}>{file.path}</span>
              {#if file.binary}<span class="binary-badge">binary</span>{/if}
            </div>
            {#if ann && ann.gateFlags.length > 0}
              <div class="gov-bar">
                {#if ann.statusTransition}
                  <span class="gov-badge gov-lifecycle" title="Lifecycle transition">{ann.statusTransition.from} → {ann.statusTransition.to}</span>
                {/if}
                {#if ann.gateFlags.includes('approval')}
                  <span class="gov-badge gov-approval" title="Approval gate triggered">approved</span>
                {/if}
                {#if ann.gateFlags.includes('gate-status')}
                  <span class="gov-badge gov-gate" title="Gate status changed">gate</span>
                {/if}
                {#if ann.gateFlags.includes('priority')}
                  <span class="gov-badge gov-priority" title="Priority changed">priority</span>
                {/if}
                {#if ann.gateFlags.includes('ai-stamp')}
                  <span class="gov-badge gov-ai" title="AI action recorded">AI</span>
                {/if}
              </div>
            {/if}
          </div>
          {#if file.binary}
            <div class="binary-msg">Binary files differ</div>
          {:else if mode === 'side-by-side'}
            <div class="sb-container">
              {#each file.hunks as hunk}
                <div class="sb-hunk-header">{hunk[0].text}</div>
                <div class="sb-grid">
                  <div class="sb-col sb-old">
                    {#each hunk as line}
                      {#if line.type === 'del' || line.type === 'ctx'}
                        <div class="sb-line sb-{line.type}" data-line={line.oldLine}>
                          <span class="sb-ln">{line.oldLine}</span>
                          <span class="sb-t">{line.text.substring(1)}</span>
                        </div>
                      {:else if line.type === 'hunk'}
                        <div class="sb-line sb-hunk"><span class="sb-ln"></span><span class="sb-t">{line.text}</span></div>
                      {:else}
                        <div class="sb-line sb-gap"></div>
                      {/if}
                    {/each}
                  </div>
                  <div class="sb-col sb-new">
                    {#each hunk as line}
                      {#if line.type === 'add' || line.type === 'ctx'}
                        <div class="sb-line sb-{line.type}" data-line={line.newLine}>
                          <span class="sb-ln">{line.newLine}</span>
                          <span class="sb-t">{line.text.substring(1)}</span>
                        </div>
                      {:else if line.type === 'hunk'}
                        <div class="sb-line sb-hunk"><span class="sb-ln"></span><span class="sb-t">{line.text}</span></div>
                      {:else}
                        <div class="sb-line sb-gap"></div>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <pre class="unified-pre">{#each file.hunks as hunk}{#each hunk as line}<span class="ul-{line.type}">{line.text}
</span>{/each}{/each}</pre>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  {#if parsed.length > 0}
    <div class="staging-bar">
      {#if commitState === 'done'}
        <span class="staging-ok">Committed — {acceptedPaths.length} file{acceptedPaths.length !== 1 ? 's' : ''}</span>
      {:else}
        <span class="staging-count">
          {acceptedPaths.length} of {parsed.length} accepted
          {#if rejectedPaths.size > 0}<span class="staging-rejected">({rejectedPaths.size} rejected)</span>{/if}
        </span>
        <input
          class="staging-msg"
          type="text"
          bind:value={commitMsg}
          placeholder="docs: describe the change"
          disabled={commitState === 'working'}
        />
        <button
          class="staging-commit"
          onclick={commitAccepted}
          disabled={acceptedPaths.length === 0 || commitState === 'working'}
        >
          {commitState === 'working' ? 'Committing…' : `Commit ${acceptedPaths.length}`}
        </button>
      {/if}
      {#if commitState === 'error'}
        <span class="staging-err" title={commitError}>⚠ {commitError}</span>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .session-diff-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .diff-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid $border;
    flex-shrink: 0;
    background: $bg;
  }

  .diff-title {
    font-size: 11px;
    font-weight: 600;
    color: $fg-dim;
  }

  .diff-count {
    font-size: 10px;
    color: $muted;
    background: $bg-2;
    border-radius: 8px;
    padding: 0 6px;
    line-height: 16px;
  }

  .mode-btn, .close-btn {
    @include flat-btn;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    &:hover { background: $bg-hover; }
  }

  .mode-btn { margin-left: auto; }
  .close-btn { color: $muted; &:hover { color: $red; } }

  .diff-content {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .diff-empty {
    padding: 24px;
    font-size: 12px;
    color: $muted;
    text-align: center;
  }

  .diff-file { border-bottom: 1px solid $border; }

  .file-header {
    font-family: monospace;
    font-size: 11px;
    font-weight: 600;
    color: $muted;
    padding: 4px 12px 0;
    background: $bg-header;
    border-bottom: 1px solid $border;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .file-header-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0 4px;
  }

  .file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .gov-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 0 5px;
    flex-wrap: wrap;
  }

  .gov-badge {
    font-family: system-ui, sans-serif;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .gov-lifecycle { background: $blue-bg;  color: $blue;  }
  .gov-approval  { background: #2a1a00;   color: $amber; border: 1px solid #553300; }
  .gov-gate      { background: #1a0a2a;   color: #b080f0; border: 1px solid #4a2880; }
  .gov-priority  { background: $bg-3;     color: $muted; }
  .gov-ai        { background: $bg-3;     color: $muted; font-style: italic; }

  // Per-file accept/reject
  .accept-cb {
    flex-shrink: 0;
    width: 13px;
    height: 13px;
    cursor: pointer;
    accent-color: $green;
  }

  .file-rejected { color: $red; text-decoration: line-through; opacity: 0.6; }

  .diff-file.rejected {
    opacity: 0.5;
    .sb-container, .unified-pre { filter: grayscale(0.6); }
  }

  // Staging footer
  .staging-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-top: 1px solid $border;
    background: $bg;
    flex-shrink: 0;
    min-height: 36px;
  }

  .staging-count {
    font-size: 11px;
    color: $fg-dim;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .staging-rejected { color: $red; margin-left: 4px; }

  .staging-msg {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    padding: 3px 7px;
    border-radius: 4px;
    border: 1px solid $border;
    background: $bg-2;
    color: $fg;
    font-family: monospace;
    &:focus { outline: none; border-color: $accent; }
    &:disabled { opacity: 0.5; }
  }

  .staging-commit {
    @include flat-btn;
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 4px;
    background: $accent;
    color: #fff;
    font-weight: 600;
    flex-shrink: 0;
    &:hover:not(:disabled) { opacity: 0.85; }
    &:disabled { opacity: 0.4; cursor: default; }
  }

  .staging-ok {
    font-size: 11px;
    color: $green;
    font-weight: 600;
  }

  .staging-err {
    font-size: 10px;
    color: $red;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .binary-badge {
    font-size: 9px;
    color: $amber;
    background: #2a1a00;
    border: 1px solid #553300;
    border-radius: 3px;
    padding: 0 4px;
    font-weight: 400;
  }

  .binary-msg {
    padding: 12px;
    font-size: 11px;
    color: $muted;
    font-style: italic;
    text-align: center;
  }

  // Side-by-side grid
  .sb-container { }

  .sb-hunk-header {
    font-family: monospace;
    font-size: 10px;
    color: $muted;
    background: $bg-3;
    padding: 2px 12px;
    border-bottom: 1px solid $border;
  }

  .sb-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    font-family: monospace;
    font-size: 11px;
    line-height: 1.5;
  }

  .sb-col {
    overflow: hidden;
  }

  .sb-old { border-right: 1px solid $border; }

  .sb-line {
    display: flex;
    min-height: 16.5px;
  }

  .sb-ln {
    display: inline-block;
    width: 36px;
    flex-shrink: 0;
    text-align: right;
    padding-right: 8px;
    color: $border;
    font-size: 10px;
    user-select: none;
  }

  .sb-t {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
    padding-left: 4px;
  }

  .sb-add { background: $green-bg; }
  .sb-add .sb-t { color: $green; }
  .sb-del { background: $red-bg; }
  .sb-del .sb-t { color: $red; }
  .sb-ctx { background: transparent; }
  .sb-ctx .sb-t { color: $fg-dim; }
  .sb-hunk .sb-t { color: $muted; }
  .sb-gap { background: $bg; }

  // Unified fallback
  .unified-pre {
    margin: 0;
    padding: 6px 12px;
    font-size: 11px;
    font-family: monospace;
    line-height: 1.5;
    overflow-x: auto;
  }

  .ul-add { display: block; background: $green-bg; color: $green; }
  .ul-del { display: block; background: $red-bg; color: $red; }
  .ul-ctx { display: block; color: $fg-dim; }
  .ul-hunk { display: block; background: $bg-3; color: $muted; font-size: 10px; }
</style>
