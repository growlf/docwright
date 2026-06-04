<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MarkdownRenderer from '../MarkdownRenderer.svelte';
  import PropertiesPane from '$lib/PropertiesPane.svelte';
  import CollationPanel from '$lib/CollationPanel.svelte';
  import { fileChanged } from '$lib/fileChanges';
  import { showToast } from '$lib/toast';
  import { showPropsPane } from '$lib/pane';
  import { currentDoc } from '$lib/currentDoc';
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

  // Mobile gear icon (from layout) toggles pane via store
  onMount(() => {
    return showPropsPane.subscribe(v => {
      if (window.innerWidth <= 768) {
        showProps = v;
        if (v) propsCollapsed = false;
      }
    });
  });

  function toggleProps() {
    showProps = !showProps;
    showPropsPane.set(showProps);
  }

  // Collation panel state
  let showCollation = $state(false);
  let rightTab = $state<'properties' | 'related'>('properties');
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
    frontmatter = parsed.frontmatter ? { ...parsed.frontmatter, _path: filePath() } : null;
    content = parsed.body;
    html = md.render(content);
    // Push to layout's right sidebar
    currentDoc.set({
      frontmatter,
      docType,
      mode,
      filePath: filePath(),
      onSave:         saveFrontmatter,
      onApprove:      handleApprove,
      onFindRelated:  findRelated,
      onInsert:       handleInsert,
      onSubsume:      handleSubsume,
    });
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
    currentDoc.update(d => ({ ...d, mode }));
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
    if (matches.length === 0) return;
    collationMatches = matches;
    showToast(
      `${matches.length} related proposal${matches.length === 1 ? '' : 's'} found`,
      8000,
      { label: 'Review', onclick: () => { showCollation = true; } }
    );
  }

  async function findRelated() {
    // Switch right panel to Related tab and load matches
    showProps = true;
    propsCollapsed = false;
    showPropsPane.set(true);
    rightTab = 'related';
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
  <div class="page-body">
    <div class="toolbar">
      <div class="doc-identity">
        {#if frontmatter?.title}
          <span class="doc-title">{frontmatter.title}</span>
          <span class="path">{filePath()}</span>
        {:else}
          <span class="path path-only">{filePath()}</span>
        {/if}
      </div>
      <div class="actions">
        {#if mode !== 'read'}
          <button class="btn save" onclick={save} title="Save changes">✓ Save</button>
          <button class="btn cancel" onclick={cancel} title="Discard changes">✕ Cancel</button>
        {:else}
          <button class="btn del" onclick={deleteFile} title="Delete this document">🗑 Delete</button>
        {/if}
        <button class="btn mode-toggle" onclick={cycleMode}
          title={mode === 'read' ? 'Switch to WYSIWYG editor' : mode === 'edit' ? 'Switch to raw Markdown / frontmatter source' : 'Switch to read-only preview'}>
          {mode === 'read' ? '✏ Edit' : mode === 'edit' ? '⟨/⟩ Source' : '👁 Preview'}
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
      {#if frontmatter?.title && docType !== 'page'}
        <h1 class="doc-h1">{frontmatter.title}</h1>
      {/if}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div id="wysiwyg-editor" class="wysiwyg" contenteditable="true"
        oninput={syncHtmlToRaw} use:setEditorHtml></div>

    {:else}
      {#if frontmatter?.title && docType !== 'page'}
        <h1 class="doc-h1">{frontmatter.title}</h1>
      {/if}
      {#if frontmatter && Array.isArray(frontmatter.depends_on) && frontmatter.depends_on.length > 0}
        <div class="dep-row">
          <span class="dep-label">Depends on:</span>
          {#each frontmatter.depends_on as dep}
            <a class="dep-link" href="/{dep}">{dep}</a>
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

</div>

<style>
  /* page-wrap is always a flex row — Panel.svelte handles open/closed width */
  .page-wrap { display: flex; min-height: 100%; align-items: flex-start; }
  .page-body { flex: 1; min-width: 0; padding: 32px; overflow-y: auto; }

  /* Right panel tab bar */
  .right-tab-bar { display: flex; border-bottom: 1px solid #1e1e1e; flex-shrink: 0; }
  .right-tab { flex: 1; background: none; border: none; border-bottom: 2px solid transparent; color: #555; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 4px 6px; cursor: pointer; }
  .right-tab:hover  { color: #aaa; }
  .right-tab.active { color: #ccc; border-bottom-color: #58a6ff; }
  .right-empty { padding: 16px; font-size: 12px; color: #444; }

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
  .doc-h1 { font-size: 1.75em; font-weight: 700; color: #fff; margin: 0 0 20px; padding-bottom: 10px; border-bottom: 1px solid #222; line-height: 1.25; }
  .body   { line-height: 1.6; }
  .dep-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 12px; background: #181818; border-radius: 4px; margin-bottom: 16px; font-size: 12px; }
  .dep-label { color: #555; font-weight: 600; }
  .dep-link { color: #58a6ff; text-decoration: none; border: 1px solid #1e3a5a; border-radius: 10px; padding: 1px 8px; }
  .dep-link:hover { background: #1a3a5a; }
  .muted  { color: #666; }

  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #333; gap: 12px; }
  .doc-identity { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .doc-title { font-size: 15px; font-weight: 600; color: #e8e8e8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .path   { font-size: 11px; color: #555; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .path-only { font-size: 13px; color: #888; }
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
  /* props-toggle removed — right sidebar handles properties */
  /* props-scrim removed — Panel.svelte provides the mobile scrim now */

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

  /* ── Mobile (≤ 768px) ───────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    /* Reset to block layout (no flex) */
    .page-wrap { display: block; padding: 0; }
    /* Content padding */
    .page-body { padding: 16px; }

    /* Toolbar: keep it compact, hide low-priority actions */
    .toolbar { flex-wrap: wrap; gap: 4px; }
    .path { display: none; }           /* path shown in topbar on mobile; hide here */
    .doc-title { font-size: 14px; }    /* title stays visible on mobile */
  /* props-toggle removed */

    /* Touch-friendly button sizing */
    .btn { min-height: 44px; padding: 8px 14px; font-size: 13px; }

    /* Touch-friendly WYSIWYG toolbar */
    .fmt-btn { min-height: 44px; padding: 0 10px; }
  }
</style>
