<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fileChanged } from '$lib/fileChanges';

  interface DocEntry {
    path: string; title: string; created: string;
    tags: string[]; category: string[]; complexity: string;
    status: string; priority: string; assigned_to: string;
  }
  interface StatusData {
    vaultName: string;
    proposals: { open: DocEntry[]; approved_pending: DocEntry[]; deferred: DocEntry[] };
    plans: { active: DocEntry[]; completed_count: number };
  }

  let data = $state<StatusData | null>(null);
  let loading = $state(true);

  // Collapsed state per section, persisted in sessionStorage
  const SECTIONS = ['open-proposals', 'approved-pending', 'active-plans', 'completed', 'deferred'];
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
    return fileChanged.subscribe((change) => {
      if (change) load();
    });
  });

  function navTo(entry: DocEntry) {
    goto('/' + entry.path.replace(/\.md$/, ''));
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
    <button class="refresh-btn" onclick={load} title="Refresh">↻</button>
  </div>

  {#if loading && !data}
    <div class="loading">Scanning vault…</div>
  {:else if data}

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

  {/if}
</div>

<style>
  .status-page { padding: 32px; }

  .status-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  h1 { font-size: 20px; font-weight: 600; color: #fff; margin: 0; }
  .refresh-btn { background: none; border: 1px solid #333; color: #666; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 14px; }
  .refresh-btn:hover { color: #aaa; border-color: #555; }

  .loading { color: #555; padding: 16px 0; font-size: 13px; }

  .section { margin-bottom: 8px; border: 1px solid #222; border-radius: 6px; overflow: hidden; }

  .section-header {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 10px 16px;
    background: #161616; border: none; color: #ccc;
    font-size: 13px; font-weight: 600; cursor: pointer; text-align: left;
  }
  .section-header:hover { background: #1c1c1c; }
  .section-title { flex: 1; }
  .chevron { color: #444; font-size: 11px; }

  .badge {
    font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px;
    background: #222; color: #666; border: 1px solid #333;
  }
  .badge-active   { background: #1a3a5a; color: #58a6ff; border-color: #2b5b84; }
  .badge-approved { background: #1a2a3a; color: #7ab; border-color: #2a4a6a; }
  .badge-done     { background: #1a3a1a; color: #6d6; border-color: #2b5b2b; }
  .badge-canceled { background: #2a1a1a; color: #966; border-color: #4a2a2a; }
  .badge-warn     { background: #2a2000; color: #cc6; border-color: #554400; }
  .badge-default  { background: #1a1a1a; color: #555; border-color: #333; }

  .empty { padding: 10px 16px; font-size: 12px; color: #555; }
  .muted { color: #444; }
  .link { color: #58a6ff; text-decoration: none; }
  .link:hover { text-decoration: underline; }

  .items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .items-table thead tr { border-bottom: 1px solid #222; }
  .items-table th { padding: 6px 16px; text-align: left; color: #555; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .item-row { cursor: pointer; border-bottom: 1px solid #1a1a1a; }
  .item-row:hover { background: #1c1c1c; }
  .item-row td { padding: 8px 16px; color: #aaa; }
  .item-title { color: #ddd; font-weight: 500; }
  .item-date { color: #555; font-size: 11px; }

  .tag { display: inline-block; background: #1e2a3a; border: 1px solid #2b3a4a; border-radius: 8px; padding: 0 6px; font-size: 10px; color: #7ab; margin-right: 3px; }
  .complexity { display: inline-block; background: #222; border: 1px solid #333; border-radius: 4px; padding: 0 5px; font-size: 10px; color: #888; }

  .pri { font-size: 11px; }
  .pri-high { color: #e87; }
  .pri-med  { color: #cc6; }
  .pri-low  { color: #888; }

  .deferred-list { padding: 6px 16px 10px; display: flex; flex-direction: column; gap: 4px; }
  .deferred-item { background: none; border: none; color: #444; font-size: 12px; text-align: left; cursor: pointer; padding: 2px 0; }
  .deferred-item:hover { color: #888; }
</style>
