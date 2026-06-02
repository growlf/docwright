<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MarkdownRenderer from '../MarkdownRenderer.svelte';
  import { fileChanged } from '$lib/fileChanges';
  import { showToast } from '$lib/toast';
  import TurndownService from 'turndown';
  import markdownit from 'markdown-it';

  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  const md = markdownit({ html: true, linkify: false });

  let raw = $state('');
  let content = $state('');
  let frontmatter = $state<Record<string, any> | null>(null);
  let error = $state<string | null>(null);
  let mode = $state<'read' | 'edit' | 'source'>('read');
  let html = $state('');
  let showProps = $state(true);

  let docType = $derived(
    filePath().startsWith('proposals/') ? 'proposal'
    : filePath().startsWith('plans/') ? 'plan'
    : filePath().startsWith('docs/') ? 'doc'
    : 'page'
  );

  function splitFrontmatter(raw: string) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      const fm: Record<string, any> = {};
      for (const line of match[1].split('\n')) {
        const sep = line.indexOf(':');
        if (sep > 0) fm[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
      }
      return { frontmatter: fm, body: match[2] };
    }
    return { frontmatter: null, body: raw };
  }

  $effect(() => {
    loadFile();
  });

  onMount(() => {
    return fileChanged.subscribe((change) => {
      if (!change || mode !== 'read') return;
      if (change.path === filePath() || change.path.endsWith('/' + filePath())) {
        loadFile();
      }
    });
  });

  async function loadFile() {
    let filePath = $page.params.path;
    if (!filePath.endsWith('.md')) filePath += '.md';
    const res = await fetch('/api/read?path=' + encodeURIComponent(filePath));
    if (!res.ok) {
      if (res.status === 404) {
        raw = '';
        content = '';
        frontmatter = null;
        error = null;
      } else {
        error = 'Failed to load file';
      }
      return;
    }
    error = null;
    const data = await res.json();
    raw = data.content;
    const parsed = splitFrontmatter(data.content);
    frontmatter = parsed.frontmatter;
    content = parsed.body;
    html = md.render(content);
  }

  function filePath(): string {
    let p = $page.params.path;
    if (!p.endsWith('.md')) p += '.md';
    return p;
  }

  let editorEl: HTMLDivElement | undefined = $state();

  function cycleMode() {
    if (mode === 'read') {
      mode = 'edit';
      html = md.render(content);
    } else if (mode === 'edit') {
      mode = 'source';
    } else {
      mode = 'read';
    }
  }

  function setEditorHtml(node: HTMLDivElement) {
    node.innerHTML = html;
    editorEl = node;
    return { destroy() { editorEl = undefined; } };
  }

  function syncHtmlToRaw() {
    if (!editorEl) return;
    const bodyHtml = td.turndown(editorEl.innerHTML);
    const fmPart = frontmatter
      ? '---\n' + Object.entries(frontmatter).map(([k, v]) => k + ': ' + v).join('\n') + '\n---\n'
      : '';
    raw = fmPart + bodyHtml;
    content = bodyHtml;
  }

  function execCmd(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    document.getElementById('wysiwyg-editor')?.focus();
  }

  function insertHeading(level: number) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const heading = document.createElement('h' + level);
    heading.textContent = sel.toString() || 'Heading';
    range.deleteContents();
    range.insertNode(heading);
    const editor = document.getElementById('wysiwyg-editor');
    if (editor) editor.focus();
  }

  async function save() {
    if (mode === 'source') ; else if (mode === 'edit') syncHtmlToRaw();
    const res = await fetch('/api/write?path=' + encodeURIComponent(filePath()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: raw }),
    });
    if (res.ok) {
      mode = 'read';
      const parsed = splitFrontmatter(raw);
      frontmatter = parsed.frontmatter;
      content = parsed.body;
      html = md.render(content);
      showToast('Saved', 2000);
    }
  }

  function rebuildRaw() {
    if (!frontmatter) return;
    const fmStr = Object.entries(frontmatter)
      .map(([k, v]) => Array.isArray(v) ? k + ':\n  - ' + v.join('\n  - ') : k + ': ' + v)
      .join('\n');
    raw = '---\n' + fmStr + '\n---\n' + content;
  }

  async function saveFrontmatter() {
    rebuildRaw();
    await save();
  }

  async function approveProposal() {
    if (!frontmatter) return;
    frontmatter.approved = true;
    if (!frontmatter.assigned_to) frontmatter.assigned_to = prompt('Assign to:') || '';
    rebuildRaw();
    const res = await fetch('/api/write?path=' + encodeURIComponent(filePath()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: raw }),
    });
    if (res.ok) {
      showToast('Approved and assigned to ' + (frontmatter.assigned_to || 'unassigned'), 3000);
      const parsed = splitFrontmatter(raw);
      frontmatter = parsed.frontmatter;
      content = parsed.body;
    }
  }

  function cancel() {
    mode = 'read';
    loadFile();
  }

  async function deleteFile() {
    const fp = filePath();
    if (!confirm('Delete ' + fp + '?\n\nThis can be undone within 5 seconds.')) return;
    const res = await fetch('/api/delete?path=' + encodeURIComponent(fp), {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast('Deleted ' + fp, 5000, {
        label: 'Undo',
        onclick: () => {
          fetch('/api/restore?path=' + encodeURIComponent(fp), { method: 'POST' }).then(r => {
            if (r.ok) { showToast('Restored ' + fp, 3000); loadFile(); }
          });
        },
      });
      setTimeout(() => goto('/'), 5500);
    }
  }
</script>

<div class="page">
  <div class="toolbar">
    <span class="path">{filePath()}</span>
    <div class="actions">
      {#if mode !== 'read'}
        <button class="btn save" onclick={save}>Save</button>
        <button class="btn cancel" onclick={cancel}>Cancel</button>
      {:else}
        <button class="btn del" onclick={deleteFile}>Delete</button>
      {/if}
      <button class="btn mode-toggle" onclick={cycleMode}>
        {mode === 'read' ? 'Edit' : mode === 'edit' ? 'Source' : 'Preview'}
      </button>
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>

  {:else if mode === 'source'}
    <textarea class="editor" bind:value={raw}></textarea>

  {:else if mode === 'edit'}
    <div class="wysiwyg-toolbar">
      <button class="fmt-btn" onclick={() => execCmd('bold')} title="Bold"><b>B</b></button>
      <button class="fmt-btn" onclick={() => execCmd('italic')} title="Italic"><i>I</i></button>
      <span class="sep"></span>
      <button class="fmt-btn" onclick={() => insertHeading(1)} title="Heading 1">H1</button>
      <button class="fmt-btn" onclick={() => insertHeading(2)} title="Heading 2">H2</button>
      <button class="fmt-btn" onclick={() => insertHeading(3)} title="Heading 3">H3</button>
      <span class="sep"></span>
      <button class="fmt-btn" onclick={() => execCmd('insertUnorderedList')} title="Bullet list">•</button>
      <button class="fmt-btn" onclick={() => execCmd('insertOrderedList')} title="Numbered list">1.</button>
      <span class="sep"></span>
      <button class="fmt-btn" onclick={() => execCmd('createLink', prompt('URL:'))} title="Link">🔗</button>
      <button class="fmt-btn" onclick={() => execCmd('formatBlock', '<pre>')} title="Code block">&lt;/&gt;</button>
    </div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="wysiwyg" contenteditable="true" oninput={syncHtmlToRaw} use:setEditorHtml></div>

  {:else}
    {#if frontmatter}
      <div class="fm">
        {#each Object.entries(frontmatter) as [key, val]}
          <span class="fm-entry"><strong>{key}:</strong> {val}</span>
        {/each}
      </div>
    {/if}
    <div class="body">
      {#if content}
        <MarkdownRenderer {content} />
      {:else}
        <p class="muted">Empty file</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page { max-width: 780px; margin: 0 auto; padding: 32px; }
  .error { color: #e44; padding: 16px; background: #2a1111; border-radius: 6px; }
  .fm { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 12px; background: #222; border-radius: 6px; margin-bottom: 24px; font-size: 12px; }
  .fm-entry { color: #aaa; }
  .fm-entry strong { color: #fff; }
  .body { line-height: 1.6; }
  .muted { color: #666; }

  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #333; }
  .path { font-size: 12px; color: #666; font-family: monospace; }
  .actions { display: flex; gap: 6px; }
  .btn { padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid #444; background: #222; color: #ccc; }
  .btn:hover { background: #333; color: #fff; }
  .btn.save { border-color: #2b5b84; color: #58a6ff; }
  .btn.save:hover { background: #1a3a5a; }
  .btn.cancel { border-color: #555; color: #999; }
  .btn.del { border-color: #842b2b; color: #e44; }
  .btn.del:hover { background: #3a1a1a; }
  .mode-toggle { border-color: #5b842b; color: #8c6; }
  .mode-toggle:hover { background: #1a3a1a; }

  .editor { width: 100%; min-height: 60vh; background: #0a0a0a; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 16px; font-family: monospace; font-size: 13px; line-height: 1.5; resize: vertical; }

  .wysiwyg-toolbar { display: flex; gap: 2px; align-items: center; padding: 6px 8px; background: #222; border: 1px solid #333; border-bottom: none; border-radius: 6px 6px 0 0; flex-wrap: wrap; }
  .fmt-btn { background: none; border: 1px solid transparent; color: #ccc; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 13px; height: 26px; }
  .fmt-btn:hover { background: #333; border-color: #444; }
  .sep { width: 1px; height: 18px; background: #444; margin: 0 4px; }
  .wysiwyg { width: 100%; min-height: 60vh; background: #0a0a0a; color: #e0e0e0; border: 1px solid #333; border-radius: 0 0 6px 6px; padding: 16px; font-size: 15px; line-height: 1.6; outline: none; }
  .wysiwyg:focus { border-color: #2b5b84; }
  .wysiwyg :global(h1) { font-size: 1.8em; margin: 0.5em 0; color: #fff; }
  .wysiwyg :global(h2) { font-size: 1.4em; margin: 0.5em 0; color: #eee; }
  .wysiwyg :global(h3) { font-size: 1.2em; margin: 0.5em 0; color: #ddd; }
  .wysiwyg :global(p) { margin: 0.5em 0; }
  .wysiwyg :global(code) { background: #1a1a1a; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px; }
  .wysiwyg :global(pre) { background: #111; padding: 12px; border-radius: 6px; overflow-x: auto; }
  .wysiwyg :global(pre code) { background: none; padding: 0; }
</style>
