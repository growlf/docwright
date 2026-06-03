<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MarkdownRenderer from '../MarkdownRenderer.svelte';
  import PropertiesPane from '$lib/PropertiesPane.svelte';
  import CollationPanel from '$lib/CollationPanel.svelte';
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
  let propsCollapsed = $state(
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('propsPaneCollapsed') === 'true'
      : false
  );

  // Collation panel state
  let showCollation = $state(false);
  let collationLoading = $state(false);
  let collationMatches = $state<any[]>([]);
  let lastOverlapPath = $state(''); // avoid re-firing on the same file

  let docType = $derived(
    filePath().startsWith('proposals/') ? 'proposal'
    : filePath().startsWith('plans/')     ? 'plan'
    : filePath().startsWith('docs/')      ? 'doc'
    : 'page'
  );

  // ---------------------------------------------------------------------------
  // YAML parsing — handles strings, booleans, numbers, and block arrays
  // ---------------------------------------------------------------------------
  function parseFm(yaml: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yaml.split('\n');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
      const colonIdx = line.indexOf(':');
      if (colonIdx <= 0) { i++; continue; }
      const key = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();
      if (rest === '' || rest === '[]') {
        i++;
        if (rest === '[]') { result[key] = []; continue; }
        // Peek for array items
        if (i < lines.length && /^\s+-\s/.test(lines[i])) {
          const arr: string[] = [];
          while (i < lines.length && /^\s+-\s/.test(lines[i])) {
            arr.push(lines[i].replace(/^\s+-\s*/, '').trim());
            i++;
          }
          result[key] = arr;
        } else {
          result[key] = '';
        }
        continue;
      }
      let val: any = rest;
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      else if (val === 'true')  val = true;
      else if (val === 'false') val = false;
      else if (val === 'null' || val === '~') val = null;
      result[key] = val;
      i++;
    }
    return result;
  }

  function stringifyFm(data: Record<string, any>): string {
    return Object.entries(data).map(([k, v]) => {
      if (Array.isArray(v)) {
        return v.length === 0 ? k + ': []' : k + ':\n' + v.map(i => '  - ' + i).join('\n');
      }
      if (typeof v === 'boolean') return k + ': ' + v;
      if (v === null || v === undefined) return k + ':';
      const s = String(v);
      if (s === '') return k + ': ""';
      if (s.includes(':') || s.includes('#') || s.startsWith('{')) return k + ': "' + s.replace(/"/g, '\\"') + '"';
      return k + ': ' + s;
    }).join('\n');
  }

  function splitFrontmatter(raw: string): { frontmatter: Record<string, any> | null; body: string } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: null, body: raw };
    return { frontmatter: parseFm(match[1]), body: match[2] };
  }

  function buildRaw(fm: Record<string, any>, body: string): string {
    return '---\n' + stringifyFm(fm) + '\n---\n' + body;
  }

  // ---------------------------------------------------------------------------
  // File loading
  // ---------------------------------------------------------------------------
  $effect(() => { loadFile(); });

  onMount(() => {
    // Open in edit mode with pane expanded when navigating to a newly created proposal
    if ($page.url.searchParams.get('new') === '1') {
      mode = 'edit';
      showProps = true;
      goto($page.url.pathname, { replaceState: true, noScroll: true });
    }
    return fileChanged.subscribe((change) => {
      if (!change || mode !== 'read') return;
      if (change.path === filePath() || change.path.endsWith('/' + filePath())) loadFile();
    });
  });

  async function loadFile() {
    const res = await fetch('/api/read?path=' + encodeURIComponent(filePath()));
    if (!res.ok) {
      if (res.status === 404) {
        // Try to find the document at a different lifecycle path (e.g. moved to approved/)
        const slug = filePath().replace(/\.md$/, '').replace(/^.*\//, '');
        const findRes = await fetch('/api/find?name=' + encodeURIComponent(slug));
        if (findRes.ok) {
          const { path: foundPath } = await findRes.json();
          if (foundPath) { goto('/' + foundPath.replace(/\.md$/, ''), { replaceState: true }); return; }
        }
        // Truly missing — show not-found state
        raw = ''; content = ''; frontmatter = null; error = '404';
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

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------
  let editorEl: HTMLDivElement | undefined = $state();

  function cycleMode() {
    if (mode === 'read')       mode = 'edit';
    else if (mode === 'edit')  mode = 'source';
    else                       mode = 'read';
  }

  function setEditorHtml(node: HTMLDivElement) {
    node.innerHTML = html;
    editorEl = node;
    return { destroy() { editorEl = undefined; } };
  }

  function syncHtmlToRaw() {
    if (!editorEl) return;
    content = td.turndown(editorEl.innerHTML);
    raw = frontmatter ? buildRaw(frontmatter, content) : content;
  }

  function execCmd(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    document.getElementById('wysiwyg-editor')?.focus();
  }

  function insertHeading(level: number) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const h = document.createElement('h' + level);
    h.textContent = sel.toString() || 'Heading';
    range.deleteContents();
    range.insertNode(h);
    document.getElementById('wysiwyg-editor')?.focus();
  }

  // ---------------------------------------------------------------------------
  // Save / frontmatter actions
  // ---------------------------------------------------------------------------
  async function save() {
    if (mode === 'edit') syncHtmlToRaw();
    if (frontmatter) raw = buildRaw(frontmatter, content);
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
      if (docType === 'proposal') checkOverlap();
    }
  }

  async function saveFrontmatter() {
    if (frontmatter) raw = buildRaw(frontmatter, content);
    await save();
  }

  async function checkOverlap() {
    const fp = filePath();
    if (lastOverlapPath === fp) return;
    lastOverlapPath = fp;
    const res = await fetch('/api/overlap?path=' + encodeURIComponent(fp));
    if (!res.ok) return;
    const { matches } = await res.json();
    for (const m of matches) {
      showToast(`Possible overlap with "${m.title}" (${Math.round(m.score * 100)}% match) →`, 0, {
        label: 'Review',
        onclick: () => goto('/' + m.path.replace(/\.md$/, '')),
      });
    }
  }

  async function findRelated() {
    showCollation = true;
    collationLoading = true;
    collationMatches = [];
    const res = await fetch('/api/overlap?path=' + encodeURIComponent(filePath()));
    collationLoading = false;
    if (res.ok) {
      const { matches } = await res.json();
      collationMatches = matches;
    }
  }

  function handleInsert(slug: string, heading: string, sectionContent: string) {
    const quote = `\n\n> *from [[${slug}]] — ${heading}*\n` +
      sectionContent.split('\n').map(l => '> ' + l).join('\n') + '\n';
    content += quote;
    raw = frontmatter ? buildRaw(frontmatter, content) : content;
    html = md.render(content);
    mode = 'edit';
  }

  async function handleSubsume(relPath: string) {
    const res = await fetch('/api/read?path=' + encodeURIComponent(relPath));
    if (!res.ok) return;
    const { content: relRaw } = await res.json();
    const parsed = splitFrontmatter(relRaw);
    if (!parsed.frontmatter) return;
    parsed.frontmatter.subsumed_by = filePath().replace(/\.md$/, '');
    const updated = buildRaw(parsed.frontmatter, parsed.body);
    await fetch('/api/write?path=' + encodeURIComponent(relPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: updated }),
    });
    showToast('Marked ' + relPath + ' as subsumed', 2000);
  }

  async function handleApprove() {
    if (!frontmatter) return;
    if (!frontmatter.assigned_to || String(frontmatter.assigned_to).trim() === '') {
      const who = prompt('Assign to:');
      if (who) frontmatter = { ...frontmatter, assigned_to: who };
    }
    await saveFrontmatter();
    showToast('Approved — assigned to ' + (frontmatter.assigned_to || 'unassigned'), 3000);
  }

  function cancel() { mode = 'read'; loadFile(); }

  async function deleteFile() {
    const fp = filePath();
    if (!confirm('Delete ' + fp + '?\n\nThis can be undone within 5 seconds.')) return;
    const res = await fetch('/api/delete?path=' + encodeURIComponent(fp), { method: 'DELETE' });
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

<div class="page-wrap">
  <!-- Main content -->
  <div class="page-body"
    class:pane-open={showProps && mode !== 'source' && !propsCollapsed}
    class:pane-collapsed={showProps && mode !== 'source' && propsCollapsed}
  >
    <div class="toolbar">
      <span class="path">{filePath()}</span>
      <div class="actions">
        {#if mode !== 'read'}
          <button class="btn save" onclick={save}>Save</button>
          <button class="btn cancel" onclick={cancel}>Cancel</button>
        {:else}
          <button class="btn del" onclick={deleteFile}>Delete</button>
        {/if}
        <button class="btn props-toggle" onclick={() => showProps = !showProps} title="Toggle properties">
          ⊞
        </button>
        <button class="btn mode-toggle" onclick={cycleMode}>
          {mode === 'read' ? 'Edit' : mode === 'edit' ? 'Source' : 'Preview'}
        </button>
      </div>
    </div>

    {#if error === '404'}
      <div class="not-found">
        <div class="nf-icon">⌕</div>
        <h2 class="nf-title">Document not found</h2>
        <p class="nf-path">{filePath()}</p>
        <div class="nf-actions">
          <a class="nf-btn primary" href="/status">Go to status page</a>
          <button class="nf-btn" onclick={() => { goto('/proposals/' + filePath().replace(/^.*\//, '').replace(/\.md$/, '') + '?new=1'); }}>Create as proposal</button>
        </div>
      </div>
    {:else if error}
      <p class="error">{error}</p>

    {:else if mode === 'source'}
      <textarea class="editor" bind:value={raw}></textarea>

    {:else if mode === 'edit'}
      <div class="wysiwyg-toolbar">
        <button class="fmt-btn" onclick={() => execCmd('bold')} title="Bold"><b>B</b></button>
        <button class="fmt-btn" onclick={() => execCmd('italic')} title="Italic"><i>I</i></button>
        <span class="sep"></span>
        <button class="fmt-btn" onclick={() => insertHeading(1)} title="H1">H1</button>
        <button class="fmt-btn" onclick={() => insertHeading(2)} title="H2">H2</button>
        <button class="fmt-btn" onclick={() => insertHeading(3)} title="H3">H3</button>
        <span class="sep"></span>
        <button class="fmt-btn" onclick={() => execCmd('insertUnorderedList')} title="Bullet">•</button>
        <button class="fmt-btn" onclick={() => execCmd('insertOrderedList')} title="Numbered">1.</button>
        <span class="sep"></span>
        <button class="fmt-btn" onclick={() => execCmd('createLink', prompt('URL:') ?? '')} title="Link">🔗</button>
        <button class="fmt-btn" onclick={() => execCmd('formatBlock', '<pre>')} title="Code">&lt;/&gt;</button>
      </div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div id="wysiwyg-editor" class="wysiwyg" contenteditable="true"
        oninput={syncHtmlToRaw} use:setEditorHtml></div>

    {:else}
      {#if frontmatter}
        <div class="fm">
          {#each Object.entries(frontmatter) as [key, val]}
            <span class="fm-entry"><strong>{key}:</strong>
              {Array.isArray(val) ? val.join(', ') : String(val ?? '')}
            </span>
          {/each}
        </div>
        {#if Array.isArray(frontmatter.depends_on) && frontmatter.depends_on.length > 0}
          <div class="dep-row">
            <span class="dep-label">Depends on:</span>
            {#each frontmatter.depends_on as dep}
              <a class="dep-link" href="/{dep}">{dep}</a>
            {/each}
          </div>
        {/if}
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

  <!-- Properties pane — hidden in source mode -->
  {#if showProps && mode !== 'source' && frontmatter}
    <PropertiesPane
      bind:frontmatter={frontmatter}
      bind:collapsed={propsCollapsed}
      {docType}
      {mode}
      onsave={saveFrontmatter}
      onapprove={handleApprove}
      onfindrelated={findRelated}
    />
  {/if}
</div>

<!-- Collation panel — fixed overlay -->
{#if showCollation}
  <CollationPanel
    matches={collationMatches}
    loading={collationLoading}
    oninsert={handleInsert}
    onsubsume={handleSubsume}
    onclose={() => { showCollation = false; collationMatches = []; }}
  />
{/if}

<style>
  .page-wrap { display: block; min-height: 100%; }
  .page-body { padding: 32px; }
  .page-body.pane-open     { padding-right: 296px; } /* 280px pane + 16px gap */
  .page-body.pane-collapsed { padding-right: 48px;  } /* 32px collapsed pane + 16px gap */

  .error  { color: #e44; padding: 16px; background: #2a1111; border-radius: 6px; }
  .not-found { text-align: center; padding: 64px 32px; }
  .nf-icon { font-size: 48px; color: #333; margin-bottom: 16px; }
  .nf-title { font-size: 18px; color: #666; font-weight: 500; margin: 0 0 8px; }
  .nf-path { font-size: 12px; color: #444; font-family: monospace; margin: 0 0 24px; }
  .nf-actions { display: flex; gap: 10px; justify-content: center; }
  .nf-btn { padding: 6px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid #333; background: #1a1a1a; color: #888; text-decoration: none; display: inline-block; }
  .nf-btn:hover { border-color: #555; color: #ccc; }
  .nf-btn.primary { border-color: #2b5b84; color: #58a6ff; background: #0d1f2d; }
  .nf-btn.primary:hover { background: #1a3a5a; }
  .fm     { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 12px; background: #222; border-radius: 6px; margin-bottom: 24px; font-size: 12px; }
  .fm-entry { color: #aaa; }
  .fm-entry strong { color: #fff; }
  .body   { line-height: 1.6; }
  .dep-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 12px; background: #181818; border-radius: 4px; margin-bottom: 16px; font-size: 12px; }
  .dep-label { color: #555; font-weight: 600; }
  .dep-link { color: #58a6ff; text-decoration: none; border: 1px solid #1e3a5a; border-radius: 10px; padding: 1px 8px; }
  .dep-link:hover { background: #1a3a5a; }
  .muted  { color: #666; }

  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #333; }
  .path   { font-size: 12px; color: #666; font-family: monospace; }
  .actions { display: flex; gap: 6px; }
  .btn    { padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid #444; background: #222; color: #ccc; }
  .btn:hover { background: #333; color: #fff; }
  .btn.save  { border-color: #2b5b84; color: #58a6ff; }
  .btn.save:hover { background: #1a3a5a; }
  .btn.cancel { border-color: #555; color: #999; }
  .btn.del  { border-color: #842b2b; color: #e44; }
  .btn.del:hover { background: #3a1a1a; }
  .mode-toggle { border-color: #5b842b; color: #8c6; }
  .mode-toggle:hover { background: #1a3a1a; }
  .props-toggle { border-color: #444; color: #777; font-size: 14px; padding: 2px 9px; }
  .props-toggle:hover { color: #aaa; }

  .editor { width: 100%; min-height: 60vh; background: #0a0a0a; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 16px; font-family: monospace; font-size: 13px; line-height: 1.5; resize: vertical; box-sizing: border-box; }

  .wysiwyg-toolbar { display: flex; gap: 2px; align-items: center; padding: 6px 8px; background: #222; border: 1px solid #333; border-bottom: none; border-radius: 6px 6px 0 0; flex-wrap: wrap; }
  .fmt-btn { background: none; border: 1px solid transparent; color: #ccc; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 13px; height: 26px; }
  .fmt-btn:hover { background: #333; border-color: #444; }
  .sep { width: 1px; height: 18px; background: #444; margin: 0 4px; }
  .wysiwyg { width: 100%; min-height: 60vh; background: #0a0a0a; color: #e0e0e0; border: 1px solid #333; border-radius: 0 0 6px 6px; padding: 16px; font-size: 15px; line-height: 1.6; outline: none; box-sizing: border-box; }
  .wysiwyg:focus { border-color: #2b5b84; }
  .wysiwyg :global(h1) { font-size: 1.8em; margin: 0.5em 0; color: #fff; }
  .wysiwyg :global(h2) { font-size: 1.4em; margin: 0.5em 0; color: #eee; }
  .wysiwyg :global(h3) { font-size: 1.2em; margin: 0.5em 0; color: #ddd; }
  .wysiwyg :global(p)  { margin: 0.5em 0; }
  .wysiwyg :global(code) { background: #1a1a1a; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px; }
  .wysiwyg :global(pre) { background: #111; padding: 12px; border-radius: 6px; overflow-x: auto; }
  .wysiwyg :global(pre code) { background: none; padding: 0; }
</style>
