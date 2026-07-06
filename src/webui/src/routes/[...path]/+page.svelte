<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MarkdownRenderer from '../MarkdownRenderer.svelte';
  import PropertiesPane from '$lib/PropertiesPane.svelte';
  import BaseView from '$lib/BaseView.svelte';
  import CollationPanel from '$lib/CollationPanel.svelte';
  import { fileChanged } from '$lib/fileChanges';
  import { showToast, dismissToast } from '$lib/toast';
  import { showPropsPane, showRelatedTab, collationMatches, collationRelationships, collationLoading, featureFlags, improveResult, improveLoading, showImproveTab, triggerImprovePending } from '$lib/pane';
  import { currentDoc } from '$lib/currentDoc';
  import DiffMatchPatch from 'diff-match-patch';
  import {
    createTurndown,
    createMarkdownIt,
    splitFrontmatter,
    buildRawFromText,
    applyFrontmatterEdits,
  } from '$lib/markdown-roundtrip';

  const td = createTurndown();
  const md = createMarkdownIt();

  let raw = $state('');
  let content = $state('');
  // Original frontmatter text block — reattached verbatim on save; parsed
  // `frontmatter` is a display/logic view and is NEVER re-serialized (#149).
  let fmText = $state<string | null>(null);
  let frontmatter = $state<Record<string, any> | null>(null);
  let error = $state<string | null>(null);
  let mode = $state<'read' | 'edit' | 'source'>('read');
  let loadedEtag = $state<string | null>(null);
  let conflictDialog = $state<{ serverContent: string } | null>(null);

  function buildDiffHtml(mine: string, theirs: string): string {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(theirs, mine);
    dmp.diff_cleanupSemantic(diffs);
    return diffs.map(([op, text]) => {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (op === 1) return `<ins>${escaped}</ins>`;
      if (op === -1) return `<del>${escaped}</del>`;
      return escaped;
    }).join('');
  }
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

  // Collation panel state — body-length tracking avoids re-scan on frontmatter-only saves
  let lastBodyLen = $state(0);
  // Set in onMount when ?from=proposal is detected; cleared after loadFile triggers improve
  let pendingAutoImprove = false;
  // Track whether we already ran the related-check before approving
  let approvalRelatedChecked = false;

  let docType = $derived(
    filePath().startsWith('proposals/') ? 'proposal'
    : filePath().startsWith('plans/')     ? 'plan'
    : filePath().startsWith('docs/')      ? 'doc'
    : 'page'
  );

  // ---------------------------------------------------------------------------
  // File loading
  // ---------------------------------------------------------------------------
  $effect(() => { if (!isBase) loadFile(); });

  onMount(() => {
    // Open in edit mode with pane expanded when navigating to a newly created proposal
    if ($page.url.searchParams.get('new') === '1') {
      mode = 'edit';
      showProps = true;
      // Auto-trigger improve for new proposals so AI fleshes out the description
      if (docType === 'proposal') pendingAutoImprove = true;
      goto($page.url.pathname, { replaceState: true, noScroll: true });
    }
    // Plan just created from an approved proposal — show success toast and properties pane
    if ($page.url.searchParams.get('from') === 'proposal') {
      showProps = true;
      showPropsPane.set(true);
      showToast('Plan created — draft; fill steps / mark in-progress', 5000);
      goto($page.url.pathname, { replaceState: true, noScroll: true });
    }
    return fileChanged.subscribe((change) => {
      if (!change) return;
      const isThisFile = change.path === filePath() || change.path.endsWith('/' + filePath());
      if (!isThisFile) return;
      if (mode !== 'read') {
        // Bug 5 fix: don't silently ignore external changes while the user is editing
        showToast('This document was modified externally. Discard your edits or save to overwrite.', 6000);
        return;
      }
      loadFile();
    });
  });

  onDestroy(() => {
    currentDoc.set({
      frontmatter: null,
      body: '',
      docType: 'page',
      mode: 'read',
      filePath: '',
    });
  });

  async function loadFile() {
    approvalRelatedChecked = false;
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
        raw = ''; content = ''; fmText = null; frontmatter = null; error = '404';
      } else {
        error = 'Failed to load file';
      }
      return;
    }
    error = null;
    loadedEtag = res.headers.get('ETag');
    const data = await res.json();
    raw = data.content;
    const parsed = splitFrontmatter(data.content);
    fmText = parsed.fmText;
    frontmatter = parsed.frontmatter ? { ...parsed.frontmatter, _path: filePath() } : null;
    content = parsed.body;
    html = md.render(content);
    // Auto-improve when navigating from proposal approval
    if (pendingAutoImprove) {
      pendingAutoImprove = false;
      const stickyId = showToast('AI is analyzing the new plan…', 0);
      triggerImproveOnSave(stickyId);
    }
    // Push to layout's right sidebar
    currentDoc.set({
      frontmatter,
      body: content,
      docType,
      mode,
      filePath: filePath(),
      onSave:          saveFrontmatter,
      onApprove:       handleApprove,
      onFindRelated:   findRelated,
      onAddRelated:    handleAddRelated,
      onAddDepends:    handleAddDepends,
      onAddBlocks:     handleAddBlocks,
      onSubsume:       handleSubsume,
    });
  }

  function filePath(): string {
    let p = $page.params.path || '';
    if (!p) return '';
    if (p.endsWith('.base')) return p;
    if (!p.endsWith('.md')) p += '.md';
    return p;
  }

  let isBase = $derived(filePath().endsWith('.base'));

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------
  let editorEl: HTMLDivElement | undefined = $state();

  // WYSIWYG is blocked on governance docs until the HTML⇄markdown round-trip
  // is proven byte-stable on them (#149) — read and source modes only. The
  // plan-file mangling incident came through this editor.
  let wysiwygBlocked = $derived(/^(plans|policies|decisions)\//.test(filePath()));

  function cycleMode() {
    if (mode === 'read')       mode = wysiwygBlocked ? 'source' : 'edit';
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
    // Body-only round-trip: the original frontmatter block is reattached
    // byte-identical — never re-serialized (#149).
    raw = buildRawFromText(fmText, content);
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
  async function triggerPlanCompletedTransition() {
    try {
      const planName = filePath().replace(/^plans\//, '').replace(/\.md$/, '');
      const transRes = await fetch('/api/lifecycle/transition-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planName }),
      });
      if (transRes.ok) {
        const data = await transRes.json().catch(() => ({ doc: null }));
        showToast(`Plan complete ✓ — archived to ${data.doc || 'plans/completed/'}`, 3000);
        setTimeout(() => goto('/status'), 800);
      } else {
        const err = await transRes.json().catch(() => ({ error: `HTTP ${transRes.status}` }));
        showToast(`⚠ ${err.error}`, 5000);
      }
    } catch (e) {
      showToast(`⚠ Transition failed: ${e instanceof Error ? e.message : 'unknown error'}`, 5000);
    }
  }

  async function save() {
    try {
      if (mode === 'edit') syncHtmlToRaw();
      // In source mode `raw` is textarea-bound and IS the truth; in read mode
      // (property-pane saves) the caller already rebuilt it. Never rebuild
      // from parsed state here — that re-serialized frontmatter and clobbered
      // source-mode edits (#149).
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (loadedEtag) headers['If-Match'] = loadedEtag;
      const res = await fetch('/api/write?path=' + encodeURIComponent(filePath()), {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: raw }),
      });
      if (res.status === 409) {
        const data = await res.json();
        conflictDialog = { serverContent: data.currentContent ?? '' };
        return;
      }
      if (!res.ok) {
        showToast(`Save failed (${res.status}) — check the console`, 5000);
        return;
      }
      if (res.ok) {
        const saved = await res.json();
        loadedEtag = saved.etag ?? null;
        mode = 'read';
        const parsed = splitFrontmatter(raw);
        fmText = parsed.fmText;
        frontmatter = parsed.frontmatter;
        content = parsed.body;
        html = md.render(content);
        showToast('Saved', 2000);
        if (docType === 'plan' && frontmatter?.status === 'completed') {
          await triggerPlanCompletedTransition();
        }
        if (docType === 'proposal') {
          // If the proposal is already approved, skip overlap check and AI improvement
          if (frontmatter?.approved !== true) {
            if (lastBodyLen === 0 && $featureFlags.autoDetectOnCreate) checkOverlap();
            else if (lastBodyLen > 0 && $featureFlags.autoDetectOnUpdate) checkOverlap();
            // On-save trigger: fire improvement pass non-blocking on first save of a new proposal
            if (lastBodyLen === 0) triggerImproveOnSave();
          }
        }
      }
    } catch (e) {
      showToast(`⚠ Save error: ${e instanceof Error ? e.message : 'unknown error'}`, 5000);
    }
  }

  async function saveFrontmatter(fm?: Record<string, any>) {
    // When called from the layout's PropertiesPane, fm contains the mutated
    // frontmatter — apply it to local state before saving
    // Capture prev state from raw file content (NOT from reactive frontmatter,
    // which may already be mutated by $bindable() propagation).
    const prevParsed = splitFrontmatter(raw);
    const prevApproved = prevParsed.frontmatter?.approved;
    if (fm) frontmatter = { ...fm };
    // If the plan body was edited (not just frontmatter), reset tests_defined
    // so the user must re-run tests before completing.
    if (docType === 'plan' && frontmatter?.tests_defined === true) {
      if (content !== prevParsed.body) {
        frontmatter = { ...frontmatter, tests_defined: false };
      }
    }
    // Apply property edits as per-field, byte-preserving text edits on the
    // original frontmatter block — never a full re-serialization (#149).
    if (fmText !== null && frontmatter) {
      fmText = applyFrontmatterEdits(fmText, prevParsed.frontmatter ?? {}, frontmatter);
      raw = buildRawFromText(fmText, content);
    }
    await save();  // save() already triggers transition for completed plans

    // When a proposal is saved with approved: true and is still in proposals/ root
    // (not proposals/approved/), trigger the full approval flow — move + plan creation.
    // This catches the case where approved: true was set via frontmatter editing
    // rather than by clicking the Approve button.
    const fp = filePath();
    if (
      docType === 'proposal' &&
      frontmatter?.approved === true &&
      prevApproved !== true &&
      fp.startsWith('proposals/') &&
      !fp.startsWith('proposals/approved/')
    ) {
      await handleApprove();
    }
  }

  function triggerImproveOnSave(stickyToastId?: number) {
    // Dismiss the sticky toast immediately — handleImprove in layout will show its own toast
    if (stickyToastId !== undefined) dismissToast(stickyToastId);
    // Signal layout to run handleImprove() — avoids duplicating SSE logic here
    triggerImprovePending.set(true);
  }

  async function checkOverlap() {
    if (content.length === lastBodyLen) return; // body unchanged — skip re-scan
    lastBodyLen = content.length;
    const fp = filePath();
    const res = await fetch('/api/overlap?path=' + encodeURIComponent(fp));
    if (!res.ok) return;
    const { matches, relationships } = await res.json();
    if (matches.length === 0) return;
    collationMatches.set(matches);
    collationRelationships.set(relationships || []);
    showToast(
      `${matches.length} related proposal${matches.length === 1 ? '' : 's'} found`,
      8000,
      {
        label: 'Review',
        onclick: () => {
          showPropsPane.set(true);
          showRelatedTab.set(true);
        }
      }
    );
  }

  async function findRelated() {
    showProps = true;
    propsCollapsed = false;
    showPropsPane.set(true);
    showRelatedTab.set(true);
    collationLoading.set(true);
    collationMatches.set([]);
    collationRelationships.set([]);
    const res = await fetch('/api/overlap?path=' + encodeURIComponent(filePath()));
    collationLoading.set(false);
    if (res.ok) {
      const data = await res.json();
      collationMatches.set(data.matches || []);
      collationRelationships.set(data.relationships || []);
    }
  }

  async function handleAddRelated(relPath: string) {
    if (!frontmatter) return;
    const current: string[] = Array.isArray(frontmatter.related_to) ? frontmatter.related_to : [];
    // Normalise path for comparison (with or without .md)
    const norm = relPath.endsWith('.md') ? relPath : relPath + '.md';
    const alreadyIn = current.some(r => r === relPath || r === norm || r.replace(/\.md$/, '') === relPath.replace(/\.md$/, ''));
    if (alreadyIn) return;
    const updated = { ...frontmatter, related_to: [...current, relPath] };
    await saveFrontmatter(updated);
    showToast('Added to related_to: ' + relPath.split('/').pop(), 2500);
  }

  async function handleSubsume(relPath: string) {
    const res = await fetch('/api/read?path=' + encodeURIComponent(relPath));
    if (!res.ok) return;
    const { content: relRaw } = await res.json();
    const parsed = splitFrontmatter(relRaw);
    if (parsed.fmText === null || !parsed.frontmatter) return;
    const newFmText = applyFrontmatterEdits(parsed.fmText, parsed.frontmatter, {
      ...parsed.frontmatter,
      subsumed_by: filePath().replace(/\.md$/, ''),
    });
    const updated = buildRawFromText(newFmText, parsed.body);
    await fetch('/api/write?path=' + encodeURIComponent(relPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: updated }),
    });
    showToast('Marked ' + relPath + ' as subsumed', 2000);
  }

  async function handleAddDepends(relPath: string) {
    if (!frontmatter) return;
    const current: string[] = Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on : [];
    const norm = relPath.endsWith('.md') ? relPath : relPath + '.md';
    const alreadyIn = current.some(r => r === relPath || r === norm || r.replace(/\.md$/, '') === relPath.replace(/\.md$/, ''));
    if (alreadyIn) return;
    const updated = { ...frontmatter, depends_on: [...current, relPath] };
    await saveFrontmatter(updated);
    showToast('Added to depends_on: ' + relPath.split('/').pop(), 2500);
  }

  async function handleAddBlocks(relPath: string) {
    if (!frontmatter) return;
    const current: string[] = Array.isArray(frontmatter.blocks) ? frontmatter.blocks : [];
    const norm = relPath.endsWith('.md') ? relPath : relPath + '.md';
    const alreadyIn = current.some(r => r === relPath || r === norm || r.replace(/\.md$/, '') === relPath.replace(/\.md$/, ''));
    if (alreadyIn) return;
    const updated = { ...frontmatter, blocks: [...current, relPath] };
    await saveFrontmatter(updated);
    showToast('Added to blocks: ' + relPath.split('/').pop(), 2500);
  }

  async function handleApprove(fm?: Record<string, any>) {
    if (fm) frontmatter = { ...fm };
    if (!frontmatter) return;

    // First click: scan for unlinked related proposals and surface them before approving
    if (!approvalRelatedChecked) {
      approvalRelatedChecked = true;
      const fp = filePath();
      const res = await fetch('/api/overlap?path=' + encodeURIComponent(fp));
      if (res.ok) {
        const { matches } = await res.json();
        const currentRelated: string[] = Array.isArray(frontmatter.related_to) ? frontmatter.related_to : [];
        const unlinked = (matches as Array<{ path: string }>).filter(
          m => !currentRelated.some(r => r === m.path || r.replace(/\.md$/, '') === m.path.replace(/\.md$/, ''))
        );
        if (unlinked.length > 0) {
          collationMatches.set(matches);
          collationRelationships.set([]);
          showPropsPane.set(true);
          showRelatedTab.set(true);
          showToast(
            `${unlinked.length} related proposal${unlinked.length === 1 ? '' : 's'} found — review, then click Approve again`,
            8000,
            { label: 'Approve anyway', onclick: () => handleApprove() }
          );
          return;
        }
      }
    }

    if (!frontmatter.assigned_to || String(frontmatter.assigned_to).trim() === '') {
      const who = prompt('Assign to:');
      if (who) frontmatter = { ...frontmatter, assigned_to: who };
    }
    await saveFrontmatter();
    const fp = filePath();
    const res = await fetch('/api/approve-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fp }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('Approve failed: ' + (data.error || res.statusText), 4000);
      return;
    }
    if (data.committed) {
      showToast(`✓ Approved & committed (${data.committed}) — navigating to new plan…`, 2500);
    } else {
      showToast(`✓ Approved (⚠ not committed: ${data.commitError || 'unknown'}) — commit via the git panel`, 5000);
    }
    goto('/' + data.planPath.replace(/\.md$/, '') + '?from=proposal');
  }

  function cancel() { mode = 'read'; loadFile(); }

  async function conflictKeepMine() {
    // Force overwrite — send without If-Match so the server skips OCC check.
    loadedEtag = null;
    conflictDialog = null;
    await save();
  }

  function conflictTakeTheirs() {
    const serverContent = conflictDialog!.serverContent;
    conflictDialog = null;
    raw = serverContent;
    const parsed = splitFrontmatter(serverContent);
    fmText = parsed.fmText;
    frontmatter = parsed.frontmatter ? { ...parsed.frontmatter, _path: filePath() } : null;
    content = parsed.body;
    html = md.render(content);
    // Re-load to get the fresh ETag from the server
    loadFile();
    mode = 'read';
    showToast('Reverted to server version', 3000);
  }

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

