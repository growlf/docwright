<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import FileTree from './FileTree.svelte';
  import GitPanel from '$lib/GitPanel.svelte';
  import { page } from '$app/stores';
  import { fileChanged } from '$lib/fileChanges';
  import { toasts, dismissToast, showToast } from '$lib/toast';
import type { ImprovePhase } from '$lib/pane';
import {
  showPropsPane, showChatPanel, showMultiReview, showRelatedTab, collationMatches, collationRelationships, collationLoading, featureFlags, planReviewFindings, planReviewLoading, planReviewStatus, planReviewImproved, planReviewChanges, improveResult, improveLoading, improvePhase, improveStatus, showImproveTab, showReviewTab, aiBackend, triggerImprovePending
} from '$lib/pane';
  import ChatPanel from '$lib/ChatPanel.svelte';
  import MultiReviewPanel from '$lib/MultiReviewPanel.svelte';
  import Panel from '$lib/Panel.svelte';
  import PropertiesPane from '$lib/PropertiesPane.svelte';
  import CollationPanel from '$lib/CollationPanel.svelte';
  import PlanReviewPanel from '$lib/PlanReviewPanel.svelte';
  import ImprovementPanel from '$lib/ImprovementPanel.svelte';
  import SearchPanel from '$lib/SearchPanel.svelte';
  import PoliciesPanel from '$lib/PoliciesPanel.svelte';
  import TagsPanel from '$lib/TagsPanel.svelte';
  import { currentDoc } from '$lib/currentDoc';

  interface ProjectEntry {
    name: string;
    path: string;
    profile: string;
    last_session?: string;
  }

  interface BrandConfig { name: string; logoPath: string | null; }

  let projects     = $state<ProjectEntry[]>([]);
  let brand        = $state<BrandConfig>({ name: 'DocWright', logoPath: null });
  let showNewMenu  = $state(false);
  const mobile = () => typeof window !== 'undefined' && window.innerWidth <= 768;
  let showSidebar    = $state(!mobile());
  let leftView       = $state<'files' | 'search' | 'policies' | 'tags' | 'settings' | 'git'>('files');
  type Theme = 'dark' | 'light' | 'system';
  const THEMES: Theme[] = ['dark', 'light', 'system'];
  const THEME_ICONS: Record<Theme, string> = { dark: '🌙', light: '☀️', system: '💻' };
  let theme = $state<Theme>('dark');

  function applyTheme(t: Theme) {
    theme = t;
    if (typeof localStorage !== 'undefined') localStorage.setItem('dw-theme', t);
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
  }
  function cycleTheme() { applyTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]); }
  let searchPanel: SearchPanel;
  let showRightPanel = $state(!mobile());
  let rightTab     = $state<'properties' | 'related' | 'review' | 'improve'>('properties');

  // Subscribe to shared collation stores
  let cm = $state<any[]>([]); $effect(() => { const u = collationMatches.subscribe(v => cm = v); return u; });
  let cr = $state<any[]>([]); $effect(() => { const u = collationRelationships.subscribe(v => cr = v); return u; });
  let cl = $state(false);     $effect(() => { const u = collationLoading.subscribe(v => cl = v); return u; });
  let prf = $state('');       $effect(() => { const u = planReviewFindings.subscribe(v => prf = v); return u; });
  let prl = $state(false);    $effect(() => { const u = planReviewLoading.subscribe(v => prl = v); return u; });
  let prs = $state('');       $effect(() => { const u = planReviewStatus.subscribe(v => prs = v); return u; });
  let pri = $state('');       $effect(() => { const u = planReviewImproved.subscribe(v => pri = v); return u; });
  let prc = $state('');       $effect(() => { const u = planReviewChanges.subscribe(v => prc = v); return u; });
  let ir  = $state<{ improved: string; critique: string } | null>(null);
                              $effect(() => { const u = improveResult.subscribe(v => ir = v); return u; });
  let il  = $state(false);    $effect(() => { const u = improveLoading.subscribe(v => il = v); return u; });
  let ip  = $state<ImprovePhase>('improve-thinking');
                              $effect(() => { const u = improvePhase.subscribe(v => ip = v); return u; });
  let ist = $state('');       $effect(() => { const u = improveStatus.subscribe(v => ist = v); return u; });
  let aib = $state<'opencode' | 'ollama'>('opencode');
                              $effect(() => { const u = aiBackend.subscribe(v => aib = v); return u; });

  // Auto-improve signal from page (e.g. ?from=proposal on new plan load)
  $effect(() => {
    const u = triggerImprovePending.subscribe(v => {
      if (v) { triggerImprovePending.set(false); handleImprove(); }
    });
    return u;
  });

  // Fetch profile feature flags on mount
  onMount(async () => {
    try {
      const res = await fetch('/api/profile-config');
      if (res.ok) {
        const cfg = await res.json();
        const rel = cfg.relationshipEngine ?? {};
        featureFlags.set({
          showPlanButton: rel.show_plan_button !== false,
          autoDetectOnCreate: rel.auto_detect_on_create !== false,
          autoDetectOnUpdate: rel.auto_detect_on_update !== false,
          similarityThreshold: rel.similarity_threshold ?? 0.35,
        });
      }
    } catch { /* use defaults */ }
  });

  // On nav: clear stale collation data; honour active tab
  $effect(() => {
    const fp = $currentDoc.filePath;
    collationMatches.set([]);
    collationRelationships.set([]);
    collationLoading.set(false);
    planReviewFindings.set('');
    planReviewLoading.set(false);
    planReviewStatus.set('');
    planReviewImproved.set('');
    planReviewChanges.set('');
    improveResult.set(null);
    improveLoading.set(false);
    improvePhase.set('improve-thinking');
    improveStatus.set('');
    // untrack: rightTab reads/writes must not become effect dependencies —
    // otherwise setting rightTab='review' in handleReview() would re-trigger
    // this effect and immediately reset it back to 'properties'.
    untrack(() => {
      if (rightTab === 'related' && fp) findRelated(fp);
      if (rightTab === 'review') rightTab = 'properties';
      if (rightTab === 'improve') rightTab = 'properties';
    });
  });

  // React to page's signal to switch to Related tab
  $effect(() => {
    const trigger = $showRelatedTab;
    if (trigger) {
      rightTab = 'related';
      showRightPanel = true;
      showRelatedTab.set(false);
      if ($currentDoc.filePath) findRelated($currentDoc.filePath);
    }
  });

  async function findRelated(filePath: string) {
    if (!filePath) return;
    rightTab = 'related';
    showRightPanel = true;
    collationLoading.set(true);
    collationMatches.set([]);
    collationRelationships.set([]);
    const res = await fetch('/api/overlap?path=' + encodeURIComponent(filePath));
    collationLoading.set(false);
    if (res.ok) {
      const data = await res.json();
      collationMatches.set(data.matches || []);
      collationRelationships.set(data.relationships || []);
    }
  }

  async function handleCreatePlan() {
    const fp = $currentDoc.filePath;
    if (!fp) return;
    const fm = $currentDoc.frontmatter;
    if (!fm) return;
    const res = await fetch('/api/create-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Plan: ' + (fm.title || fp),
        candidates: [fp.replace(/\.md$/, '')],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      goto('/' + data.path.replace(/\.md$/, '') + '?from=proposal');
      collationMatches.set([]);
      collationRelationships.set([]);
    } else if (res.status === 409) {
      const data = await res.json();
      if (data.path) {
        showToast('Plan already exists — opening it', 3000);
        goto('/' + data.path.replace(/\.md$/, ''));
        collationMatches.set([]);
        collationRelationships.set([]);
      }
    }
  }

  async function handleReview() {
    const fp = $currentDoc.filePath;
    if (!fp) return;
    rightTab = 'review';
    showRightPanel = true;
    planReviewFindings.set('');
    planReviewStatus.set('');
    planReviewImproved.set('');
    planReviewChanges.set('');
    planReviewLoading.set(true);
    try {
      const res = await fetch('/api/plan-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fp, backend: aib }),
      });
      const reader = res.body?.getReader();
      if (!reader) { planReviewFindings.set('No response stream'); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find(l => l.startsWith('event: '));
          const dataLine = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const event = eventLine ? eventLine.slice(7).trim() : '';
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (event === 'token') {
              accumulated += data.text;
              planReviewFindings.set(accumulated);
            } else if (event === 'status') {
              planReviewStatus.set(data.message);
            } else if (event === 'done') {
              planReviewChanges.set(data.changes || '');
              planReviewImproved.set(data.improved_body || '');
              planReviewFindings.set(data.findings || accumulated);
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } catch (e: any) {
      planReviewFindings.set(`Error: ${e}`);
    } finally {
      planReviewLoading.set(false);
      planReviewStatus.set('');
    }
  }

  async function handleAcceptReview(improved: string) {
    const fp = $currentDoc.filePath;
    if (!fp || !improved) return;
    const fm = $currentDoc.frontmatter ?? {};
    const fmLines = Object.entries(fm)
      .filter(([k]) => k !== '_path')
      .map(([k, v]) => {
        if (Array.isArray(v)) return v.length ? `${k}:\n${v.map(i => `  - ${i}`).join('\n')}` : `${k}: []`;
        if (typeof v === 'boolean') return `${k}: ${v}`;
        if (v === null || v === undefined || v === '') return `${k}:`;
        return `${k}: ${v}`;
      }).join('\n');
    const newRaw = `---\n${fmLines}\n---\n${improved}`;
    const res = await fetch('/api/write?path=' + encodeURIComponent(fp), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newRaw }),
    });
    if (res.ok) {
      showToast('Plan updated with AI improvements', 3000);
      rightTab = 'properties';
      planReviewFindings.set('');
      planReviewStatus.set('');
      planReviewChanges.set('');
      planReviewImproved.set('');
    }
  }

  // React to signal to switch to Review tab
  $effect(() => {
    if ($showReviewTab) {
      rightTab = 'review';
      showRightPanel = true;
      showReviewTab.set(false);
      handleReview();
    }
  });

  // React to on-save trigger from page signalling to open Improve tab
  $effect(() => {
    if ($showImproveTab) {
      rightTab = 'improve';
      showRightPanel = true;
      showImproveTab.set(false);
    }
  });

  async function handleImprove() {
    const fp = $currentDoc.filePath;
    if (!fp) return;
    rightTab = 'improve';
    showRightPanel = true;
    improveResult.set(null);
    improveLoading.set(true);
    improvePhase.set('improve-thinking');
    improveStatus.set('');
    showToast('Improving proposal — AI may take up to a minute…', 8000);
    try {
      const res = await fetch('/api/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fp, backend: aib }),
      });
      const reader = res.body?.getReader();
      if (!reader) { showToast('No response stream', 4000); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let improvedAccum = '';
      let critiqueAccum = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find(l => l.startsWith('event: '));
          const dataLine = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const event = eventLine ? eventLine.slice(7).trim() : '';
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (event === 'token') {
              if (data.phase === 'critique') {
                critiqueAccum += data.text;
              } else {
                improvedAccum += data.text;
              }
              improveResult.set({ improved: improvedAccum, critique: critiqueAccum });
            } else if (event === 'stage') {
              improvePhase.set(data.phase);
              improveStatus.set('');
            } else if (event === 'status') {
              improveStatus.set(data.message);
            } else if (event === 'done') {
              improveResult.set({
                improved: data.improved || improvedAccum,
                critique: data.critique || critiqueAccum,
              });
              improvePhase.set('done');
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } catch (e: any) {
      showToast(`Improve error: ${e}`, 4000);
      rightTab = 'properties';
    } finally {
      improveLoading.set(false);
    }
  }

  /** Append a "## Document History" entry to a markdown body. */
  function appendDocHistory(body: string, change: string, author: string): string {
    const now = new Date().toISOString().slice(0, 10);
    const row = `| ${now} | ${change} | ${author} |\n`;
    const histMatch = body.match(/^## Document History\s*$/m);
    if (histMatch) {
      // Table exists — find the separator line and insert after it
      const before = body.slice(0, histMatch.index!);
      const after = body.slice(histMatch.index!);
      const sepMatch = after.match(/^\|[-| ]+\|\n/m);
      if (sepMatch) {
        const insertAt = histMatch.index! + sepMatch.index! + sepMatch[0].length;
        return body.slice(0, insertAt) + row + body.slice(insertAt);
      }
      // No separator found — append table after heading
      return body + `\n| Date | Change | Author |\n|------|--------|--------|\n${row}`;
    }
    // No Document History at all — append section
    return `${body}\n\n## Document History\n\n| Date | Change | Author |\n|------|--------|--------|\n${row}`;
  }

  async function handleAcceptImprove(improved: string) {
    const fp = $currentDoc.filePath;
    if (!fp || !improved) return;
    // Resolve author for Document History
    let author = 'DocWright Improve';
    try {
      const idRes = await fetch('/api/git/config?key=user.name');
      if (idRes.ok) { const v = await idRes.json(); if (v.value) author = v.value; }
    } catch {}
    // Append Document History entry
    const bodyWithHistory = appendDocHistory(improved, 'AI-improved via Improve', author);
    // Rebuild file: original frontmatter + improved body (with history)
    const fm = $currentDoc.frontmatter ?? {};
    const fmLines = Object.entries(fm)
      .filter(([k]) => k !== '_path')
      .map(([k, v]) => {
        if (Array.isArray(v)) return v.length ? `${k}:\n${v.map(i => `  - ${i}`).join('\n')}` : `${k}: []`;
        if (typeof v === 'boolean') return `${k}: ${v}`;
        if (v === null || v === undefined || v === '') return `${k}:`;
        return `${k}: ${v}`;
      }).join('\n');
    const newRaw = `---\n${fmLines}\n---\n${bodyWithHistory}`;
    const res = await fetch('/api/write?path=' + encodeURIComponent(fp), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newRaw }),
    });
    if (res.ok) {
      showToast('Proposal updated with AI suggestions', 3000);
      rightTab = 'properties';
      improveResult.set(null);
    }
  }

  // Close sidebar on navigation (mobile only)
  $effect(() => {
    $page.url;
    if (mobile()) { showSidebar = false; showRightPanel = false; }
  });

  function toggleSidebar() { showSidebar = !showSidebar; }
  function closeMenus() { showNewMenu = false; }

  function newFile() {
    showNewMenu = false;
    let name = prompt('New file path (e.g. docs/my-doc.md):');
    if (!name) return;
    if (!name.endsWith('.md')) name += '.md';
    fetch('/api/write?path=' + encodeURIComponent(name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '# ' + name.replace(/\.md$/, '') + '\n\n' }),
    }).then(r => {
      if (r.ok) goto('/' + name.replace(/\.md$/, ''));
    });
  }

  function newProposal() {
    showNewMenu = false;
    let title = prompt('Proposal title:');
    if (!title) return;
    const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.md';
    const date = new Date().toISOString().slice(0, 10);
    const user = 'NetYeti';
    const host = 'phoenix';
    const content = '---\n' +
      `title: "${title}"\n` +
      `author: ${user}\n` +
      `created: ${date}\n` +
      'tags: []\n' +
      'category: []\n' +
      'complexity: ""\n' +
      'estimated_effort: ""\n' +
      'depends_on: []\n' +
      `approved: false\n` +
      `created_by: "${user}@${host}"\n` +
      'assigned_to: ""\n' +
      '---\n' +
      '\n## Problem\n\n' +
      '\n## Proposed Solution\n\n';
    fetch('/api/write?path=proposals/' + slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(r => {
      if (r.ok) goto('/proposals/' + slug.replace(/\.md$/, '') + '?new=1');
    });
  }

  function newResearch() {
    showNewMenu = false;
    let title = prompt('Research title:');
    if (!title) return;
    let question = prompt('Research question (one sentence):');
    if (!question) return;
    const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.md';
    const date = new Date().toISOString().slice(0, 10);
    const content =
      '---\n' +
      `title: "${title}"\n` +
      'status: active\n' +
      `question: "${question}"\n` +
      'conclusion: open\n' +
      'author: NetYeti\n' +
      `created: ${date}\n` +
      'author-role: contributor\n' +
      'tags: []\n' +
      'linked_proposals: []\n' +
      'related_research: []\n' +
      '---\n\n' +
      `# ${title}\n\n` +
      '## Questions Explored\n\n' +
      `- ${question}\n\n` +
      '## Approaches Compared\n\n' +
      '| Approach | Pros | Cons |\n' +
      '|----------|------|------|\n' +
      '| Option A | | |\n' +
      '| Option B | | |\n\n' +
      '## Findings\n\n\n\n' +
      '## Sources\n\n- \n\n' +
      '## Conclusion\n\n' +
      '> Update `status: concluded` and set `conclusion:` when done.\n';
    fetch('/api/write?path=research/' + slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(r => {
      if (r.ok) goto('/research/' + slug.replace(/\.md$/, '') + '?new=1');
    });
  }

  function loadProjects() {
    fetch('/api/registry')
      .then(r => r.json())
      .then(data => { projects = data.projects || []; })
      .catch(() => { projects = []; });
  }

  function loadBrand() {
    fetch('/api/brand')
      .then(r => r.json())
      .then(data => { brand = data; })
      .catch(() => {});
  }

  onMount(() => {
    loadBrand();
    loadProjects();
    const es = new EventSource('/api/watch');
    es.addEventListener('filechange', (e: MessageEvent) => {
      fileChanged.set(JSON.parse(e.data));
    });

    function handleGlobalKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const editing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        leftView = 'search';
        showSidebar = true;
        setTimeout(() => searchPanel?.focusSearch(), 50);
      } else if (e.ctrlKey && !e.shiftKey && e.key === '\\') {
        e.preventDefault();
        showSidebar = !showSidebar;
      } else if (e.ctrlKey && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        showRightPanel = !showRightPanel;
      } else if (e.key === 'Escape' && !editing) {
        if (leftView === 'search') { leftView = 'files'; }
      }
    }
    document.addEventListener('keydown', handleGlobalKey);

    // Restore persisted theme
    const saved = localStorage.getItem('dw-theme') as Theme | null;
    if (saved && THEMES.includes(saved)) applyTheme(saved);

    return () => document.removeEventListener('keydown', handleGlobalKey);
  });
