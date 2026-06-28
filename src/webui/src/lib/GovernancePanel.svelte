<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { govSearchQuery } from '$lib/govVc.js';

  type SubView = 'status' | 'policies' | 'lifecycle' | 'hooks' | 'profile';

  const SUB_VIEWS: { id: SubView; icon: string; label: string }[] = [
    { id: 'status',    icon: '📊', label: 'Status' },
    { id: 'policies',  icon: '📜', label: 'Policies' },
    { id: 'lifecycle', icon: '🔄', label: 'Lifecycle' },
    { id: 'hooks',     icon: '🔌', label: 'Hooks' },
    { id: 'profile',   icon: '⚙',  label: 'Profile' },
  ];

  interface DocEntry { path: string; title: string; status: string; priority?: string; }
  interface TreeItem { name: string; path: string; type: 'dir' | 'file'; children?: TreeItem[]; }

  let subView = $state<SubView>('status');
  let searchQuery = $state('');

  // Status data
  let activePlans      = $state<DocEntry[]>([]);
  let openProposals    = $state<DocEntry[]>([]);
  let approvedPending  = $state<DocEntry[]>([]);
  let completedCount   = $state(0);

  // Policies tree (absorbed from PoliciesPanel)
  let policyTree   = $state<TreeItem | null>(null);
  let collapsed    = $state<Set<string>>(new Set());

  // Profile
  let profileConfig = $state<{ name?: string; version?: string; documentTypes?: string[] } | null>(null);

  // Loading
  let loading = $state(true);

  const bridge = () => (window as any).__docwright?.bridge;
  const currentPath = $derived($page.url.pathname);

  function navigate(path: string) {
    bridge()?.navigate('/' + path.replace(/\.md$/, '').replace(/^\//, ''));
  }

  function toggleDir(dirPath: string) {
    const next = new Set(collapsed);
    if (next.has(dirPath)) next.delete(dirPath);
    else next.add(dirPath);
    collapsed = next;
  }

  function titleFromName(name: string): string {
    return name.replace(/\.md$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  async function loadAll() {
    loading = true;
    try {
      const [statusRes, listRes, profileRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/list'),
        fetch('/api/profile-config'),
      ]);

      if (statusRes.ok) {
        const d = await statusRes.json();
        activePlans     = d.plans?.active ?? [];
        openProposals   = d.proposals?.open ?? [];
        approvedPending = d.proposals?.approved_pending ?? [];
        completedCount  = d.plans?.completed_count ?? 0;
      }
      if (listRes.ok) {
        const tree: TreeItem[] = await listRes.json();
        policyTree = tree.find(n => n.name === 'policies' && n.type === 'dir') ?? null;
      }
      if (profileRes.ok) {
        profileConfig = await profileRes.json();
      }
    } catch { /* non-fatal */ }
    loading = false;
  }

  onMount(() => {
    loadAll();
    return govSearchQuery.subscribe(q => { searchQuery = q; });
  });

  // Filtered helpers
  function filterByQuery<T extends { title?: string; name?: string; path: string }>(
    items: T[]
  ): T[] {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => (i.title ?? i.name ?? i.path).toLowerCase().includes(q));
  }

  function filterPolicyTree(item: TreeItem): TreeItem | null {
    if (!searchQuery) return item;
    const q = searchQuery.toLowerCase();
    if (item.type === 'file') {
      return item.name.toLowerCase().includes(q) ? item : null;
    }
    const filteredChildren = (item.children ?? [])
      .map(c => filterPolicyTree(c))
      .filter((c): c is TreeItem => c !== null);
    if (filteredChildren.length === 0 && !item.name.toLowerCase().includes(q)) return null;
    return { ...item, children: filteredChildren };
  }

  let filteredPolicyTree = $derived(policyTree ? filterPolicyTree(policyTree) : null);
  let filteredPlans      = $derived(filterByQuery(activePlans));
  let filteredProposals  = $derived(filterByQuery([...approvedPending, ...openProposals]));
</script>

<!-- Sub-view navigation strip -->
<div class="gov-nav">
  {#each SUB_VIEWS as sv}
    <button
      class="gov-nav-btn"
      class:active={subView === sv.id}
      title={sv.label}
      onclick={() => subView = sv.id}
    >
      <span class="gov-nav-icon">{sv.icon}</span>
      <span class="gov-nav-label">{sv.label}</span>
    </button>
  {/each}
</div>

<div class="gov-content">

  <!-- ── Status ─────────────────────────────────────────────── -->
  {#if subView === 'status'}
    {#if loading}
      <div class="gov-loading">Loading…</div>
    {:else}
      <div class="gov-section-title">Vault Overview</div>
      <div class="gov-stat-grid">
        <div class="gov-stat">
          <span class="gov-stat-n">{activePlans.length}</span>
          <span class="gov-stat-l">Active Plans</span>
        </div>
        <div class="gov-stat">
          <span class="gov-stat-n">{openProposals.length}</span>
          <span class="gov-stat-l">Open Proposals</span>
        </div>
        <div class="gov-stat">
          <span class="gov-stat-n">{approvedPending.length}</span>
          <span class="gov-stat-l">Pending Approval</span>
        </div>
        <div class="gov-stat">
          <span class="gov-stat-n">{completedCount}</span>
          <span class="gov-stat-l">Completed Plans</span>
        </div>
      </div>
      <button class="gov-open-status" onclick={() => bridge()?.navigate('/status')}>
        Open full dashboard →
      </button>
      {#if activePlans.length > 0}
        <div class="gov-section-title" style="margin-top:12px">Active Plans</div>
        {#each activePlans as plan}
          <button class="gov-item" onclick={() => navigate(plan.path)}>
            <span class="gov-item-title">{plan.title}</span>
            <span class="gov-badge badge-{plan.status?.replace('-','')}">
              {plan.status}
            </span>
          </button>
        {/each}
      {/if}
    {/if}

  <!-- ── Policies ────────────────────────────────────────────── -->
  {:else if subView === 'policies'}
    {#if loading}
      <div class="gov-loading">Loading…</div>
    {:else if !filteredPolicyTree}
      <div class="gov-empty">
        {searchQuery ? `No policies match "${searchQuery}"` : 'No policies/ directory found.'}
      </div>
    {:else}
      <ul class="pol-list">
        {#each (filteredPolicyTree.children ?? []) as item}
          {#if item.type === 'dir'}
            <li class="pol-cat">
              <button class="pol-cat-hdr" onclick={() => toggleDir(item.path)}>
                <span class="pol-arrow">{collapsed.has(item.path) ? '▶' : '▼'}</span>
                <span class="pol-cat-label">
                  {item.name.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                </span>
                <span class="pol-count">{item.children?.filter(c=>c.type==='file').length??0}</span>
              </button>
              {#if !collapsed.has(item.path)}
                <ul class="pol-files">
                  {#each (item.children??[]).filter(c=>c.type==='file') as file}
                    <li class="pol-file"
                      class:active={'/' + file.path.replace(/\.md$/,'') === currentPath}
                      onclick={() => navigate(file.path)}>
                      {titleFromName(file.name)}
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {:else}
            <li class="pol-file pol-root-file"
              class:active={'/' + item.path.replace(/\.md$/,'') === currentPath}
              onclick={() => navigate(item.path)}>
              {titleFromName(item.name)}
            </li>
          {/if}
        {/each}
      </ul>
    {/if}

  <!-- ── Lifecycle ───────────────────────────────────────────── -->
  {:else if subView === 'lifecycle'}
    {#if loading}
      <div class="gov-loading">Loading…</div>
    {:else}
      {#if filteredProposals.length > 0}
        <div class="gov-section-title">Proposals</div>
        {#each filteredProposals as p}
          <button class="gov-item" onclick={() => navigate(p.path)}>
            <span class="gov-item-title">{p.title}</span>
            <span class="gov-badge badge-{p.status?.replace('-','')}">
              {p.status === 'approved' ? 'approved' : 'open'}
            </span>
          </button>
        {/each}
      {/if}
      {#if filteredPlans.length > 0}
        <div class="gov-section-title" style="margin-top:{filteredProposals.length?'8px':'0'}">Plans</div>
        {#each filteredPlans as p}
          <button class="gov-item" onclick={() => navigate(p.path)}>
            <span class="gov-item-title">{p.title}</span>
            <span class="gov-badge badge-{p.status?.replace('-','')}">
              {p.status}
            </span>
          </button>
        {/each}
      {/if}
      {#if filteredProposals.length === 0 && filteredPlans.length === 0}
        <div class="gov-empty">
          {searchQuery ? `No items match "${searchQuery}"` : 'No active proposals or plans.'}
        </div>
      {/if}
    {/if}

  <!-- ── Hooks ──────────────────────────────────────────────── -->
  {:else if subView === 'hooks'}
    <div class="gov-placeholder">
      <div class="gov-placeholder-icon">🔌</div>
      <div class="gov-placeholder-title">Hook Status</div>
      <div class="gov-placeholder-body">
        Policy hook execution engine is planned.<br>
        Policies will declare <code>hooks:</code> in frontmatter;<br>
        plugins register listeners via the bridge API.
      </div>
    </div>

  <!-- ── Profile ────────────────────────────────────────────── -->
  {:else if subView === 'profile'}
    {#if loading}
      <div class="gov-loading">Loading…</div>
    {:else if profileConfig}
      <div class="gov-section-title">Active Profile</div>
      <div class="gov-profile-name">{profileConfig.name ?? 'org-operations'}</div>
      {#if profileConfig.version}
        <div class="gov-profile-meta">v{profileConfig.version}</div>
      {/if}
      {#if profileConfig.documentTypes?.length}
        <div class="gov-section-title" style="margin-top:12px">Document Types</div>
        {#each profileConfig.documentTypes as dt}
          <div class="gov-profile-type">📄 {dt}</div>
        {/each}
      {/if}
    {:else}
      <div class="gov-empty">No profile configuration found.</div>
    {/if}
  {/if}

</div>

<style lang="scss">
  @use 'tokens' as *;

  /* ── Nav strip ─────────────────────────────────────────── */
  .gov-nav {
    display: flex;
    border-bottom: 1px solid $border;
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
  .gov-nav-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 4px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: $muted;
    cursor: pointer;
    font-size: 10px;
    min-width: 44px;
    transition: color 0.12s, border-color 0.12s;
    &:hover { color: $fg-dim; background: $bg-hover; }
    &.active { color: $accent; border-bottom-color: $accent; }
  }
  .gov-nav-icon { font-size: 14px; line-height: 1; }
  .gov-nav-label { font-size: 9px; letter-spacing: 0.3px; text-transform: uppercase; }

  /* ── Content area ─────────────────────────────────────── */
  .gov-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .gov-loading { padding: 20px 16px; font-size: 12px; color: $muted; text-align: center; }
  .gov-empty   { padding: 20px 16px; font-size: 12px; color: $muted; text-align: center; }

  /* ── Status sub-view ───────────────────────────────────── */
  .gov-section-title {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.4px; color: $muted;
    padding: 8px 12px 4px;
  }
  .gov-stat-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 6px; padding: 6px 10px;
  }
  .gov-stat {
    background: $bg-2; border: 1px solid $border; border-radius: 6px;
    padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;
  }
  .gov-stat-n { font-size: 20px; font-weight: 700; color: $accent; line-height: 1; }
  .gov-stat-l { font-size: 10px; color: $muted; }
  .gov-open-status {
    margin: 6px 10px 0;
    background: none; border: 1px solid $border; border-radius: 4px;
    color: $accent; font-size: 11px; padding: 5px 10px; cursor: pointer;
    text-align: left; width: calc(100% - 20px);
    &:hover { background: $bg-2; border-color: $accent; }
  }

  /* ── Shared item row ───────────────────────────────────── */
  .gov-item {
    display: flex; align-items: center; gap: 6px;
    width: 100%; background: none; border: none;
    padding: 5px 12px; cursor: pointer; text-align: left;
    &:hover { background: $bg-hover; }
  }
  .gov-item-title {
    flex: 1; font-size: 12px; color: $fg-dim;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .gov-badge {
    font-size: 9px; padding: 1px 5px; border-radius: 8px;
    flex-shrink: 0; font-weight: 600; text-transform: uppercase;
    background: $bg-3; color: $muted;
  }
  .badge-inprogress { background: $blue-bg;   color: $blue; }
  .badge-approved   { background: $green-bg;  color: $green; }
  .badge-open       { background: $bg-3;      color: $muted; }
  .badge-completed  { background: $bg-3;      color: $muted; }

  /* ── Policies sub-view (absorbed from PoliciesPanel) ───── */
  .pol-list, .pol-files { list-style: none; margin: 0; padding: 0; }
  .pol-cat { border-bottom: 1px solid $border; }
  .pol-cat-hdr {
    display: flex; align-items: center; gap: 6px;
    width: 100%; padding: 7px 12px;
    background: none; border: none; cursor: pointer;
    color: $muted; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.4px; text-align: left;
    &:hover { background: $bg-hover; }
  }
  .pol-arrow { font-size: 9px; opacity: 0.6; }
  .pol-cat-label { flex: 1; }
  .pol-count {
    font-size: 10px; background: $bg-3; color: $muted;
    padding: 1px 5px; border-radius: 8px;
  }
  .pol-file {
    padding: 6px 12px 6px 24px;
    font-size: 12px; color: $fg; cursor: pointer;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    &:hover { background: $bg-hover; }
    &.active { color: $accent; background: $bg-2; }
  }
  .pol-root-file { padding-left: 12px; }

  /* ── Hooks placeholder ─────────────────────────────────── */
  .gov-placeholder {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 8px; padding: 24px; text-align: center; color: $muted;
  }
  .gov-placeholder-icon  { font-size: 36px; }
  .gov-placeholder-title { font-size: 13px; font-weight: 600; color: $fg-dim; }
  .gov-placeholder-body  { font-size: 11px; line-height: 1.6; code { font-size: 10px; } }

  /* ── Profile sub-view ──────────────────────────────────── */
  .gov-profile-name {
    font-size: 15px; font-weight: 700; color: $fg;
    padding: 4px 12px 2px;
  }
  .gov-profile-meta { font-size: 11px; color: $muted; padding: 0 12px 8px; }
  .gov-profile-type {
    font-size: 12px; color: $fg-dim; padding: 4px 12px;
    &:hover { background: $bg-hover; }
  }

  /* ── Light theme ───────────────────────────────────────── */
  :global(html[data-theme="light"]) {
    .gov-nav-btn { &:hover { background: #ededf0; } }
    .gov-stat { background: #f4f4f8; border-color: #d0d0d0; }
    .gov-open-status { border-color: #ccc; &:hover { background: #f0f0f8; } }
    .gov-item:hover { background: #ededf0; }
    .pol-cat-hdr:hover, .pol-file:hover { background: #ededf0; }
    .pol-file.active { background: #dce8ff; }
  }
</style>