<div class="page-wrap" class:base-mode={isBase}>
  <!-- Base view — rendered directly, no toolbar/editor chrome -->
  {#if isBase}
    <BaseView path={filePath()} />
  {:else}
  <!-- Main content -->
  <div class="page-body">
    <div class="toolbar">
      <div class="doc-identity">
        {#if frontmatter?.title}
          <h1 class="doc-title">{frontmatter.title}</h1>
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
          title={mode === 'read'
            ? (wysiwygBlocked ? 'Switch to raw Markdown source (WYSIWYG is disabled on governance docs)' : 'Switch to WYSIWYG editor')
            : mode === 'edit' ? 'Switch to raw Markdown / frontmatter source' : 'Switch to read-only preview'}>
          {mode === 'read' ? (wysiwygBlocked ? '⟨/⟩ Source' : '✏ Edit') : mode === 'edit' ? '⟨/⟩ Source' : '👁 Preview'}
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
          <MarkdownRenderer {content} docPath={filePath()} />
        {:else}
          <p class="muted">Empty file</p>
        {/if}
      </div>
    {/if}
  </div>
  {/if}

</div>

{#if conflictDialog}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="dialog-overlay" role="dialog" aria-modal="true"
       onkeydown={(e) => { if (e.key === 'Escape') conflictDialog = null; }}>
    <div class="conflict-box" onclick={(e) => e.stopPropagation()}>
      <div class="dialog-header">⚠ Write conflict</div>
      <p class="conflict-hint">
        This file was changed by someone else since you opened it.
        Choose how to proceed:
      </p>
      <div class="conflict-panes">
        <div class="conflict-pane">
          <div class="conflict-pane-label">Your version</div>
          <pre class="conflict-pre">{raw}</pre>
        </div>
        <div class="conflict-pane">
          <div class="conflict-pane-label">Server version</div>
          <pre class="conflict-pre">{conflictDialog.serverContent}</pre>
        </div>
        <div class="conflict-pane">
          <div class="conflict-pane-label">Changes (yours vs server)</div>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <pre class="conflict-pre conflict-diff">{@html buildDiffHtml(raw, conflictDialog.serverContent)}</pre>
        </div>
      </div>
      <div class="dialog-actions">
        <button class="dialog-cancel" onclick={() => conflictDialog = null}>Cancel — keep editing</button>
        <button class="dialog-cancel" onclick={conflictTakeTheirs}>Take server version</button>
        <button class="dialog-submit" onclick={conflictKeepMine}>Overwrite with mine</button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../../lib/tokens' as *;

  /* page-wrap is always a flex row — Panel.svelte handles open/closed width */
  .page-wrap { display: flex; min-height: 100%; align-items: flex-start; }
  /* base views need column layout so BaseView can flex-grow to fill the slot */
  .page-wrap.base-mode { flex-direction: column; align-items: stretch; height: 100%; min-height: 0; }
  .page-body { flex: 1; min-width: 0; padding: 32px; overflow-y: auto; }

  /* Right panel tab bar */
  .right-tab-bar { display: flex; border-bottom: 1px solid $border; flex-shrink: 0; }
  .right-tab {
    flex: 1; background: none; border: none; border-bottom: 2px solid transparent;
    color: $muted; font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.4px; padding: 8px 4px 6px; cursor: pointer;
    &:hover { color: $fg-dim; }
    &.active { color: $fg; border-bottom-color: $blue; }
  }
  .right-empty { padding: 16px; font-size: 12px; color: $muted; }

  .error { color: $red; padding: 16px; background: $red-bg; border-radius: 6px; }

  .not-found { text-align: center; padding: 64px 32px; }
  .nf-icon  { font-size: 48px; color: $border; margin-bottom: 16px; }
  .nf-title { font-size: 18px; color: $muted; font-weight: 500; margin: 0 0 8px; }
  .nf-path  { font-size: 12px; color: $muted; font-family: monospace; margin: 0 0 24px; }
  .nf-actions { display: flex; gap: 10px; justify-content: center; }
  .nf-btn {
    @include act-base;
    padding: 6px 16px; font-size: 12px; text-decoration: none; display: inline-block;
    &.primary { @include act-variant($blue, $blue-bg, $blue-bdr); }
  }

  .body { line-height: 1.6; }
  .dep-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 12px; background: $bg-2; border-radius: 4px; margin-bottom: 16px; font-size: 12px; }
  .dep-label { color: $muted; font-weight: 600; }
  .dep-link { color: $blue; text-decoration: none; border: 1px solid $blue-bdr; border-radius: 10px; padding: 1px 8px; &:hover { background: $blue-bg; } }
  .muted { color: $muted; }

  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid $border; gap: 12px; }
  .doc-identity { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .doc-title { font-size: 1.4em; font-weight: 700; color: $fg; margin: 0; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .path      { font-size: 11px; color: $muted; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .path-only { font-size: 13px; color: $fg-dim; }
  .actions   { display: flex; gap: 6px; }

  .btn {
    @include act-base;
    padding: 4px 12px;
    &.save   { @include act-variant($blue,  $blue-bg,  $blue-bdr); }
    &.cancel { border-color: $muted; color: $fg-dim; }
    &.del    { @include act-variant($red,   $red-bg,   $red-bdr); }
  }
  .mode-toggle { border-color: $teal-bdr; color: $teal; &:hover { background: $teal-bg; } }

  .editor {
    width: 100%; min-height: 60vh;
    background: $bg; color: $fg;
    border: 1px solid $border; border-radius: 6px;
    padding: 16px; font-family: monospace; font-size: 13px; line-height: 1.5;
    resize: vertical; box-sizing: border-box;
  }

  .wysiwyg-toolbar {
    display: flex; gap: 2px; align-items: center; padding: 6px 8px;
    background: $bg-3; border: 1px solid $border; border-bottom: none;
    border-radius: 6px 6px 0 0; flex-wrap: wrap;
  }
  .fmt-btn {
    background: none; border: 1px solid transparent; color: $fg-dim;
    padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 13px; height: 26px;
    &:hover { background: $bg-hover; border-color: $border; }
  }
  .sep { width: 1px; height: 18px; background: $border; margin: 0 4px; }

  .wysiwyg {
    width: 100%; min-height: 60vh;
    background: $bg; color: $fg;
    border: 1px solid $border; border-radius: 0 0 6px 6px;
    padding: 16px; font-size: 15px; line-height: 1.6; outline: none; box-sizing: border-box;
    &:focus { border-color: $blue-bdr; }
    :global(h1) { font-size: 1.8em; margin: 0.5em 0; color: $fg; }
    :global(h2) { font-size: 1.4em; margin: 0.5em 0; color: $fg; }
    :global(h3) { font-size: 1.2em; margin: 0.5em 0; color: $fg-dim; }
    :global(p)  { margin: 0.5em 0; }
    :global(code) { background: $bg-2; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px; }
    :global(pre) { background: $bg; padding: 12px; border-radius: 6px; overflow-x: auto; }
    :global(pre code) { background: none; padding: 0; }
  }

  /* ── Mobile (≤ 768px) ───────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .page-wrap { display: block; padding: 0; }
    .page-body { padding: 16px; }
    .toolbar { flex-wrap: wrap; gap: 4px; }
    .path { display: none; }
    .doc-title { font-size: 1.1em; }
    .btn { min-height: 44px; padding: 8px 14px; font-size: 13px; }
    .fmt-btn { min-height: 44px; padding: 0 10px; }
    .conflict-panes { flex-direction: column; }
    .conflict-pane { max-height: 200px; }
  }

  /* ── Conflict dialog ───────────────────────────────────────────────────── */
  .dialog-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center;
  }
  .conflict-box {
    background: #1e1e2e; border: 1px solid #3a3a5c;
    border-radius: 10px; padding: 1.25rem 1.5rem;
    width: min(900px, 95vw); display: flex; flex-direction: column; gap: 0.75rem;
    max-height: 90vh; overflow-y: auto;
  }
  .dialog-header { font-size: 15px; font-weight: 700; color: #e0e0f0; }
  .conflict-hint { font-size: 0.85rem; color: #a6adc8; margin: 0; }
  .conflict-panes { display: flex; gap: 0.75rem; min-height: 0; }
  .conflict-pane { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
  .conflict-pane-label { font-size: 0.75rem; font-weight: 600; color: #a6adc8; text-transform: uppercase; letter-spacing: 0.05em; }
  .conflict-pre {
    flex: 1; background: #181825; border: 1px solid #313244;
    border-radius: 6px; padding: 0.75rem; font-size: 0.75rem;
    overflow: auto; max-height: 320px; white-space: pre-wrap; word-break: break-all;
    color: #cdd6f4; margin: 0;
  }
  .conflict-diff :global(ins) {
    background: rgba(166, 227, 161, 0.25); color: #a6e3a1;
    text-decoration: none; border-radius: 2px;
  }
  .conflict-diff :global(del) {
    background: rgba(243, 139, 168, 0.25); color: #f38ba8;
    text-decoration: line-through; border-radius: 2px;
  }
  .dialog-actions { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; }
  .dialog-cancel {
    padding: 0.4rem 0.9rem; border-radius: 5px; font-size: 0.85rem; cursor: pointer;
    background: #313244; color: #cdd6f4; border: 1px solid #45475a;
  }
  .dialog-cancel:hover { background: #45475a; }
  .dialog-submit {
    padding: 0.4rem 0.9rem; border-radius: 5px; font-size: 0.85rem; cursor: pointer;
    background: #f38ba8; color: #1e1e2e; border: none; font-weight: 600;
  }
  .dialog-submit:hover { filter: brightness(1.1); }
</style>
