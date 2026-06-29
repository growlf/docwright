<script lang="ts">
  interface HunkLine { type: 'add' | 'del' | 'ctx' | 'hunk'; text: string; oldLine?: number; newLine?: number; }
  interface FileDiff { path: string; binary: boolean; hunks: HunkLine[][]; oldStart: number; newStart: number; }

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
      files.push({ path, binary, hunks, oldStart: parseInt(headerMatch[1]), newStart: parseInt(headerMatch[2]) });
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
        <div class="diff-file">
          <div class="file-header">{file.path}{#if file.binary} <span class="binary-badge">binary</span>{/if}</div>
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
    padding: 6px 12px;
    background: $bg-header;
    border-bottom: 1px solid $border;
    position: sticky;
    top: 0;
    z-index: 1;
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
