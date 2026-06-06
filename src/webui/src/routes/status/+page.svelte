<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fileChanged } from '$lib/fileChanges';
  import FunnelView from '$lib/FunnelView.svelte';

  interface DocEntry {
    path: string; title: string; created: string;
    tags: string[]; category: string[]; complexity: string;
    status: string; priority: string; assigned_to: string;
  }
  interface PhasePlan {
    path: string; title: string; status: string; phase: number | null;
  }
  interface PendingGate {
    path: string; title: string; gate_id: string;
    reason: string; gate_status: string; reviewer: string; reviews: number;
  }
  interface WaivedGate {
    path: string; title: string; gate_id: string; note: string;
  }
  interface OverdueGate {
    path: string; title: string; gate_id: string;
    next_review: string; document_type: string;
  }
  interface StatusData {
    vaultName: string;
    version: string;
    currentPhase: number;
    phasePlans: PhasePlan[];
    proposals: { open: DocEntry[]; approved_pending: DocEntry[]; deferred: DocEntry[] };
    plans: { active: DocEntry[]; completed_count: number };
    gates: { pending: PendingGate[]; waived: WaivedGate[]; overdue: OverdueGate[] };
  }

  let data = $state<StatusData | null>(null);
  let loading = $state(true);

  type ViewMode = 'list' | 'funnel';
  function getViewMode(): ViewMode {
    if (typeof sessionStorage === 'undefined') return 'list';
    return (sessionStorage.getItem('status-view') as ViewMode) ?? 'list';
  }
  let viewMode = $state<ViewMode>(getViewMode());
  function setView(v: ViewMode) {
    viewMode = v;
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('status-view', v);
  }

  // Collapsed state per section, persisted in sessionStorage
  const SECTIONS = ['open-proposals', 'approved-pending', 'active-plans', 'completed', 'deferred', 'audit'];
  function isCollapsed(key: string): boolean {
    if (typeof sessionStorage === 'undefined') return key === 'completed' || key === 'deferred';
    const val = sessionStorage.getItem('status-collapsed-' + key);
    return val !== null ? val === 'true' : (key === 'completed' || key === 'deferred');
  }
  function toggleSection(key: string) {
    const next = !isCollapsed(key);
    sessionStorage.setItem('status-collapsed-' + key, String(next));
    collapsed = { ...collapsed, [key]: next };
  }

  let collapsed = $state<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(k => [k, isCollapsed(k)]))
  );

  async function load() {
    loading = true;
    const res = await fetch('/api/status');
    if (res.ok) data = await res.json();
    loading = false;
  }

  onMount(() => {
    load();
    if (!collapsed['audit']) loadAudit();
    return fileChanged.subscribe((change) => {
      if (change) load();
    });
  });

  function navTo(entry: DocEntry) {
    goto('/' + entry.path.replace(/\.md$/, ''));
  }

  // Audit log state
  let auditFilter = $state({ doc_path: '', actor: '', actor_type: '', transition_to: '' });
  let auditEntries = $state<any[]>([]);
  let auditTotal = $state(0);
  let auditLoading = $state(false);
  let auditFindings = $state<any[]>([]);
  let auditRunning = $state(false);
  let aiPreReviewResults = $state<Record<string, any>>({});
  let aiPreReviewLoading = $state<Record<string, boolean>>({});

  async function runAiPreReview(docPath: string, gateId: string, _title: string) {
    const key = docPath + '/' + gateId;
    aiPreReviewLoading = { ...aiPreReviewLoading, [key]: true };
    const res = await fetch('/api/gate-pre-review?doc_path=' + encodeURIComponent(docPath) + '&gate_id=' + encodeURIComponent(gateId));
    if (res.ok) {
      const data = await res.json();
      aiPreReviewResults = { ...aiPreReviewResults, [key]: data.result };
    }
    aiPreReviewLoading = { ...aiPreReviewLoading, [key]: false };
  }

  async function runGateAudit() {
    auditRunning = true;
    const res = await fetch('/api/gate-audit');
    if (res.ok) {
      const data = await res.json();
      auditFindings = data.findings;
    }
    auditRunning = false;
  }

  async function loadAudit() {
    auditLoading = true;
    const params = new URLSearchParams();
    if (auditFilter.doc_path) params.set('doc_path', auditFilter.doc_path);
    if (auditFilter.actor) params.set('actor', auditFilter.actor);
    if (auditFilter.actor_type) params.set('actor_type', auditFilter.actor_type);
    if (auditFilter.transition_to) params.set('transition_to', auditFilter.transition_to);
    params.set('limit', '100');
    const res = await fetch('/api/audit-query?' + params.toString());
    if (res.ok) {
      const data = await res.json();
      auditEntries = data.entries;
      auditTotal = data.total;
    }
    auditLoading = false;
  }

  function statusBadgeClass(status: string): string {
    if (status === 'in-progress') return 'badge-active';
    if (status === 'approved')    return 'badge-approved';
    if (status === 'completed')   return 'badge-done';
    if (status === 'canceled')    return 'badge-canceled';
    return 'badge-default';
  }

  function priorityClass(p: string): string {
    if (p === 'high' || p === 'critical') return 'pri-high';
    if (p === 'medium') return 'pri-med';
    return 'pri-low';
  }
