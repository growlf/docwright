<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let auditFilter = $state({ doc_path: '', actor: '', actor_type: '', transition_to: '' });
  let auditEntries = $state<any[]>([]);
  let auditTotal = $state(0);
  let auditLoading = $state(false);
  let auditFindings = $state<any[]>([]);
  let auditRunning = $state(false);

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

  async function runGateAudit() {
    auditRunning = true;
    const res = await fetch('/api/gate-audit');
    if (res.ok) {
      const data = await res.json();
      auditFindings = data.findings;
    }
    auditRunning = false;
  }

  onMount(() => { loadAudit(); });
</script>

<div class="audit-page">
  <div class="audit-header">
    <h1>Audit Log</h1>
    <button class="refresh-btn" onclick={loadAudit} title="Refresh">↻</button>
  </div>

  <!-- Gate compliance scan -->
  <section class="audit-section">
    <div class="section-title-row">
      <span class="section-title">Gate Compliance Scan</span>
      <button class="gate-audit-btn" onclick={runGateAudit} disabled={auditRunning}>
        {auditRunning ? 'Scanning…' : '🔍 Run Gate Audit'}
      </button>
      {#if auditFindings.length > 0}
        <span class="badge badge-warn">{auditFindings.length} finding{auditFindings.length === 1 ? '' : 's'}</span>
      {:else if !auditRunning}
        <span class="badge badge-ok">Clean</span>
      {/if}
    </div>
    <p class="section-hint">Scans all plans for lifecycle transitions that bypassed required gate reviews.</p>

    {#if auditFindings.length > 0}
      <div class="findings-list">
        {#each auditFindings as f}
          <div class="finding-item" onclick={() => goto('/' + f.path.replace(/\.md$/, ''))}>
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
  </section>

  <!-- Audit log with filters -->
  <section class="audit-section">
    <div class="section-title-row">
      <span class="section-title">Lifecycle Transitions</span>
      {#if auditTotal > 0}<span class="badge">{auditTotal} total</span>{/if}
    </div>

    <div class="filter-row">
      <input type="text" placeholder="Filter by doc path…"
        bind:value={auditFilter.doc_path} class="filter-input" oninput={loadAudit} />
      <input type="text" placeholder="Filter by actor…"
        bind:value={auditFilter.actor} class="filter-input" oninput={loadAudit} />
      <select bind:value={auditFilter.actor_type} class="filter-select" onchange={loadAudit}>
        <option value="">Any actor type</option>
        <option value="human">Human</option>
        <option value="ai">AI</option>
      </select>
      <select bind:value={auditFilter.transition_to} class="filter-select" onchange={loadAudit}>
        <option value="">Any transition</option>
        <option value="approved">→ approved</option>
        <option value="in-progress">→ in-progress</option>
        <option value="completed">→ completed</option>
        <option value="canceled">→ canceled</option>
      </select>
    </div>

    {#if auditLoading}
      <div class="empty">Loading…</div>
    {:else if auditEntries.length === 0}
      <div class="empty">No audit entries match filter</div>
    {:else}
      <table class="audit-table">
        <thead>
          <tr>
            <th>Date</th><th>Document</th><th>Transition</th><th>Actor</th><th>Type</th><th>Gate</th>
          </tr>
        </thead>
        <tbody>
          {#each auditEntries as e}
            <tr class="audit-row" onclick={() => goto('/' + e.doc_path.replace(/\.md$/, ''))}>
              <td class="col-date">{e.ts.slice(0, 10)}</td>
              <td class="col-doc">{e.doc_path}</td>
              <td class="col-transition">{e.transition_from} → {e.transition_to}</td>
              <td class="col-actor">{e.actor}</td>
              <td><span class="tag">{e.actor_type}</span></td>
              <td class="col-gate">{e.gate_id || '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if auditTotal > auditEntries.length}
        <div class="empty muted">Showing {auditEntries.length} of {auditTotal} entries</div>
      {/if}
    {/if}
  </section>
</div>

<style lang="scss">
  @use '../../lib/tokens' as *;

  .audit-page { padding: 32px; }
  .audit-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  h1 { font-size: 20px; font-weight: 600; color: $fg; margin: 0; flex: 1; }

  .refresh-btn {
    @include flat-btn;
    border: 1px solid $border; border-radius: 4px; padding: 2px 8px; font-size: 14px;
    &:hover { border-color: $muted; }
  }

  .audit-section {
    margin-bottom: 24px; border: 1px solid $border; border-radius: 6px; overflow: hidden;
  }

  .section-title-row {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px; background: var(--bg-header, #1a1a1a);
    border-bottom: 1px solid $border;
  }
  .section-title { font-size: 13px; font-weight: 600; color: $fg; flex: 1; }
  .section-hint  { padding: 6px 16px 10px; font-size: 11px; color: $muted; margin: 0; }

  .gate-audit-btn {
    background: $blue-bg; border: 1px solid $blue-bdr; color: #7ab;
    border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; white-space: nowrap;
    &:hover { filter: brightness(1.15); }
    &:disabled { opacity: 0.5; cursor: default; }
  }

  .badge { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: $bg-3; color: $muted; border: 1px solid $border; }
  .badge-warn { background: #2a2000; color: $amber; border-color: $amber-bdr; }
  .badge-ok   { background: $green-bg; color: $green; border-color: $green-bdr; }

  .findings-list { border-top: 1px solid $border; }
  .finding-item {
    padding: 8px 16px; cursor: pointer; border-bottom: 1px solid $border;
    &:hover { background: $bg-hover; }
    &:last-child { border-bottom: none; }
  }
  .finding-title { font-size: 12px; color: $fg; font-weight: 500; margin-bottom: 3px; }
  .finding-meta  { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 10px; color: $muted; }
  .gate-badge    { background: #2a2000; color: $amber; border: 1px solid $amber-bdr; border-radius: 4px; padding: 0 5px; font-family: monospace; font-size: 10px; }

  .filter-row {
    display: flex; gap: 6px; padding: 10px 16px; flex-wrap: wrap;
    background: $bg; border-bottom: 1px solid $border;
  }
  .filter-input  { @include inline-input; font-size: 11px; padding: 4px 8px; flex: 1; min-width: 120px; border-radius: 4px; &:focus { border-color: $muted; } }
  .filter-select { background: $bg-2; border: 1px solid $border; border-radius: 4px; color: $fg-dim; font-size: 11px; padding: 4px 6px; }

  .audit-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .audit-table thead tr { border-bottom: 1px solid $border; }
  .audit-table th { padding: 6px 16px; text-align: left; color: $muted; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .audit-row { cursor: pointer; border-bottom: 1px solid $bg-hover; &:hover { background: $bg-hover; } }
  .audit-row td { padding: 7px 16px; color: $fg-dim; }

  .col-date       { color: $muted; font-size: 11px; white-space: nowrap; }
  .col-doc        { font-family: monospace; font-size: 10px; color: $muted; }
  .col-transition { white-space: nowrap; }
  .col-actor      { color: $fg; }
  .col-gate       { font-family: monospace; font-size: 10px; color: $muted; }

  .tag   { display: inline-block; background: $tag-bg; border: 1px solid $tag-bdr; border-radius: 8px; padding: 0 6px; font-size: 10px; color: $tag; }
  .empty { padding: 10px 16px; font-size: 12px; color: $muted; }
  .muted { color: $muted; }

  :global(html[data-theme="light"]) {
    .audit-section { border-color: #d0d0d0; }
    .section-title-row { background: #e8e8e8; border-bottom-color: #d0d0d0; }
    .section-title { color: #1a1a1a; }
    .section-hint  { color: #888; }
    .gate-audit-btn { background: #ddeeff; border-color: #aaccee; color: #2a6090; &:hover { background: #cce0ff; } }
    .filter-row { background: #f0f0f0; border-bottom-color: #d0d0d0; }
    .filter-input, .filter-select { background: #fff; border-color: #ccc; color: #333; }
    .audit-row { border-bottom-color: #ebebeb; &:hover { background: #f5f5f5; } td { color: #444; } }
    .col-doc, .col-date, .col-gate { color: #888; }
    .col-actor { color: #1a1a1a; }
    .finding-item { border-bottom-color: #ebebeb; &:hover { background: #f5f5f5; } }
    .finding-title { color: #1a1a1a; }
    .badge { background: #e0e0e0; color: #555; border-color: #ccc; }
    .badge-warn { background: #fff8cc; color: #7a6000; border-color: #e8d400; }
    .badge-ok   { background: #e8f5e8; color: #2a7a2a; border-color: #8ac88a; }
  }
</style>