</script>

<!-- Always-visible toolbar — all viewports -->
<div class="app-toolbar">
  <!-- Left: sidebar toggle -->
  <div class="toolbar-left">
    <button class="hamburger" onclick={toggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar">☰</button>
  </div>

  <!-- Center: brand — acts as home button -->
  <a href="/status" class="toolbar-brand" title="Home — {brand.name} status">
    {#if brand.logoPath}
      <img class="brand-logo" src="/api/brand/logo" alt={brand.name}
        onerror={(e) => { (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden'); }} />
      <span class="brand-name" hidden>{brand.name}</span>
    {:else}
      <span class="brand-name">{brand.name}</span>
    {/if}
  </a>

  <!-- Right: new + properties toggle -->
  <div class="toolbar-right">
    <div class="new-group">
      <button class="new-btn" onclick={(e) => { e.stopPropagation(); showNewMenu = !showNewMenu; }}>+ New</button>
      {#if showNewMenu}
        <div class="new-menu" onclick={(e) => e.stopPropagation()}>
          <button class="new-menu-item" onclick={newFile}>New File</button>
          <button class="new-menu-item" onclick={newProposal}>New Proposal</button>
          <button class="new-menu-item" onclick={newResearch}>New Research</button>
        </div>
      {/if}
    </div>
    <button class="gear-btn" onclick={() => { showRightPanel = !showRightPanel; }} aria-label="Toggle properties panel" title="Toggle properties">⊞</button>
  </div>
</div>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div id="app" onclick={closeMenus}>

  <!-- Activity bar — switches left panel content -->
  <div class="activity-bar">
    <button class="act-btn" class:active={leftView === 'files'}
      onclick={() => { leftView = 'files'; showSidebar = true; }}
      title="Files">📄</button>
    <button class="act-btn" class:active={leftView === 'search'}
      onclick={() => { leftView = 'search'; showSidebar = true; setTimeout(() => searchPanel?.focusSearch(), 50); }}
      title="Search (Ctrl+K)">🔍</button>
    <button class="act-btn" class:active={leftView === 'policies'}
      onclick={() => { leftView = 'policies'; showSidebar = true; }}
      title="Policies">📋</button>
    <button class="act-btn" class:active={leftView === 'tags'}
      onclick={() => { leftView = 'tags'; showSidebar = true; }}
      title="Tags">🏷</button>
    <button class="act-btn" class:active={leftView === 'settings'}
      onclick={() => { leftView = 'settings'; showSidebar = true; }}
      title="Settings">⚙</button>
    <button class="act-btn" class:active={leftView === 'git'}
      onclick={() => { leftView = 'git'; showSidebar = true; }}
      title="Git">⎇</button>
  </div>

  <Panel side="left" bind:open={showSidebar}>
    <div class="sidebar-header">
      <span class="sidebar-view-label">
        {leftView === 'files' ? 'Files' : leftView === 'search' ? 'Search' : leftView === 'policies' ? 'Policies' : leftView === 'tags' ? 'Tags' : leftView === 'settings' ? 'Settings' : 'Git'}
      </span>
      {#if leftView === 'files'}
      <div class="new-group-inner">
        <button class="new-btn-sm" onclick={(e) => { e.stopPropagation(); showNewMenu = !showNewMenu; }} title="New document">+</button>
        {#if showNewMenu}
          <div class="new-menu" onclick={(e) => e.stopPropagation()}>
            <button class="new-menu-item" onclick={newFile}>New File</button>
            <button class="new-menu-item" onclick={newProposal}>New Proposal</button>
          </div>
        {/if}
      </div>
      {/if}
    </div>
    {#if leftView === 'search'}
      <SearchPanel bind:this={searchPanel} />
    {:else if leftView === 'policies'}
      <PoliciesPanel />
    {:else if leftView === 'tags'}
      <TagsPanel />
    {:else if leftView === 'files'}
      <FileTree currentPath={$page.url.pathname} />
      {#if projects.length > 0}
        <div class="project-section">
          <div class="project-heading">Projects</div>
          {#each projects as p}
            <a class="project-link" href={p.path}>
              <span class="project-name">{p.name}</span>
              <span class="project-profile">{p.profile}</span>
            </a>
          {/each}
        </div>
      {/if}

    {:else if leftView === 'settings'}
      <div class="settings-view">
        <div class="settings-group">
          <div class="settings-group-label">AI Instructions</div>
          <a class="settings-file" href="/CLAUDE">CLAUDE.md</a>
          <a class="settings-file" href="/AGENTS">AGENTS.md</a>
        </div>
        <div class="settings-group">
          <div class="settings-group-label">Templates</div>
          <a class="settings-file" href="/templates/proposal-template">proposal-template.md</a>
          <a class="settings-file" href="/templates/plan-template">plan-template.md</a>
          <a class="settings-file" href="/templates/research-template">research-template.md</a>
        </div>
        <div class="settings-group">
          <div class="settings-group-label">Project</div>
          <a class="settings-file" href="/CONTRIBUTING">CONTRIBUTING.md</a>
          <a class="settings-file" href="/SECURITY">SECURITY.md</a>
          <a class="settings-file" href="/CHANGELOG">CHANGELOG.md</a>
          <a class="settings-file" href="/NOTICE">NOTICE.md</a>
        </div>
        <div class="settings-group">
          <div class="settings-group-label">Brand</div>
          <a class="settings-file" href="/brand.json">brand.json</a>
          <a class="settings-file" href="/brand/theme.css">brand/theme.css</a>
        </div>
        <div class="settings-hint">
          Edit these files to customise DocWright.<br>
          See <a href="/docs/customization">docs/customization.md</a> for details.
        </div>
      </div>

    {:else}
      <GitPanel />
    {/if}
  </Panel>
  <!-- Main content + chat at bottom -->
  <main id="content">
    <div id="page-slot">
      <slot />
    </div>
    <!-- AI chat — springs up from bottom of main pane -->
    {#if $showChatPanel}
      <div id="chat-bottom" class:expanded={$showChatPanel}>
        {#if $showMultiReview}
          <MultiReviewPanel />
        {:else}
          <ChatPanel />
        {/if}
      </div>
    {/if}
  </main>

  <!-- Right sidebar — full height, always present -->
  <Panel side="right" bind:open={showRightPanel}>
    <div class="right-tab-bar">
      <button class="right-tab" class:active={rightTab === 'properties'}
        onclick={() => rightTab = 'properties'}>Properties</button>
      <button class="right-tab" class:active={rightTab === 'related'}
        onclick={() => { rightTab = 'related'; if (!collationMatches.length && $currentDoc.filePath) findRelated($currentDoc.filePath); }}>
        Related{collationMatches.length > 0 ? ` (${collationMatches.length})` : ''}
      </button>
      {#if $currentDoc.docType === 'plan'}
        <button class="right-tab" class:active={rightTab === 'review'}
          onclick={() => showReviewTab.set(true)}>
          Review{prl ? ' ⏳' : pri ? ' ✓' : ''}
        </button>
      {/if}
      {#if $currentDoc.docType === 'proposal'}
        <button class="right-tab" class:active={rightTab === 'improve'}
          onclick={handleImprove}>
          Improve{il ? ' ⏳' : ir ? ' ✓' : ''}
        </button>
      {/if}
    </div>

    {#if rightTab === 'properties'}
      {#key $currentDoc.filePath}
        {#if $currentDoc.frontmatter}
          <PropertiesPane
            bind:frontmatter={$currentDoc.frontmatter}
            body={$currentDoc.body}
            docType={$currentDoc.docType}
            mode={$currentDoc.mode}
            onsave={$currentDoc.onSave}
            onapprove={$currentDoc.onApprove}
            onfindrelated={() => { rightTab = 'related'; findRelated($currentDoc.filePath); }}
            onplan={() => { showToast('Scanning for related proposals…', 3000); rightTab = 'related'; findRelated($currentDoc.filePath); }}
            onimprove={handleImprove}
          />
        {:else}
          <div class="right-empty">Open a document to see its properties</div>
        {/if}
      {/key}
    {:else if rightTab === 'improve'}
      <ImprovementPanel
        improved={ir?.improved ?? ''}
        critique={ir?.critique ?? ''}
        loading={il}
        phase={ip}
        status={ist}
        onaccept={handleAcceptImprove}
        ondismiss={() => { rightTab = 'properties'; improveResult.set(null); }}
        onrerun={handleImprove}
      />
    {:else if rightTab === 'review'}
      <PlanReviewPanel
        findings={prf}
        status={prs}
        changes={prc}
        improved={pri}
        loading={prl}
        onaccept={handleAcceptReview}
        ondismiss={() => { rightTab = 'properties'; planReviewFindings.set(''); planReviewStatus.set(''); planReviewChanges.set(''); planReviewImproved.set(''); }}
        onrerun={handleReview}
      />
    {:else}
      <CollationPanel
        matches={cm}
        relationships={cr}
        loading={cl}
        planMode={$currentDoc.docType === 'proposal' && $currentDoc.frontmatter?.approved === true}
        alreadyRelated={Array.isArray($currentDoc.frontmatter?.related_to) ? $currentDoc.frontmatter.related_to : []}
        onaddrelated={(path) => $currentDoc.onAddRelated?.(path)}
        onadddepends={(path) => $currentDoc.onAddDepends?.(path)}
        onaddblocks={(path) => $currentDoc.onAddBlocks?.(path)}
        onsubsume={(path) => $currentDoc.onSubsume?.(path)}
        oncreateplan={() => handleCreatePlan()}
        onrecheck={() => { if ($currentDoc.filePath) findRelated($currentDoc.filePath); }}
        onclose={() => { rightTab = 'properties'; collationMatches.set([]); collationRelationships.set([]); }}
      />
    {/if}
  </Panel>

  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div class="toast">
        <span class="toast-msg">{toast.message}</span>
        {#if toast.action}
          <button class="toast-action" onclick={() => { toast.action!.onclick(); dismissToast(toast.id); }}>{toast.action.label}</button>
        {/if}
        <button class="toast-close" onclick={() => dismissToast(toast.id)}>✕</button>
      </div>
    {/each}
  </div>
</div>

<!-- Chat toggle button — bottom of viewport, above footer -->
<button
  class="chat-toggle"
  class:active={$showChatPanel}
  onclick={() => showChatPanel.update(v => !v)}
  title={$showChatPanel ? 'Close AI chat' : 'Open AI chat (⚡)'}
>
  {$showChatPanel ? '✕ Chat' : '⚡ Chat'}
</button>

<footer class="app-footer">
  <a href="https://github.com/growlf/docwright" target="_blank" rel="noopener" class="footer-link">
    DocWright
  </a>
  <span class="footer-sep">·</span>
  <span>MIT License</span>
  <span class="footer-sep">·</span>
  <a href="https://github.com/growlf/docwright" target="_blank" rel="noopener" class="footer-link">
    github.com/growlf/docwright
  </a>
  <span class="footer-spacer"></span>
  <button class="theme-btn" onclick={cycleTheme}
    title="Theme: {theme} · Click to cycle (dark → light → system)">
    {THEME_ICONS[theme]} {theme}
  </button>
</footer>

<style>
  /* old mobile-topbar removed — replaced by app-toolbar (always visible) */
  /* ── Always-visible toolbar ─────────────────────────────────────────────── */
  .app-toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 44px;
    padding: 0 10px;
    background: #0f0f12;
    border-bottom: 1px solid #1e2030;
    flex-shrink: 0;
    z-index: 100;
  }
  .toolbar-left  { display: flex; align-items: center; gap: 4px; justify-content: flex-start; }
  .toolbar-right { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
  .toolbar-brand {
    display: flex; align-items: center; justify-content: center;
    text-decoration: none; padding: 4px 8px; border-radius: 4px;
  }
  .toolbar-brand:hover { background: #1a1a2a; }
  .hamburger { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 3px; }
  .hamburger:hover { color: #aaa; background: #1a1a1a; }
  .home-btn { color: #666; font-size: 16px; text-decoration: none; padding: 4px 6px; border-radius: 3px; }
  .home-btn:hover { color: #aaa; background: #1a1a1a; }
  .gear-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 3px; }
  .gear-btn:hover { color: #aaa; background: #1a1a1a; }

  /* ── Activity bar ────────────────────────────────────────────────────────── */
  .activity-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 40px;
    background: #0a0a0d;
    border-right: 1px solid #1e2030;
    flex-shrink: 0;
    padding-top: 4px;
    gap: 2px;
  }
  .act-btn {
    width: 36px; height: 36px;
    background: none; border: none;
    color: #444; cursor: pointer;
    font-size: 16px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
  }
  .act-btn:hover  { color: #aaa; background: #1a1a1a; }
  .act-btn.active { color: #ccc; background: #1a1a2a; border-left: 2px solid #58a6ff; border-radius: 0 4px 4px 0; }

  /* ── Core layout ────────────────────────────────────────────────────────── */
  #app { display: flex; flex: 1; min-height: 0; font-family: system-ui, -apple-system, sans-serif; }
  .sidebar-header { padding: 8px 12px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; gap: 4px; flex-shrink: 0; min-height: 36px; }
  .sidebar-view-label { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; flex: 1; }
  .new-btn-sm { background: none; border: 1px solid #444; color: #aaa; width: 20px; height: 20px; border-radius: 3px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
  .new-btn-sm:hover { background: #222; color: #fff; }
  .new-group-inner { position: relative; }

  /* ── Settings view ───────────────────────────────────────────────────────── */
  .settings-view { padding: 8px 0; flex: 1; overflow-y: auto; }
  .settings-group { margin-bottom: 16px; }
  .settings-group-label { font-size: 10px; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 16px 2px; }
  .settings-file { display: block; padding: 4px 16px; font-size: 12px; color: #888; text-decoration: none; font-family: monospace; }
  .settings-file:hover { background: #1a1a1a; color: #58a6ff; }
  .settings-hint { padding: 12px 16px; font-size: 11px; color: #444; line-height: 1.5; border-top: 1px solid #1a1a1a; margin-top: 8px; }
  .settings-hint a { color: #58a6ff; text-decoration: none; }
  .settings-hint a:hover { text-decoration: underline; }

  .brand-name { font-size: 13px; font-weight: 600; color: #58a6ff; white-space: nowrap; letter-spacing: 0.02em; }
  .toolbar-brand:hover .brand-name { color: #88c4ff; }
  .brand-logo { height: 22px; width: auto; max-width: 140px; display: block; }
  .toolbar-brand:hover .brand-logo { opacity: 0.8; }

  .app-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 10px;
    color: #333;
    border-top: 1px solid #1a1a1a;
    background: #0d0d0d;
    flex-shrink: 0;   /* never compress — always full height */
    z-index: 50;
  }
  .footer-link { color: #333; text-decoration: none; }
  .footer-link:hover { color: #666; }
  .footer-sep { color: #222; }

  /* chat-fab replaced by chat-toggle (see above) */
  /* sidebar-toggle removed — Panel.svelte provides the edge toggle */
  .new-group { position: relative; flex-shrink: 0; }
  .new-btn { background: none; border: 1px solid #444; color: #aaa; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .new-btn:hover { background: #222; color: #fff; }
  .new-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; z-index: 1000; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
  .new-menu-item { display: block; width: 100%; background: none; border: none; color: #ccc; padding: 6px 16px; font-size: 13px; text-align: left; cursor: pointer; }
  .new-menu-item:hover { background: #2b5b84; color: #fff; }
  #content { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--bg, #1a1a1a); color: var(--fg, #e0e0e0); overflow: hidden; }
  #page-slot { flex: 1; overflow-y: auto; scroll-behavior: smooth; }
  #chat-bottom { flex-shrink: 0; height: 420px; border-top: 1px solid #2a2a2a; position: relative; }
  #chat-bottom :global(.chat-panel) { position: absolute; inset: 0; height: 100% !important; bottom: 0 !important; }

  /* Right sidebar tab bar */
  .right-tab-bar { display: flex; border-bottom: 1px solid #1e1e1e; flex-shrink: 0; }
  .right-tab { flex: 1; background: none; border: none; border-bottom: 2px solid transparent; color: #555; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 4px 6px; cursor: pointer; }
  .right-tab:hover  { color: #aaa; }
  .right-tab.active { color: #ccc; border-bottom-color: #58a6ff; }
  .right-empty { padding: 16px; font-size: 12px; color: #444; text-align: center; margin-top: 32px; }

  /* Chat toggle — replaces FAB, sits at bottom of viewport above footer */
  .chat-toggle {
    position: fixed;
    bottom: 44px;
    left: 50%;
    transform: translateX(-50%);
    padding: 5px 18px;
    background: #1a2f4a;
    border: 1px solid #2b5b84;
    border-radius: 16px;
    color: #58a6ff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    z-index: 350;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    transition: background 0.15s;
  }
  .chat-toggle:hover  { background: #1e4a70; }
  .chat-toggle.active { background: #2b5b84; }
  .toast-container { position: fixed; bottom: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 10000; }
  .toast { display: flex; align-items: center; gap: 8px; background: var(--bg-2, #222); border: 1px solid var(--border, #444); border-radius: 6px; padding: 10px 14px; font-size: 13px; color: var(--fg, #e0e0e0); box-shadow: 0 4px 12px rgba(0,0,0,0.4); min-width: 260px; }
  .toast-msg { flex: 1; }
  .toast-action { background: none; border: 1px solid #2b5b84; color: #58a6ff; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .toast-action:hover { background: #1a3a5a; }
  .toast-close { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; padding: 0 2px; }
  .project-section { border-top: 1px solid #222; padding: 8px 0; }
  .project-heading { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 16px; white-space: nowrap; overflow: hidden; }
  .project-link { display: block; padding: 4px 16px; font-size: 13px; color: #aaa; text-decoration: none; }
  .project-link:hover { background: #1a1a1a; color: #fff; }
  .project-name { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .project-profile { font-size: 11px; color: #555; white-space: nowrap; overflow: hidden; }

  /* ── Mobile (≤ 768px) ────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    #content { padding-top: 0; } /* toolbar is in flow, no fixed offset needed */
    .toast-container { bottom: 80px; }
    .activity-bar { display: none; } /* activity bar hidden on mobile — hamburger + toolbar covers it */
  }

  /* ── Theme picker button ─────────────────────────────────────────────────── */
  .footer-spacer { flex: 1; }
  .theme-btn {
    background: none; border: 1px solid var(--border, #2a2a2a);
    color: var(--muted, #666); border-radius: 4px;
    padding: 1px 8px; font-size: 11px; cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .theme-btn:hover { color: var(--fg, #ccc); border-color: var(--muted, #666); }

  /* ── Light theme overrides for this component's own scoped elements ─────── */
  /* :global(A) .B compiles to A .B.s-hash — beats the base .B.s-hash rule   */
  :global(html[data-theme="light"]) {
    .app-toolbar  { background: #fff; border-bottom-color: #d0d0d0; }
    .app-footer   { background: #fff; border-top-color: #d0d0d0; color: #555; }
    .footer-link  { color: #555; }    .footer-link:hover { color: #222; }
    .footer-sep   { color: #bbb; }
    .activity-bar { background: #e8e8e8; border-right-color: #d0d0d0; }
    .act-btn      { color: #888; }
    .act-btn:hover  { background: #ddd; color: #333; }
    .act-btn.active { color: #333; background: #dce8ff; border-left-color: #4a6cf7; }
    .hamburger, .home-btn, .gear-btn { color: #666; }
    .hamburger:hover, .home-btn:hover, .gear-btn:hover { color: #222; background: #e4e4e4; }
    .brand-name   { color: #4a6cf7; }
    .sidebar-header { background: #fff; border-bottom-color: #d0d0d0; }
    .sidebar-view-label { color: #888; }
    .new-btn, .new-btn-sm { border-color: #bbb; color: #555; }
    .new-btn:hover, .new-btn-sm:hover { background: #e4e4e4; color: #111; }
    .new-menu { background: #fff; border-color: #d0d0d0; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
    .new-menu-item { color: #333; }
    .new-menu-item:hover { background: #e0e8ff; color: #111; }
    .settings-group-label { color: #888; }
    .settings-file { color: #555; }
    .settings-file:hover { background: #eaeaea; color: #4a6cf7; }
    .settings-hint { color: #888; border-top-color: #e4e4e4; }
    .project-heading { color: #888; }
    .project-link { color: #555; }
    .project-link:hover { background: #eaeaea; color: #111; }
    .right-tab        { color: #888; }
    .right-tab.active { color: #333; border-bottom-color: #4a6cf7; }
    .toast { background: #fff; border-color: #d0d0d0; color: #333; }
    .chat-toggle { background: #ddeeff; border-color: #aaccee; color: #2a6090; }
    .chat-toggle:hover  { background: #cce0ff; }
    .chat-toggle.active { background: #aaccee; }
    .toast-action { background: none; border-color: #aaccee; color: #2a6090; }
    .toast-action:hover { background: #ddeeff; }
    .toast-close { color: #888; }
    #content { background: #f5f5f5; color: #1a1a1a; }
  }
</style>

<!-- Theme variables live in app.html. JS sets data-theme on <html>. -->