</script>

<div class="status-page">
  <div class="status-header">
    <h1>{data?.vaultName ?? 'Vault'} Status</h1>
    <div class="view-toggle">
      <button class="view-btn" class:active={viewMode === 'list'}   onclick={() => setView('list')}   title="List view">≡ List</button>
      <button class="view-btn" class:active={viewMode === 'funnel'} onclick={() => setView('funnel')} title="Funnel view">⊙ Funnel</button>
    </div>
    <button class="refresh-btn" onclick={load} title="Refresh">↻</button>
  </div>

  {#if loading && !data}
    <div class="loading">Scanning vault…</div>
  {:else if data}

    {#if viewMode === 'funnel'}
      <FunnelView
        deferred={data.proposals.deferred}
        open={data.proposals.open}
        approved={data.proposals.approved_pending}
        active={data.plans.active}
        completedCount={data.plans.completed_count}
      />
    {:else}

    <!-- Phase/roadmap card -->
    {#if data.phasePlans.length > 0}
    <div class="phase-card">
      <div class="phase-card-header">
        <span class="phase-label">Phase {data.currentPhase}</span>
        {#if data.version}<span class="phase-version">v{data.version}</span>{/if}
        <span class="phase-stat">{data.plans.completed_count} plans completed</span>
      </div>
      <div class="phase-plan-list">
        {#each data.phasePlans as pp}
          <a class="phase-plan-item status-{pp.status}" href="/{pp.path.replace(/\.md$/, '')}">
            <span class="phase-plan-status-dot"></span>
            <span class="phase-plan-title">{pp.title}</span>
            <span class="phase-plan-badge">{pp.status}</span>
          </a>
        {/each}
      </div>
    </div>
    {/if}

    <!-- Overdue Reviews (Phase 1b — schedule triggers) -->
    {#if data.gates.overdue.length > 0}
    <section class="section gates-section">
      <div class="section-header overdue-header">
        <span class="section-title">⏰ Overdue Reviews</span>
        <span class="badge badge-warn">{data.gates.overdue.length}</span>
      </div>
      <div class="gates-list">
        {#each data.gates.overdue as g}
          <div class="gate-item" onclick={() => goto('/' + g.path.replace(/\.md$/, ''))}>
            <div class="gate-title">{g.title}</div>
            <div class="gate-meta">
              <span class="gate-badge">{g.gate_id}</span>
              <span class="gate-reason">Next review: {g.next_review}</span>
              <span class="gate-reviewer">{g.document_type}</span>
            </div>
          </div>
        {/each}
      </div>
    </section>
    {/if}

    <!-- Pending Gates -->
    {#if data.gates.pending.length > 0}
    <section class="section gates-section">
      <div class="section-header gates-header">
        <span class="section-title">⚠ Pending Gates</span>
        <span class="badge badge-warn">{data.gates.pending.length}</span>
      </div>
      <div class="gates-list">
        {#each data.gates.pending as g}
          <div class="gate-item" onclick={() => goto('/' + g.path.replace(/\.md$/, ''))}>
            <div class="gate-title">{g.title}</div>
            <div class="gate-meta">
              <span class="gate-badge">{g.gate_id}</span>
              <span class="gate-reason">{g.reason}</span>
              <span class="gate-reviewer">Reviewer: {g.reviewer || 'unassigned'}</span>
              <button class="gate-ai-btn" onclick={(e) => { e.stopPropagation(); runAiPreReview(g.path, g.gate_id, g.title); }}
                title="Run AI pre-review for this gate">AI</button>
            </div>
            {#if aiPreReviewResults[g.path + '/' + g.gate_id]}
              {@const r = aiPreReviewResults[g.path + '/' + g.gate_id]}
              <div class="ai-pre-review" class:ready={r.readiness === 'ready'} class:needs-work={r.readiness === 'needs-work'} class:blocked={r.readiness === 'blocked'}>
                <div class="ai-summary">{r.summary}</div>
                {#if r.concerns.length > 0}
                  <div class="ai-concerns">
                    {#each r.concerns as c}<span class="ai-concern">⚠ {c}</span>{/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
    {/if}

    <!-- Waived Gates -->
    {#if data.gates.waived.length > 0}
    <section class="section gates-section">
      <div class="section-header waived-header">
        <span class="section-title">⚡ Waived Gates (audit)</span>
        <span class="badge badge-default">{data.gates.waived.length}</span>
      </div>
      <div class="gates-list">
        {#each data.gates.waived as g}
          <div class="gate-item" onclick={() => goto('/' + g.path.replace(/\.md$/, ''))}>
            <div class="gate-title">{g.title}</div>
            <div class="gate-meta">
              <span class="gate-badge">{g.gate_id}</span>
              <span class="gate-reason">"{(g.note || 'No note')}"</span>
            </div>
          </div>
        {/each}
      </div>
    </section>
    {/if}

    <!-- Open proposals -->
    <section class="section">
      <button class="section-header" onclick={() => toggleSection('open-proposals')}>
        <span class="section-title">Open Proposals</span>
        <span class="badge">{data.proposals.open.length}</span>
        <span class="chevron">{collapsed['open-proposals'] ? '▸' : '▾'}</span>
      </button>
      {#if !collapsed['open-proposals']}
        {#if data.proposals.open.length === 0}
          <div class="empty">No open proposals</div>
        {:else}
          <table class="items-table">
            <thead><tr><th>Title</th><th>Category</th><th>Complexity</th><th>Created</th></tr></thead>
            <tbody>
              {#each data.proposals.open as p}
                <tr class="item-row" onclick={() => navTo(p)}>
                  <td class="item-title">{p.title}</td>
                  <td>{#each p.category as c}<span class="tag">{c}</span>{/each}</td>
                  <td>{#if p.complexity}<span class="complexity">{p.complexity}</span>{/if}</td>
                  <td class="item-date">{p.created}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </section>

    <!-- Approved, pending plan -->
    <section class="section">
      <button class="section-header" onclick={() => toggleSection('approved-pending')}>
        <span class="section-title">Approved — Awaiting Plan</span>
        <span class="badge {data.proposals.approved_pending.length > 0 ? 'badge-warn' : ''}">{data.proposals.approved_pending.length}</span>
        <span class="chevron">{collapsed['approved-pending'] ? '▸' : '▾'}</span>
      </button>
      {#if !collapsed['approved-pending']}
        {#if data.proposals.approved_pending.length === 0}
          <div class="empty">All approved proposals have plans ✓</div>
        {:else}
          <table class="items-table">
            <thead><tr><th>Title</th><th>Category</th><th>Effort</th></tr></thead>
            <tbody>
              {#each data.proposals.approved_pending as p}
                <tr class="item-row" onclick={() => navTo(p)}>
                  <td class="item-title">{p.title}</td>
                  <td>{#each p.category as c}<span class="tag">{c}</span>{/each}</td>
                  <td>{#if p.complexity}<span class="complexity">{p.complexity}</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </section>

    <!-- Active plans -->
    <section class="section">
      <button class="section-header" onclick={() => toggleSection('active-plans')}>
        <span class="section-title">Active Plans</span>
        <span class="badge">{data.plans.active.length}</span>
        <span class="chevron">{collapsed['active-plans'] ? '▸' : '▾'}</span>
      </button>
      {#if !collapsed['active-plans']}
        {#if data.plans.active.length === 0}
          <div class="empty">No active plans</div>
        {:else}
          <table class="items-table">
            <thead><tr><th>Title</th><th>Status</th><th>Priority</th><th>Assigned</th></tr></thead>
            <tbody>
              {#each data.plans.active as p}
                <tr class="item-row" onclick={() => navTo(p)}>
                  <td class="item-title">{p.title}</td>
                  <td><span class="badge {statusBadgeClass(p.status)}">{p.status}</span></td>
                  <td><span class="pri {priorityClass(p.priority)}">{p.priority || '—'}</span></td>
                  <td class="item-date">{p.assigned_to || '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </section>

    <!-- Completed plans -->
    <section class="section">
      <button class="section-header" onclick={() => toggleSection('completed')}>
        <span class="section-title">Completed Plans</span>
        <span class="badge badge-done">{data.plans.completed_count}</span>
        <span class="chevron">{collapsed['completed'] ? '▸' : '▾'}</span>
      </button>
      {#if !collapsed['completed']}
        <div class="empty muted">{data.plans.completed_count} plan{data.plans.completed_count === 1 ? '' : 's'} completed —
          <a href="/plans/completed" class="link">browse completed plans</a>
        </div>
      {/if}
    </section>

    <!-- Deferred -->
    {#if data.proposals.deferred.length > 0}
      <section class="section">
        <button class="section-header" onclick={() => toggleSection('deferred')}>
          <span class="section-title">Deferred</span>
          <span class="badge badge-default">{data.proposals.deferred.length}</span>
          <span class="chevron">{collapsed['deferred'] ? '▸' : '▾'}</span>
        </button>
        {#if !collapsed['deferred']}
          <div class="deferred-list">
            {#each data.proposals.deferred as p}
              <button class="deferred-item" onclick={() => navTo(p)}>{p.title}</button>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- Audit Log -->
    <section class="section">
      <button class="section-header" onclick={() => toggleSection('audit')}>
        <span class="section-title">Audit Log</span>
        <span class="badge">{auditTotal}</span>
        <span class="chevron">{collapsed['audit'] ? '▸' : '▾'}</span>
      </button>
      {#if !collapsed['audit']}
        <div class="audit-controls">
          <input type="text" placeholder="Filter by doc path…" bind:value={auditFilter.doc_path} class="audit-input" oninput={loadAudit} />
          <input type="text" placeholder="Filter by actor…" bind:value={auditFilter.actor} class="audit-input" oninput={loadAudit} />
          <select bind:value={auditFilter.actor_type} class="audit-select" onchange={loadAudit}>
            <option value="">Any actor type</option>
            <option value="human">Human</option>
            <option value="ai">AI</option>
          </select>
          <select bind:value={auditFilter.transition_to} class="audit-select" onchange={loadAudit}>
            <option value="">Any transition</option>
            <option value="approved">→ approved</option>
            <option value="in-progress">→ in-progress</option>
            <option value="completed">→ completed</option>
            <option value="canceled">→ canceled</option>
          </select>
        </div>
        <div class="audit-toolbar">
          <button class="act audit-btn" onclick={runGateAudit} disabled={auditRunning}>
            {auditRunning ? 'Scanning…' : '🔍 Run Gate Audit'}
          </button>
          {#if auditFindings.length > 0}
            <span class="badge badge-warn">{auditFindings.length} findings</span>
          {/if}
        </div>

        {#if auditFindings.length > 0}
        <div class="audit-findings">
          <div class="audit-findings-header">Gate Compliance Findings</div>
          {#each auditFindings as f}
            <div class="audit-finding" onclick={() => goto('/' + f.path.replace(/\.md$/, ''))}>
              <div class="finding-title">{f.title}</div>
              <div class="finding-meta">
                <span class="gate-badge">{f.gate_id}</span>
                <span>{f.transition_from} → {f.transition_to}</span>
                <span>Reviewer: {f.expected_reviewer}</span>
                <span>Status: {f.current_gate_status}</span>
              </div>
            </div>
          {/each}
        </div>
        {/if}

        {#if auditLoading}
          <div class="empty">Loading…</div>
        {:else if auditEntries.length === 0}
          <div class="empty">No audit entries match filter</div>
        {:else}
          <table class="items-table">
            <thead><tr><th>Date</th><th>Document</th><th>Transition</th><th>Actor</th><th>Type</th><th>Gate</th></tr></thead>
            <tbody>
              {#each auditEntries as e}
                <tr class="item-row" onclick={() => goto('/' + e.doc_path.replace(/\.md$/, ''))}>
                  <td class="item-date">{e.ts.slice(0, 10)}</td>
                  <td class="item-title">{e.doc_path}</td>
                  <td>{e.transition_from} → {e.transition_to}</td>
                  <td>{e.actor}</td>
                  <td><span class="tag">{e.actor_type}</span></td>
                  <td>{e.gate_id || '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if auditTotal > auditEntries.length}
            <div class="empty muted">{auditTotal} total entries — showing {auditEntries.length}</div>
          {/if}
        {/if}
      {/if}
    </section>

    {/if} <!-- end {:else} list view -->
  {/if}
</div>



<style lang="scss">
  @use '../../lib/tokens' as *;

  // ── Phase card ──────────────────────────────────────────────────────────────
  .phase-card {
    background: linear-gradient(135deg, #1a1f3a 0%, #111 100%);
    border: 1px solid #2a3060;
    border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;
  }
  .phase-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .phase-label  { font-size: 14px; font-weight: 700; color: $accent; letter-spacing: 0.3px; }
  .phase-version { font-size: 11px; color: $muted; font-family: monospace; background: $bg-2; border: 1px solid $border; padding: 1px 6px; border-radius: 4px; }
  .phase-stat   { font-size: 11px; color: $muted; margin-left: auto; }
  .phase-plan-list { display: flex; flex-direction: column; gap: 4px; }
  .phase-plan-item {
    display: flex; align-items: center; gap: 8px; padding: 4px 6px;
    border-radius: 4px; text-decoration: none; transition: background 0.1s;
    &:hover { background: $bg-hover; }
  }
  .phase-plan-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .status-in-progress {
    .phase-plan-status-dot { background: #4caf50; box-shadow: 0 0 4px #4caf5088; }
    .phase-plan-title { color: $fg; font-weight: 500; }
    .phase-plan-badge { color: #4caf50; border-color: #4caf5044; }
  }
  .status-approved .phase-plan-status-dot { background: #f59e0b; }
  .status-approved .phase-plan-badge      { color: #f59e0b; border-color: #f59e0b44; }
  .status-draft .phase-plan-status-dot    { background: $border; }
  .status-completed .phase-plan-status-dot { background: $muted; }
  .phase-plan-title { font-size: 12px; color: $fg-dim; flex: 1; }
  .phase-plan-badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; color: $muted; background: $bg-2; border: 1px solid $border; }

  // ── Page structure ──────────────────────────────────────────────────────────
  .status-page { padding: 32px; }
  .status-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  h1 { font-size: 20px; font-weight: 600; color: $fg; margin: 0; flex: 1; }

  .refresh-btn {
    @include flat-btn;
    border: 1px solid $border; border-radius: 4px; padding: 2px 8px; font-size: 14px;
    &:hover { border-color: $muted; }
  }

  // ── List/Funnel toggle ──────────────────────────────────────────────────────
  .view-toggle { display: flex; gap: 2px; background: $bg-2; border: 1px solid $border; border-radius: 6px; padding: 2px; }
  .view-btn {
    background: none; border: none; color: $muted;
    font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 4px; cursor: pointer; white-space: nowrap;
    &:hover  { color: $fg-dim; }
    &.active { background: $bg-3; color: $fg; }
  }

  .loading { color: $muted; padding: 16px 0; font-size: 13px; }

  // ── Sections ────────────────────────────────────────────────────────────────
  .section { margin-bottom: 8px; border: 1px solid $border; border-radius: 6px; overflow: hidden; }
  .section-header {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 16px;
    background: $bg-header; border: none; color: $fg; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left;
    &:hover { background: $bg-hover; }
  }
  .section-title { flex: 1; }
  .chevron { color: $border; font-size: 11px; }

  // ── Badges ──────────────────────────────────────────────────────────────────
  .badge { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: $bg-3; color: $muted; border: 1px solid $border; }
  .badge-active   { background: $blue-bg;      color: $blue;    border-color: $blue-bdr; }
  .badge-approved { background: $blue-bg;       color: #7ab;     border-color: #2a4a6a; }
  .badge-done     { background: $green-bg;      color: $green;   border-color: $green-bdr; }
  .badge-canceled { background: $red-bg;        color: #966;     border-color: #4a2a2a; }
  .badge-warn     { background: #2a2000; color: $amber; border-color: $amber-bdr; }
  .badge-default  { background: $bg-2;          color: $muted;   border-color: $border; }

  .empty { padding: 10px 16px; font-size: 12px; color: $muted; }
  .muted { color: $muted; }
  .link  { color: $blue; text-decoration: none; &:hover { text-decoration: underline; } }

  // ── Table ───────────────────────────────────────────────────────────────────
  .items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .items-table thead tr { border-bottom: 1px solid $border; }
  .items-table th { padding: 6px 16px; text-align: left; color: $muted; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .item-row { cursor: pointer; border-bottom: 1px solid $bg-hover; &:hover { background: $bg-hover; } }
  .item-row td { padding: 8px 16px; color: $fg-dim; }
  .item-title   { color: $fg; font-weight: 500; }
  .item-date    { color: $muted; font-size: 11px; }

  // ── Tags & complexity chips ──────────────────────────────────────────────────
  .tag        { display: inline-block; background: $tag-bg; border: 1px solid $tag-bdr; border-radius: 8px; padding: 0 6px; font-size: 10px; color: $tag; margin-right: 3px; }
  .complexity { display: inline-block; background: $bg-3; border: 1px solid $border; border-radius: 4px; padding: 0 5px; font-size: 10px; color: $muted; }

  .pri { font-size: 11px; }
  .pri-high { color: #e87; }
  .pri-med  { color: $amber; }
  .pri-low  { color: $muted; }

  // ── Deferred ────────────────────────────────────────────────────────────────
  .deferred-list { padding: 6px 16px 10px; display: flex; flex-direction: column; gap: 4px; }
  .deferred-item { background: none; border: none; color: $muted; font-size: 12px; text-align: left; cursor: pointer; padding: 2px 0; &:hover { color: $fg-dim; } }

  // ── Gates ───────────────────────────────────────────────────────────────────
  .gates-section { margin-bottom: 8px; border: 1px solid $amber-bdr; border-radius: 6px; overflow: hidden; }
  .gates-header   { background: #1e1800; }
  .overdue-header { background: #1e0e00; }
  .waived-header  { background: #1a0e0e; }
  .gates-list { padding: 6px 16px 10px; display: flex; flex-direction: column; gap: 6px; }
  .gate-item {
    padding: 8px 10px; background: $bg-2; border: 1px solid $border; border-radius: 4px; cursor: pointer;
    &:hover { background: $bg-hover; border-color: $muted; }
  }
  .gate-title  { font-size: 13px; color: $fg; font-weight: 500; margin-bottom: 4px; }
  .gate-meta   { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11px; color: $muted; }
  .gate-badge  { background: #2a2000; color: $amber; border: 1px solid $amber-bdr; border-radius: 4px; padding: 0 5px; font-family: monospace; font-size: 10px; }
  .gate-reason { flex: 1; min-width: 120px; }
  .gate-reviewer { color: $fg-dim; font-size: 10px; }
  .gate-ai-btn { background: $blue-bg; border: 1px solid $blue-bdr; color: #7ab; border-radius: 3px; padding: 1px 5px; font-size: 9px; cursor: pointer; margin-left: auto; &:hover { background: $blue-bg; } }
  .ai-pre-review { margin-top: 6px; padding: 6px 8px; border-radius: 4px; font-size: 11px; border: 1px solid $border;
    &.ready      { background: #0a1a0a; border-color: #2a4a2a; }
    &.needs-work { background: #1a1a00; border-color: #4a4a2a; }
    &.blocked    { background: $red-bg; border-color: $red-bdr; }
  }
  .ai-summary  { color: $fg-dim; line-height: 1.4; }
  .ai-concerns { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
  .ai-concern  { color: $amber; font-size: 10px; }

  // ── Audit log ───────────────────────────────────────────────────────────────
  .audit-controls { display: flex; gap: 6px; padding: 8px 16px; flex-wrap: wrap; background: $bg; border-bottom: 1px solid $border; }
  .audit-toolbar  { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: $bg; border-bottom: 1px solid $border; }
  .audit-btn { background: $blue-bg; border: 1px solid $blue-bdr; color: #7ab; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; white-space: nowrap; &:hover { background: $blue-bg; } &:disabled { opacity: 0.5; cursor: default; } }
  .audit-findings { border-bottom: 1px solid $border; }
  .audit-findings-header { padding: 6px 16px; font-size: 11px; color: $amber; font-weight: 600; background: #1e1800; }
  .audit-finding { padding: 8px 16px; cursor: pointer; border-bottom: 1px solid $border; &:hover { background: $bg-hover; } }
  .finding-title { font-size: 12px; color: $fg; font-weight: 500; margin-bottom: 2px; }
  .finding-meta  { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 10px; color: $muted; }
  .audit-input   { @include inline-input; font-size: 11px; padding: 4px 8px; flex: 1; min-width: 120px; border-radius: 4px; &:focus { border-color: $muted; } }
  .audit-select  { background: $bg-2; border: 1px solid $border; border-radius: 4px; color: $fg-dim; font-size: 11px; padding: 4px 6px; }

  // ── Light theme — scoped via :global so Svelte appends the scope hash ────────
  // Pattern: :global(html[data-theme="light"]) .scoped-class compiles to
  //   html[data-theme="light"] .scoped-class.s-hash — beats the base rule.
  :global(html[data-theme="light"]) {
    .phase-card { background: linear-gradient(135deg, #e8eeff 0%, #f5f5f5 100%); border-color: #c0c8f0; }
    .phase-label { color: #4a6cf7; }
    .phase-version { background: #fff; border-color: #d0d0d0; }
    .section { border-color: #d0d0d0; }
    .section-header { background: #e8e8e8; color: #1a1a1a; &:hover { background: #ddd; } }
    .badge { background: #e0e0e0; color: #555; border-color: #ccc; }
    .badge-warn { background: #fff8cc; color: #7a6000; border-color: #e8d400; }
    .item-row { border-bottom-color: #ebebeb; &:hover { background: #f5f5f5; } td { color: #444; } }
    .item-title { color: #1a1a1a; }
    .view-toggle { background: #e8e8e8; border-color: #ccc; }
    .view-btn { color: #777; &:hover { color: #333; } &.active { background: #d8d8d8; color: #1a1a1a; } }
    .audit-controls, .audit-toolbar { background: #f0f0f0; border-bottom-color: #d0d0d0; }
    .audit-input, .audit-select { background: #fff; border-color: #ccc; color: #333; }
    .audit-finding { border-bottom-color: #ebebeb; &:hover { background: #f5f5f5; } }
    .audit-findings-header { background: #fff8cc; color: #7a6000; }
    .gates-section { border-color: #e8c84a; }
    .gates-header   { background: #fff8cc; }
    .overdue-header { background: #fff0e0; }
    .waived-header  { background: #ffe8e8; }
    .gate-item { background: #fff; border-color: #d0d0d0; &:hover { background: #f5f5f5; border-color: #bbb; } }
    .gate-title { color: #1a1a1a; }
    .gate-meta { color: #666; }
    .gate-badge { background: #fff8cc; color: #7a6000; border-color: #e8c84a; }
    .deferred-item { color: #888; &:hover { color: #555; } }
    .empty, .muted { color: #888; }
  }
</style>
