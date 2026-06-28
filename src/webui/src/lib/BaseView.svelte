<script lang="ts">
  import { goto } from '$app/navigation';
  import GraphView from './GraphView.svelte';
  import HierarchyView from './HierarchyView.svelte';

  let { path: basePath }: { path: string } = $props();

  interface ViewConfig {
    type: string;
    name: string;
    filters?: { and?: any[]; or?: any[] };
    order?: string[];
    sort?: Array<{ property: string; direction: 'ASC' | 'DESC' }>;
    columnSize?: Record<string, number>;
  }
  interface DwViewConfig {
    id: string; type: 'graph' | 'flowchart'; mode?: string;
    filters?: { and?: string[]; or?: string[] };
    nodes?: { labelField?: string; groupBy?: string; colorBy?: string };
    edges?: Array<{ field: string; label: string }>;
    layers?: Array<{ match: string; rank: number }>;
    layout?: string; root?: string; parentField?: string;
    labelField?: string; colorBy?: string;
  }
  interface NoteData {
    path: string;
    filename: string;
    frontmatter: Record<string, any>;
  }

  let loading   = $state(true);
  let error     = $state<string | null>(null);
  let views     = $state<ViewConfig[]>([]);
  let notes     = $state<NoteData[]>([]);
  let docwright = $state<any>(null);
  let dwViews   = $state<DwViewConfig[]>([]);

  let activeIdx    = $state(0);
  let activeDomain = $state<'table' | 'dw'>('table');
  let activeDwId   = $state('');
  let sortField    = $state<string | null>(null);
  let sortAsc      = $state(true);
  let viewMode     = $state<'table' | 'graph' | 'hierarchical'>('table');

  $effect(() => { void load(basePath); });

  async function load(p: string) {
    loading = true; error = null;
    const res = await fetch('/api/base?path=' + encodeURIComponent(p));
    if (!res.ok) { error = 'Failed to load base view'; loading = false; return; }
    const data = await res.json();
    views     = data.views     ?? [];
    notes     = data.notes     ?? [];
    docwright = data.docwright ?? null;
    dwViews   = data.docwright?.views ?? [];
    activeIdx = 0;
    activeDomain = 'table';
    activeDwId   = dwViews[0]?.id ?? '';
    sortField = null;
    loading = false;
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  function coerce(v: string): any {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }

  function evalCond(note: NoteData, expr: any): boolean {
    // Nested filter object: { and: [...] } or { or: [...] }
    if (typeof expr === 'object' && expr !== null) {
      if (Array.isArray(expr.and)) return expr.and.every((c: any) => evalCond(note, c));
      if (Array.isArray(expr.or))  return expr.or.some((c: any)  => evalCond(note, c));
      return true;
    }
    if (typeof expr !== 'string') return true;

    // file.inFolder("path") — note.path is vault-relative e.g. policies/technology/foo.md
    const m_inFolder = expr.match(/file\.inFolder\("([^"]+)"\)/);
    if (m_inFolder) return note.path.startsWith(m_inFolder[1] + '/');

    // file.name != "X" / file.name == "X"
    const m_name_neq = expr.match(/file\.name\s*!=\s*"([^"]+)"/);
    if (m_name_neq) return note.filename !== m_name_neq[1];
    const m_name_eq  = expr.match(/file\.name\s*={1,2}\s*"([^"]+)"/);
    if (m_name_eq)  return note.filename === m_name_eq[1];

    // file.ext != "X" / file.ext == "X"
    const m_ext_neq = expr.match(/file\.ext\s*!=\s*"([^"]+)"/);
    if (m_ext_neq) return (note.path.split('.').pop() ?? '') !== m_ext_neq[1];
    const m_ext_eq  = expr.match(/file\.ext\s*={1,2}\s*"([^"]+)"/);
    if (m_ext_eq)  return (note.path.split('.').pop() ?? '') === m_ext_eq[1];

    const m_in = expr.match(/^(\w+)\s+IN\s+\[([^\]]+)\]$/i);
    if (m_in) {
      const vals = m_in[2].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
      return vals.includes(String(note.frontmatter[m_in[1]] ?? ''));
    }
    const m_contains = expr.match(/^(\w+)\s+CONTAINS\s+(.+)$/i);
    if (m_contains) {
      const val = m_contains[2].trim().replace(/^['"]|['"]$/g, '');
      return String(note.frontmatter[m_contains[1]] ?? '').toLowerCase().includes(val.toLowerCase());
    }
    const m_neq = expr.match(/^(\w+)\s*!=\s*(.+)$/);
    if (m_neq) {
      const val = coerce(m_neq[2].trim().replace(/^['"]|['"]$/g, ''));
      return note.frontmatter[m_neq[1]] !== val && String(note.frontmatter[m_neq[1]]) !== String(val);
    }
    const m_eq = expr.match(/^(\w+)\s*=\s*(.+)$/);
    if (m_eq) {
      const val = coerce(m_eq[2].trim().replace(/^['"]|['"]$/g, ''));
      return note.frontmatter[m_eq[1]] === val || String(note.frontmatter[m_eq[1]]) === String(val);
    }
    return true;
  }

  function applyFilters(items: NoteData[], filters: ViewConfig['filters']): NoteData[] {
    if (!filters) return items;
    const conds = filters.and ?? filters.or ?? [];
    return items.filter(n =>
      filters.and
        ? conds.every(c => evalCond(n, c))
        : conds.some(c => evalCond(n, c))
    );
  }

  // ── Sort ──────────────────────────────────────────────────────────────────

  function ipKey(ip: string): string {
    const parts = (ip || '').split('.');
    if (parts.length !== 4) return '￿' + (ip || '');
    return parts.map(p => String(parseInt(p) || 0).padStart(3, '0')).join('.');
  }

  function fieldVal(note: NoteData, prop: string): string {
    const raw = prop === 'file.name' ? note.filename : String(note.frontmatter[prop] ?? '');
    if (prop === 'ip') return raw ? ipKey(raw) : '￿';
    if (prop === 'proxmox_id') return (raw && raw !== '0') ? String(raw).padStart(6, '0') : '￿';
    return raw || '￿';
  }

  function sortRows(items: NoteData[], view: ViewConfig): NoteData[] {
    const baseCols: Array<{ property: string; direction: 'ASC' | 'DESC' }> = view.sort ?? [];
    const cols = sortField
      ? [{ property: sortField, direction: (sortAsc ? 'ASC' : 'DESC') as 'ASC' | 'DESC' }, ...baseCols]
      : baseCols;
    if (!cols.length) return items;
    return [...items].sort((a, b) => {
      for (const col of cols) {
        const dir = col.direction === 'DESC' ? -1 : 1;
        const av = fieldVal(a, col.property);
        const bv = fieldVal(b, col.property);
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        if (cmp !== 0) return cmp * dir;
      }
      return 0;
    });
  }

  // ── Derived rows ──────────────────────────────────────────────────────────

  let activeView    = $derived(views[activeIdx] ?? null);
  let activeDwView  = $derived(dwViews.find(v => v.id === activeDwId) ?? null);
  let dwRows        = $derived(
    activeDwView?.filters ? applyFilters(notes, activeDwView.filters) : notes
  );

  let rows = $derived(
    activeView ? sortRows(applyFilters(notes, activeView.filters), activeView) : []
  );

  let displayCount = $derived(activeDomain === 'dw' ? dwRows.length : rows.length);

  let cols = $derived(
    (activeView?.order ?? []).filter(c => c !== 'file.name' ? true : true)
  );

  // ── Column helpers ────────────────────────────────────────────────────────

  function colLabel(col: string): string {
    if (col === 'file.name') return 'Name';
    return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function colWidth(col: string): string {
    const w = activeView?.columnSize?.[col];
    return w ? w + 'px' : 'auto';
  }

  function handleColClick(col: string) {
    if (sortField === col) { sortAsc = !sortAsc; }
    else { sortField = col; sortAsc = true; }
  }

  // ── Cell rendering ────────────────────────────────────────────────────────

  const ARP: Record<string, string> = {
    reachable: '🟢', delay: '🟡', stale: '⚪', failed: '🔴', unknown: '❓',
  };

  function rawVal(note: NoteData, col: string): any {
    if (col === 'file.name') return note.filename;
    return note.frontmatter[col] ?? '';
  }

  // ── Folder/title ─────────────────────────────────────────────────────────

  let title = $derived(
    basePath.split('/').slice(-2, -1)[0]?.replace(/-/g, ' ') ?? 'Base View'
  );
</script>

<div class="base-wrap">
  <div class="base-header">
    <h1 class="base-title">{title}</h1>
    <span class="base-count">{displayCount} record{displayCount !== 1 ? 's' : ''}</span>
  </div>

  <!-- View tabs + mode toggle -->
  <div class="view-tabs-row">
    <div class="view-tabs">
      {#each views as view, i}
        <button
          class="view-tab"
          class:active={activeDomain === 'table' && i === activeIdx}
          onclick={() => { activeDomain = 'table'; activeIdx = i; sortField = null; }}
        >{view.name}</button>
      {/each}
      {#if dwViews.length}
        <span class="tab-sep">|</span>
        {#each dwViews as dv}
          <button
            class="view-tab dw-tab"
            class:active={activeDomain === 'dw' && activeDwId === dv.id}
            onclick={() => { activeDomain = 'dw'; activeDwId = dv.id; }}
          >{dv.type === 'flowchart' ? '⤵' : '⬡'} {dv.id}</button>
        {/each}
      {/if}
    </div>

    {#if activeDomain === 'table'}
    <div class="mode-toggle">
      <button class="mode-btn" class:active={viewMode === 'table'}
        onclick={() => viewMode = 'table'} title="Table view">
        ≡ Table
      </button>
      <button class="mode-btn" class:active={viewMode === 'graph'}
        onclick={() => viewMode = 'graph'} title="Graph view">
        ⬡ Graph
      </button>
      <button class="mode-btn" class:active={viewMode === 'hierarchical'}
        onclick={() => viewMode = 'hierarchical'} title="Hierarchical view">
        ⤵ Hierarchy
      </button>
    </div>
    {/if}
  </div>

  <div class="view-body">
    {#if loading}
      <div class="base-loading">Loading…</div>
    {:else if error}
      <div class="base-error">{error}</div>
    {:else if activeDomain === 'dw' && activeDwView}
      {#if activeDwView.type === 'flowchart'}
        <HierarchyView rows={dwRows} allNotes={notes} {docwright} viewConfig={activeDwView} />
      {:else}
        <GraphView rows={dwRows} allNotes={notes} {docwright} viewConfig={activeDwView} />
      {/if}
    {:else if !activeView}
      <div class="base-empty">No views defined in this base file.</div>
    {:else if viewMode === 'table'}
      <!-- ── Table ──────────────────────────────────────────────────────── -->
      <div class="table-scroll">
        <table class="base-table">
          <thead>
            <tr>
              {#each cols as col}
                <th
                  style="min-width:{colWidth(col)}"
                  class:sort-asc={sortField === col && sortAsc}
                  class:sort-desc={sortField === col && !sortAsc}
                  onclick={() => handleColClick(col)}
                >
                  {colLabel(col)}
                  {#if sortField === col}
                    <span class="sort-arrow">{sortAsc ? '↑' : '↓'}</span>
                  {/if}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each rows as note}
              <tr onclick={() => goto('/' + note.path.replace(/\.md$/, ''))}>
                {#each cols as col}
                  {@const val = rawVal(note, col)}
                  <td>
                    {#if col === 'file.name'}
                      <a class="note-link" href="/{note.path.replace(/\.md$/, '')}"
                        onclick={(e) => e.stopPropagation()}
                      >{note.filename}</a>
                    {:else if col === 'arp_status'}
                      <span class="arp">{ARP[val] ?? '❓'} {val}</span>
                    {:else if col === 'credentials'}
                      <span class="cred" class:cred-yes={val === true || val === 'true'}>
                        {val === true || val === 'true' ? '✓' : '✗'}
                      </span>
                    {:else if col === 'ip' || col === 'mac'}
                      <code class="mono">{val}</code>
                    {:else if col === 'proxmox_id' && (!val || val === '0')}
                      <span class="muted">—</span>
                    {:else if val === '' || val === null || val === undefined}
                      <span class="muted">—</span>
                    {:else}
                      {val}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if rows.length === 0}
        <div class="base-empty">No records match this view's filters.</div>
      {/if}

    {:else if viewMode === 'graph'}
      <!-- ── Graph ──────────────────────────────────────────────────────── -->
      <GraphView {rows} allNotes={notes} {docwright} />

    {:else if viewMode === 'hierarchical'}
      <!-- ── Hierarchy ──────────────────────────────────────────────────── -->
      <HierarchyView {rows} allNotes={notes} {docwright} />

    {/if}
  </div>
</div>

<style lang="scss">
  @use './tokens' as *;

  /* Make the slot a flex column so base-wrap can fill it.
     overflow: hidden moves scrolling responsibility to .view-body and .page-body
     (both already have overflow-y: auto), so regular pages are unaffected. */
  :global(#page-slot) { display: flex; flex-direction: column; overflow: hidden; }

  .base-wrap { padding: 32px; display: flex; flex-direction: column; gap: 0; flex: 1; min-height: 0; box-sizing: border-box; }
  .view-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

  .base-header {
    display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px;
  }
  .base-title { font-size: 1.4em; font-weight: 700; margin: 0; text-transform: capitalize; }
  .base-count { font-size: 12px; color: $muted; }

  /* View tabs row */
  .view-tabs-row {
    display: flex; align-items: flex-end; justify-content: space-between;
    border-bottom: 1px solid $border; margin-bottom: 16px; gap: 12px;
  }
  .view-tabs {
    display: flex; gap: 2px; flex-wrap: wrap; flex: 1;
  }
  .view-tab {
    background: none; border: none; border-bottom: 2px solid transparent;
    color: $muted; font-size: 12px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.4px; padding: 6px 14px 5px; cursor: pointer;
    margin-bottom: -1px;
    &:hover { color: $fg-dim; }
    &.active { color: $fg; border-bottom-color: $blue; }
    &.dw-tab { color: $muted; border-bottom-style: dashed;
      &.active { color: $teal; border-bottom-color: $teal; border-bottom-style: solid; }
      &:hover { color: $teal; }
    }
  }
  .tab-sep {
    color: $border; font-size: 14px; padding: 0 4px;
    align-self: center; user-select: none;
  }

  /* Mode toggle */
  .mode-toggle {
    display: flex; gap: 2px; flex-shrink: 0; margin-bottom: 1px;
  }
  .mode-btn {
    background: none; border: 1px solid $border; border-radius: 4px;
    color: $muted; font-size: 11px; padding: 3px 10px; cursor: pointer;
    white-space: nowrap;
    &:hover { color: $fg-dim; border-color: $fg-dim; }
    &.active { color: $blue; border-color: $blue-bdr; background: $blue-bg; }
  }

  /* Table */
  .table-scroll { overflow: auto; flex: 1; min-height: 0; }
  .base-table {
    width: 100%; border-collapse: collapse; font-size: 13px;
    th {
      position: sticky; top: 0; background: $bg-3;
      text-align: left; padding: 7px 10px;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px;
      color: $muted; border-bottom: 1px solid $border;
      white-space: nowrap; user-select: none;
      &.sortable { cursor: pointer; &:hover { color: $fg; } }
      &.sort-asc, &.sort-desc { color: $blue; }
    }
    td {
      padding: 5px 10px; border-bottom: 1px solid $border;
      vertical-align: middle; white-space: nowrap; max-width: 280px;
      overflow: hidden; text-overflow: ellipsis;
    }
    tr:hover td { background: $bg-hover; cursor: pointer; }
  }
  .sort-arrow { margin-left: 4px; font-size: 10px; }

  .note-link {
    color: $fg; text-decoration: none; font-weight: 500;
    &:hover { color: $blue; }
  }
  .mono { font-family: monospace; font-size: 12px; color: $fg-dim; }
  .muted { color: $muted; }

  .arp { font-size: 12px; white-space: nowrap; }

  .cred { font-weight: 700; color: $red; }
  .cred-yes { color: $teal; }


  /* States */
  .base-loading, .base-error, .base-empty {
    padding: 32px; text-align: center; color: $muted; font-size: 13px;
  }
  .base-error { color: $red; }
</style>
