<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { fileChanged } from '$lib/fileChanges';
  import FunnelView from '$lib/FunnelView.svelte';
  import KnowledgeGraph from '$lib/KnowledgeGraph.svelte';

  interface DocEntry {
    path: string; title: string; created: string;
    tags: string[]; category: string[]; complexity: string;
    status: string; priority: string; assigned_to: string;
    depends_on?: string[]; phase?: string | null;
    branch?: string;
    demandCount: number; githubIssue: string; reportedDates: string[];
  }
  interface OpenPR {
    number: number; title: string; url: string;
    author: string; headRefName: string;
    mergeable: string; ciState: string; reviewState: string;
    planPath: string | null; planTitle: string | null;
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
  interface ResearchEntry {
    path: string; title: string; question: string; created: string;
    conclusion?: string;
  }
  interface PhaseReviewPlan {
    path: string; title: string; phase: number;
    status: string; reviewDate: string; needsReview: boolean;
    activeWorkCount: number; canReview: boolean;
  }
  interface PhaseReview {
    required: boolean;
    gatedPhase: number;
    gatedPlanTitle: string;
    completedDate: string;
    plans: PhaseReviewPlan[];
  }
  interface StatusData {
    vaultName: string;
    version: string;
    currentPhase: number;
    phasePlans: PhasePlan[];
    proposals: { open: DocEntry[]; approved_pending: DocEntry[]; deferred: DocEntry[] };
    plans: { draft: DocEntry[]; active: DocEntry[]; completed_count: number; completed?: DocEntry[] };
    gates: { pending: PendingGate[]; waived: WaivedGate[]; overdue: OverdueGate[] };
    research: {
      active: ResearchEntry[];
      recent_conclusions: ResearchEntry[];
      no_research_proposals: { path: string; title: string }[];
    };
    phaseReview: PhaseReview | null;
    issues?: { open: DocEntry[] };
    heatmap?: DocEntry[];
    openPRs?: OpenPR[];
    roadplan?: {
      current: { name: string; items: any[] };
      next: { name: string; items: any[] };
      future: { name: string; items: any[] };
    };
    releaseReadiness?: any;
    friction?: {
      total: number;
      aged: { date: string; category: string; severity: string; description: string }[];
      cadence_days: number;
    };
  }

  let data = $state<StatusData | null>(null);
  let loading = $state(true);
  let heatmapWindow = $state<'all' | '30d'>('all');

  type ViewMode = 'list' | 'funnel' | 'graph' | 'roadplan';
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
  const SECTIONS = ['active-plans', 'approved-pending', 'open-proposals', 'research', 'deferred', 'completed'];
  function isCollapsed(key: string): boolean {
    if (typeof sessionStorage === 'undefined') return true;
    const val = sessionStorage.getItem('status-collapsed-' + key);
    return val !== null ? val === 'true' : true;
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
    const res = await fetch(`/api/status?window=${heatmapWindow}`);
    if (res.ok) data = await res.json();
    loading = false;
  }

  function toggleHeatmapWindow() {
    heatmapWindow = heatmapWindow === 'all' ? '30d' : 'all';
    load();
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

  // Phase gate review
  let phaseReviewBusy = $state<Record<string, boolean>>({});
  async function markPhaseReviewed(planPath: string) {
    phaseReviewBusy = { ...phaseReviewBusy, [planPath]: true };
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch('/api/lifecycle/phase-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_path: planPath, review_date: today }),
    });
    phaseReviewBusy = { ...phaseReviewBusy, [planPath]: false };
    if (res.ok) load();
  }

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

  let promoting = $state(false);
  async function promoteChannel(targetChannel: 'beta' | 'stable') {
    if (!data?.releaseReadiness) return;
    promoting = true;
    const res = await fetch('/api/release/channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestone: data.releaseReadiness.milestone,
        channel: targetChannel,
      }),
    });
    promoting = false;
    if (res.ok) {
      load();
    } else {
      const err = await res.json();
      alert('Promotion failed: ' + (err.error || 'Unknown error'));
    }
  }

  // Calculate which release criteria are blocking promotion
  let releaseBlockers = $derived.by(() => {
    if (!data?.releaseReadiness) return [];
    const blockers: Array<{criterion: string; reason: string; details: string}> = [];

    if (data.releaseReadiness.blockers.count > 0) {
      blockers.push({
        criterion: 'Blockers',
        reason: `${data.releaseReadiness.blockers.count} blocker${data.releaseReadiness.blockers.count !== 1 ? 's' : ''}`,
        details: data.releaseReadiness.blockers.items?.map((i: any) => i.title).join(', ') || 'Open blockers'
      });
    }

    if (data.releaseReadiness.majors.count > 0) {
      blockers.push({
        criterion: 'Majors',
        reason: `${data.releaseReadiness.majors.count} major${data.releaseReadiness.majors.count !== 1 ? 's' : ''}`,
        details: data.releaseReadiness.majors.items?.map((i: any) => i.title).join(', ') || 'Open majors'
      });
    }

    if (!data.releaseReadiness.dogfoodWindow.passed) {
      const daysRemaining = data.releaseReadiness.dogfoodWindow.requiredDays - data.releaseReadiness.dogfoodWindow.actualDays;
      blockers.push({
        criterion: 'Dogfood Window',
        reason: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`,
        details: `Started ${data.releaseReadiness.dogfoodWindow.startDate}`
      });
    }

    if (!data.releaseReadiness.burndown.passed) {
      const total = data.releaseReadiness.burndown.resolved + data.releaseReadiness.burndown.open;
      const percent = Math.round((data.releaseReadiness.burndown.resolved / (total || 1)) * 100);
      const targetPercent = 90; // assumed standard
      blockers.push({
        criterion: 'Burn-down',
        reason: `${percent}% complete (need ${targetPercent}%)`,
        details: `${data.releaseReadiness.burndown.open} issue${data.releaseReadiness.burndown.open !== 1 ? 's' : ''} remaining`
      });
    }

    return blockers;
  });

  let showReportBugModal = $state(false);
  let bugTitle = $state('');
  let bugDesc = $state('');
  let bugReporter = $state('NetYeti');
  let bugPriority = $state<'low' | 'medium' | 'high'>('medium');
  let bugSysInfo = $state('');
  let reportSubmitting = $state(false);
  // Two-phase suggest flow (#68 §3 / #92): 'form' collects the report; 'suggest' shows
  // similar open bugs so the reporter answers "is one of these yours?" — never auto-rejected.
  interface DupSuggestion { path: string; title: string; score: number; demandCount: number; source: 'local' | 'gh'; ghIssueNumber?: number; }
  let reportStep = $state<'form' | 'suggest'>('form');
  let bugSuggestions = $state<DupSuggestion[]>([]);

  function reportPayload() {
    return {
      title: bugTitle, description: bugDesc, reporter: bugReporter,
      priority: bugPriority, system_info: bugSysInfo,
    };
  }

  let approvingDraft = $state<Record<string, boolean>>({});
  async function approveDraft(planPath: string) {
    approvingDraft = { ...approvingDraft, [planPath]: true };
    const res = await fetch('/api/approve-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: planPath }),
    });
    approvingDraft = { ...approvingDraft, [planPath]: false };
    if (res.ok) load();
    else {
      const err = await res.json().catch(() => ({ error: 'unknown error' }));
      alert('Failed to approve: ' + (err.error || 'Unknown error'));
    }
  }

  let promotingIssues = $state<Record<string, boolean>>({});
  async function promoteToGH(issuePath: string) {
    promotingIssues = { ...promotingIssues, [issuePath]: true };
    try {
      const res = await fetch('/api/issues/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuePath }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Promoted to GitHub: ${data.url}`);
        load();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch {
      alert('❌ Network error promoting to GitHub');
    } finally {
      promotingIssues = { ...promotingIssues, [issuePath]: false };
    }
  }

  function resetReport() {
    showReportBugModal = false;
    reportStep = 'form';
    bugSuggestions = [];
    bugTitle = ''; bugDesc = ''; bugPriority = 'medium'; bugSysInfo = '';
  }

  // Phase 1 — ask for suggestions (read-only). If any, show them; if none, file directly.
  async function submitBugReport(e: Event) {
    e.preventDefault();
    if (!bugTitle.trim() || !bugDesc.trim() || !bugReporter.trim()) return;
    reportSubmitting = true;
    try {
      const res = await fetch('/api/issues/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bugTitle }),
      });
      if (!res.ok) { alert('Failed to check for duplicates: ' + ((await res.json()).error || 'Unknown')); return; }
      const { suggestions } = await res.json();
      if (suggestions && suggestions.length > 0) {
        bugSuggestions = suggestions;
        reportStep = 'suggest';
      } else {
        await fileNewBug([]);
      }
    } finally {
      reportSubmitting = false;
    }
  }

  // Phase 2a — reporter picked an existing bug: +1 demand + harvest context.
  async function confirmExisting(canonicalPath: string) {
    reportSubmitting = true;
    try {
      const res = await fetch('/api/issues/report/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalPath, ...reportPayload() }),
      });
      const r = await res.json();
      if (res.ok) { alert(`Thanks — added your context to ${r.path} (demand now ${r.demandCount}).`); resetReport(); load(); }
      else alert('Failed: ' + (r.error || 'Unknown error'));
    } finally { reportSubmitting = false; }
  }

  // Phase 2b — none matched: file a new bug, associating the near-misses shown.
  async function fileNewBug(related: string[]) {
    reportSubmitting = true;
    try {
      const res = await fetch('/api/issues/report/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reportPayload(), related }),
      });
      const r = await res.json();
      if (res.ok) { alert(`Bug report filed at ${r.path}.`); resetReport(); load(); }
      else alert('Failed to file bug: ' + (r.error || 'Unknown error'));
    } finally { reportSubmitting = false; }
  }

  function statusEmoji(status: string): string {
    const s = status.toLowerCase();
    if (s === 'completed')  return '✅';
    if (s === 'canceled')   return '❌';
    if (s === 'in-progress') return '⏳';
    if (s === 'blocked')    return '🚧';
    if (s === 'approved')   return '👍';
    if (s === 'draft' || s === '') return '📋';
    return '📋';
  }

  function statusBadgeClass(status: string): string {
    if (status === 'in-progress') return 'badge-active';
    if (status === 'approved')    return 'badge-approved';
    if (status === 'completed')   return 'badge-done';
    if (status === 'canceled')    return 'badge-canceled';
    return 'badge-default';
  }

  function isReleaseItem(path: string): boolean {
    return (data?.releaseTarget?.items ?? []).some((i: any) => i.path === path);
  }

  function priorityClass(p: string): string {
    if (p === 'critical') return 'pri-critical';
    if (p === 'high')     return 'pri-high';
    if (p === 'medium')   return 'pri-med';
    return 'pri-low';
  }

  // Group active plans by phase for display
  let activePlansByPhase = $derived.by(() => {
    const plans = data?.plans.active ?? [];
    const groups = new Map<string, DocEntry[]>();
    for (const p of plans) {
      const key = p.phase ? String(p.phase) : '__unassigned__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    // Sort phase keys: numeric phases first (ascending), then 'post-alpha', then unassigned
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === '__unassigned__') return 1;
      if (b === '__unassigned__') return -1;
      const na = parseInt(a, 10), nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return 1;
      return a.localeCompare(b);
    });
    return keys.map(k => ({ phase: k, plans: groups.get(k)! }));
  });

  $effect(() => {
    const focusSection = $page.url.searchParams.get('section');
    if (focusSection && SECTIONS.includes(focusSection)) {
      const nextCollapsed: Record<string, boolean> = {};
      for (const k of SECTIONS) {
        nextCollapsed[k] = (k !== focusSection);
      }
      collapsed = nextCollapsed;

      setTimeout(() => {
        const el = document.getElementById('section-' + focusSection);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  });
</script>

<div class="status-page">
  <div class="status-header">
    <h1>{data?.vaultName ?? 'Vault'} Status</h1>
    <div class="view-toggle">
      <button class="view-btn" class:active={viewMode === 'list'}   onclick={() => setView('list')}   title="List view">≡ List</button>
      <button class="view-btn" class:active={viewMode === 'funnel'} onclick={() => setView('funnel')} title="Funnel view">⊙ Funnel</button>
      <button class="view-btn" class:active={viewMode === 'graph'}  onclick={() => setView('graph')}  title="Knowledge graph">⬡ Graph</button>
      <button class="view-btn" class:active={viewMode === 'roadplan'} onclick={() => setView('roadplan')} title="Roadplan view">🗺 Roadplan</button>
      <a class="view-btn" href="/audit" title="Audit log">📊 Audit</a>
    </div>
    {#if data?.friction && data.friction.aged.length > 0}
      <a
        class="friction-badge"
        href="/docs/friction-log"
        title="{data.friction.aged.length} friction entr{data.friction.aged.length === 1 ? 'y' : 'ies'} past the {data.friction.cadence_days}-day review cadence with no upstream issue"
      >⚠ {data.friction.aged.length} aged friction</a>
    {/if}
    <button class="report-bug-btn" onclick={() => showReportBugModal = true} title="Report a Bug">🐞 Report Bug</button>
    <button class="refresh-btn" onclick={load} title="Refresh">↻</button>
  </div>

  {#if loading && !data}
    <div class="loading">Scanning vault…</div>
  {:else if data}

    {#if viewMode === 'graph'}
      <div class="graph-view">
        <KnowledgeGraph />
      </div>
    {:else if viewMode === 'funnel'}
      <FunnelView
        deferred={data.proposals.deferred}
        open={data.proposals.open}
        approved={data.proposals.approved_pending}
        active={data.plans.active}
        completedCount={data.plans.completed_count}
      />
    {:else if viewMode === 'roadplan'}
      <div class="roadplan-container">
        {#if data.releaseTarget}
          <div class="release-target-box">
            <div class="release-target-header">
              <h3>🎯 Current Release Target: <a href="/plans/{data.releaseTarget.planPath.replace(/\.md$/, '').replace('plans/', '')}">v{data.roadplan.current.name}</a></h3>
              <span class="release-target-badge" class:ready={data.releaseTarget.ready}>
                {data.releaseTarget.ready ? '✅ Ready' : `${data.releaseTarget.completedItems}/${data.releaseTarget.totalItems} Complete`}
              </span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {(data.releaseTarget.totalItems > 0 ? (data.releaseTarget.completedItems / data.releaseTarget.totalItems) * 100 : 0)}%"></div>
            </div>
            <div class="release-target-items">
              {#each data.releaseTarget.items as item}
                <a href="/{item.path.replace(/\.md$/, '')}" class="release-target-item" class:completed={item.completed}>
                  <span class="rti-status">{item.completed ? '✅' : '⏳'}</span>
                  <span class="rti-type-badge rti-{item.type}">{item.type}</span>
                  <span class="rti-title">{item.title}</span>
                  <span class="rti-status-text">{item.status || 'open'}</span>
                </a>
              {/each}
            </div>
          </div>
        {/if}
        {#if data.releaseReadiness}
          <div class="release-readiness-card">
            <div class="card-header">
              <div class="title-section">
                <h3>📦 Release Readiness & Governance Dashboard</h3>
                <span class="milestone-badge" title="Target release milestone (not the current DocWright version)">Target: {data.releaseReadiness.milestone}</span>
              </div>
              <div class="channel-section">
                <span class="channel-label">Channel:</span>
                <span class="channel-badge {data.releaseReadiness.channel}">
                  {data.releaseReadiness.channel.toUpperCase()}
                </span>
              </div>
            </div>

            <div class="metrics-grid">
              <div class="metric-card" class:passed={data.releaseReadiness.blockers.count === 0}>
                <div class="metric-value">{data.releaseReadiness.blockers.count === 0 ? '✅' : '❌'} {data.releaseReadiness.blockers.count}</div>
                <div class="metric-label">Open Blockers (High/Critical)</div>
                {#if data.releaseReadiness.blockers.count > 0}
                  <div class="metric-sublist">
                    {#each data.releaseReadiness.blockers.items as item}
                      <a href="/{item.path.replace(/\.md$/, '')}" class="item-link">⚠️ {item.title}</a>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="metric-card" class:passed={data.releaseReadiness.majors.count === 0}>
                <div class="metric-value">{data.releaseReadiness.majors.count === 0 ? '✅' : '❌'} {data.releaseReadiness.majors.count}</div>
                <div class="metric-label">Open Majors (Demand ≥ 5)</div>
                {#if data.releaseReadiness.majors.count > 0}
                  <div class="metric-sublist">
                    {#each data.releaseReadiness.majors.items as item}
                      <a href="/{item.path.replace(/\.md$/, '')}" class="item-link">🚨 {item.title} (Demand: {item.demandCount})</a>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="metric-card" class:passed={data.releaseReadiness.dogfoodWindow.passed}>
                <div class="metric-value">{data.releaseReadiness.dogfoodWindow.passed ? '✅' : '❌'} {data.releaseReadiness.dogfoodWindow.actualDays}d / {data.releaseReadiness.dogfoodWindow.requiredDays}d</div>
                <div class="metric-label">Dogfood Window ({data.releaseReadiness.dogfoodWindow.startDate})</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {Math.min(100, (data.releaseReadiness.dogfoodWindow.actualDays / data.releaseReadiness.dogfoodWindow.requiredDays) * 100)}%"></div>
                </div>
              </div>

              <div class="metric-card" class:passed={data.releaseReadiness.burndown.passed}>
                <div class="metric-value">{data.releaseReadiness.burndown.passed ? '✅' : '❌'} {data.releaseReadiness.burndown.resolved} / {data.releaseReadiness.burndown.resolved + data.releaseReadiness.burndown.open}</div>
                <div class="metric-label">Milestone Burn-down Trend</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {(data.releaseReadiness.burndown.resolved / (data.releaseReadiness.burndown.resolved + data.releaseReadiness.burndown.open || 1)) * 100}%"></div>
                </div>
              </div>
            </div>

            <div class="card-footer">
              {#if data.releaseReadiness.ready}
                <div class="status-msg success">✨ Milestone satisfies all release criteria! Ready for promotion.</div>
              {:else}
                <div class="status-msg warning">
                  <div class="blocker-header">⏳ Release blocked by:</div>
                  <ul class="blocker-list">
                    {#each releaseBlockers as blocker}
                      <li>
                        <strong>{blocker.criterion}:</strong> {blocker.reason}
                        {#if blocker.details}
                          <div class="blocker-detail">{blocker.details}</div>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <div class="action-buttons">
                {#if data.releaseReadiness.channel === 'dev'}
                  <button class="promote-btn beta" disabled={promoting} onclick={() => promoteChannel('beta')}>
                    {promoting ? 'Promoting...' : '🚀 Promote to Beta (1/2)'}
                  </button>
                {:else if data.releaseReadiness.channel === 'beta'}
                  <button class="promote-btn stable" 
                          disabled={!data.releaseReadiness.ready || promoting}
                          class:disabled={!data.releaseReadiness.ready}
                          onclick={() => promoteChannel('stable')}>
                    {promoting ? 'Promoting...' : '🏆 Release to Stable (2/2)'}
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Most Reported Bugs Heatmap -->
        {#if data.heatmap && data.heatmap.length > 0}
          <div class="heatmap-card">
            <div class="card-header">
              <h3>🔥 Most Reported Bugs</h3>
              <div class="heatmap-controls">
                <span class="badge">{data.heatmap.length} items</span>
                <button class="window-toggle" onclick={toggleHeatmapWindow}>
                  {heatmapWindow === 'all' ? '📅 All time' : '📅 Last 30d'}
                </button>
              </div>
            </div>
            <div class="heatmap-grid">
              {#each data.heatmap as bug, i}
                {@const heatClass = bug.demandCount <= 2 ? 'cool' : bug.demandCount <= 4 ? 'warm' : 'hot'}
                <div class="heatmap-row">
                  <a href="/{bug.path.replace(/\.md$/, '')}" class="heatmap-item {heatClass}" title="{bug.title} — Demand: {bug.demandCount}">
                    <span class="heatmap-rank">#{i + 1}</span>
                    <span class="heatmap-title">{bug.title}</span>
                    <span class="heatmap-demand">{bug.demandCount}</span>
                  </a>
                  {#if bug.demandCount >= 3 && !bug.githubIssue}
                    <button class="gh-promote-btn" disabled={promotingIssues[bug.path]} onclick={() => promoteToGH(bug.path)} title="Promote to GitHub issue">{promotingIssues[bug.path] ? '...' : '⬆ GH'}</button>
                  {/if}
                  {#if bug.githubIssue}
                    <a href="https://github.com/growlf/docwright/issues/{bug.githubIssue}" class="gh-link" target="_blank" title="GitHub issue #{bug.githubIssue}">GH#{bug.githubIssue}</a>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if data.plans.draft && data.plans.draft.length > 0}
          <div class="roadplan-bucket-section">
            <div class="roadplan-bucket-header">
              <h2>⏳ Awaiting Approval</h2>
              <span class="badge badge-warn">{data.plans.draft.length}</span>
            </div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 60px;">Pri</th>
                  <th>Title</th>
                  <th>Phase</th>
                  <th style="width: 180px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each data.plans.draft as item}
                  <tr class="item-row" onclick={() => goto('/' + item.path.replace(/\.md$/, ''))}>
                    <td><span class="pri {priorityClass(item.priority)}">{item.priority || '—'}</span></td>
                    <td class="item-title-cell">
                      <span class="item-title">{item.title}</span>
                    </td>
                    <td>
                      {#if item.phase}
                        <span class="phase-tag">Phase {item.phase}</span>
                      {:else}
                        <span class="muted">—</span>
                      {/if}
                    </td>
                    <td>
                      <button class="approve-btn" disabled={approvingDraft[item.path]}
                        onclick={(e) => { e.stopPropagation(); approveDraft(item.path); }}>
                        {approvingDraft[item.path] ? '…' : '✓ Approve'}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#if data.openPRs && data.openPRs.length > 0}
          <div class="roadplan-bucket-section">
            <div class="roadplan-bucket-header">
              <h2>🔀 Open Pull Requests</h2>
              <span class="badge badge-active">{data.openPRs.length}</span>
            </div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 100px;">PR #</th>
                  <th>Title</th>
                  <th style="width: 90px;">CI</th>
                  <th style="width: 100px;">Review</th>
                  <th style="width: 80px;">Merge</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                {#each data.openPRs as pr}
                  <tr class="item-row" onclick={() => window.open(pr.url, '_blank')}>
                    <td><a href={pr.url} target="_blank" class="pr-link" onclick={(e) => e.stopPropagation()}>#{pr.number}</a></td>
                    <td class="item-title-cell">
                      <span class="item-title">{pr.title}</span>
                      <span class="item-deps">branch: {pr.headRefName}</span>
                    </td>
                    <td>
                      <span class="badge pr-ci-{pr.ciState}">
                        {pr.ciState === 'passing' ? '✓' : pr.ciState === 'failing' ? '✗' : '…'}
                      </span>
                    </td>
                    <td>
                      <span class="badge pr-review-{pr.reviewState}">
                        {pr.reviewState === 'approved' ? '✓ Approved' : pr.reviewState === 'changes-requested' ? '✗ Changes' : '– None'}
                      </span>
                    </td>
                    <td>
                      <span class="badge pr-merge-{pr.mergeable.toLowerCase()}">
                        {pr.mergeable === 'MERGEABLE' ? '✓ Ready' : pr.mergeable === 'CONFLICTING' ? '✗ Conflict' : '…'}
                      </span>
                    </td>
                    <td class="item-date">
                      {#if pr.planTitle}
                        <a href="/{pr.planPath?.replace(/\.md$/, '')}" class="pr-plan-link" onclick={(e) => e.stopPropagation()}>{pr.planTitle}</a>
                      {:else}
                        <span class="muted">—</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#if (data.issues?.open?.length ?? 0) + (data.proposals.open?.length ?? 0) > 0}
          <div class="roadplan-bucket-section">
            <div class="roadplan-bucket-header">
              <h2>📋 Action Items</h2>
              <span class="badge badge-warn">{(data.issues?.open?.length ?? 0) + (data.proposals.open?.length ?? 0)}</span>
            </div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 80px;">Type</th>
                  <th style="width: 60px;">Pri</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each data.proposals.open as p}
                  <tr class="item-row" onclick={() => goto('/' + p.path.replace(/\.md$/, ''))}>
                    <td><span class="cat-badge cat-thought">💭 Proposal</span></td>
                    <td><span class="pri {priorityClass(p.priority)}">{p.priority || '—'}</span></td>
                    <td class="item-title-cell"><span class="item-title">{p.title}</span></td>
                    <td><span class="badge badge-default">open</span></td>
                  </tr>
                {/each}
                {#each data.issues?.open ?? [] as issue}
                  <tr class="item-row" onclick={() => goto('/' + issue.path.replace(/\.md$/, ''))}>
                    <td><span class="cat-badge cat-bug">🐛 Issue</span></td>
                    <td><span class="pri {priorityClass(issue.priority)}">{issue.priority || '—'}</span></td>
                    <td class="item-title-cell"><span class="item-title">{issue.title}</span></td>
                    <td><span class="badge badge-default">{issue.status || 'open'}</span></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#each ['current', 'next', 'future'] as bucketKey}
          {@const bucket = data.roadplan?.[bucketKey]}
          {#if bucket}
            <div class="roadplan-bucket-section">
              <div class="roadplan-bucket-header">
                <h2>
                  {#if bucketKey === 'current'}
                    🎯 Current Milestone: {bucket.name}
                  {:else if bucketKey === 'next'}
                    🚀 Next Milestone: {bucket.name}
                  {:else}
                    🗺 {bucket.name}
                  {/if}
                </h2>
                <span class="badge">{bucket.items.length} item{bucket.items.length === 1 ? '' : 's'}</span>
              </div>

              {#if bucket.items.length === 0}
                <div class="empty">No items assigned to this milestone</div>
              {:else}
                <table class="items-table">
                  <thead>
                    <tr>
                      <th style="width: 80px;">Type</th>
                      <th style="width: 60px;">Pri</th>
                      <th>Title</th>
                      <th>Phase</th>
                      <th>Status</th>
                      <th>Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each bucket.items as item}
                      <tr class="item-row" onclick={() => goto('/' + item.path.replace(/\.md$/, ''))}>
                        <td>
                          <span class="cat-badge cat-{item.itemType === 'plan' ? 'feature' : 'bug'}">
                            {item.itemType === 'plan' ? '✨ Plan' : '🐛 Issue'}
                          </span>
                        </td>
                        <td>
                          <span class="pri {priorityClass(item.priority)}">{item.priority || '—'}</span>
                        </td>
                        <td class="item-title-cell">
                          <span class="item-title">{item.title}</span>
                          {#if item.depends_on && item.depends_on.length > 0}
                            <span class="item-deps">↳ needs: {item.depends_on.map((d: string) => d.replace(/^plans\/(completed\/)?/, '').replace(/\.md$/, '')).join(', ')}</span>
                          {/if}
                        </td>
                        <td>
                          {#if item.phase}
                            <span class="phase-tag">Phase {item.phase}</span>
                          {:else}
                            <span class="muted">—</span>
                          {/if}
                        </td>
                        <td>
                          <span class="badge {statusBadgeClass(item.status)}">{statusEmoji(item.status)} {item.status}</span>
                          {#if isReleaseItem(item.path)}
                            <span class="release-tag" title="Part of current release target">📦</span>
                          {/if}
                        </td>
                        <td class="item-date">
                          {item.assigned_to || '—'}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {:else}

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

    <!-- Overdue Reviews -->
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

    <!-- Active plans -->
    <section id="section-active-plans" class="section">
      <button class="section-header" onclick={() => toggleSection('active-plans')}>
        <span class="section-title">Active Plans</span>
        <span class="badge">{data.plans.active.length}</span>
        {#if data.currentPhase}
          <span class="phase-hint">Phase {data.currentPhase}{data.version ? ` · v${data.version}` : ''} · {data.plans.completed_count} completed</span>
        {/if}
        <span class="chevron">{collapsed['active-plans'] ? '▸' : '▾'}</span>
      </button>
      {#if !collapsed['active-plans']}
        {#if data.plans.active.length === 0}
          <div class="empty">No active plans</div>
        {:else}
          {#each activePlansByPhase as group}
            <div class="phase-group-header">
              {group.phase === '__unassigned__' ? 'Unassigned' : `Phase ${group.phase}`}
              <span class="phase-group-count">{group.plans.length}</span>
            </div>
            <table class="items-table">
              <thead><tr><th>Pri</th><th>Title</th><th>Status</th><th>Assigned</th></tr></thead>
              <tbody>
                {#each group.plans as p}
                  <tr class="item-row" onclick={() => navTo(p)}>
                    <td><span class="pri {priorityClass(p.priority)}">{p.priority || '—'}</span></td>
                    <td class="item-title-cell">
                      <span class="item-title">{p.title}</span>
                      {#if p.depends_on && p.depends_on.length > 0}
                        <span class="item-deps">↳ needs: {p.depends_on.map((d: string) => d.replace(/^plans\/(completed\/)?/, '').replace(/\.md$/, '')).join(', ')}</span>
                      {/if}
                      {#if p.parentPlan}
                        <span class="item-deps">↳ parent: <a href="/plans/{p.parentPlan.replace(/\.md$/, '')}" onclick={(e) => { e.stopPropagation(); navTo({ path: 'plans/' + p.parentPlan }); }}>{p.parentPlan.replace(/\.md$/, '')}</a></span>
                      {/if}
                    </td>
                    <td>
                      <span class="badge {statusBadgeClass(p.status)}">{statusEmoji(p.status)} {p.status}</span>
                      {#if isReleaseItem(p.path)}
                        <span class="release-tag" title="Part of current release target">📦</span>
                      {/if}
                    </td>
                    <td class="item-date">{p.assigned_to || '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/each}
        {/if}
      {/if}
    </section>

    <!-- Approved, pending plan -->
    <section id="section-approved-pending" class="section">
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
            <thead><tr><th>Pri</th><th>Title</th><th>Complexity</th></tr></thead>
            <tbody>
              {#each data.proposals.approved_pending as p}
                <tr class="item-row" onclick={() => navTo(p)}>
                  <td><span class="pri {priorityClass(p.priority)}">{p.priority || '—'}</span></td>
                  <td class="item-title">{p.title}</td>
                  <td>{#if p.complexity}<span class="complexity">{p.complexity}</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </section>

    <!-- Open proposals -->
    <section id="section-open-proposals" class="section">
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
            <thead><tr><th>Pri</th><th>Title</th><th>Type</th><th>Complexity</th></tr></thead>
            <tbody>
              {#each data.proposals.open as p}
                {@const catLabel = p.category?.[0] === 'feature' ? '✨' : p.category?.[0] === 'bug' ? '🐛' : p.category?.[0] === 'thought' ? '💭' : ''}
                <tr class="item-row" onclick={() => navTo(p)}>
                  <td><span class="pri {priorityClass(p.priority)}">{p.priority || '—'}</span></td>
                  <td class="item-title">{p.title}</td>
                  <td>{#if catLabel}<span class="cat-badge cat-{p.category?.[0]}">{catLabel} {p.category?.[0]}</span>{:else}—{/if}</td>
                  <td>{#if p.complexity}<span class="complexity">{p.complexity}</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </section>

    <!-- Research -->
    {#if data.research}
    <section class="section">
      <button class="section-header" onclick={() => toggleSection('research')}>
        <span class="section-title">Research</span>
        <span class="badge">{data.research.active.length + data.research.recent_conclusions.length}</span>
        <span class="chevron">{collapsed['research'] ? '▸' : '▾'}</span>
      </button>
      {#if !collapsed['research']}
        {#if data.research.active.length === 0 && data.research.recent_conclusions.length === 0}
          <div class="empty">No active research</div>
        {:else}
          {#if data.research.active.length > 0}
            <div class="research-sub-head">Active</div>
            <table class="items-table">
              <thead><tr><th>Title</th><th>Question</th><th>Created</th></tr></thead>
              <tbody>
                {#each data.research.active as r}
                  <tr class="item-row" onclick={() => goto('/' + r.path.replace(/\.md$/, ''))}>
                    <td class="item-title-cell"><span class="item-title">{r.title}</span></td>
                    <td class="research-question">{r.question}</td>
                    <td class="item-date">{r.created}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
          {#if data.research.recent_conclusions.length > 0}
            <div class="research-sub-head">Recently concluded</div>
            <table class="items-table">
              <thead><tr><th>Title</th><th>Conclusion</th><th>Date</th></tr></thead>
              <tbody>
                {#each data.research.recent_conclusions as r}
                  <tr class="item-row" onclick={() => goto('/' + r.path.replace(/\.md$/, ''))}>
                    <td class="item-title-cell"><span class="item-title">{r.title}</span></td>
                    <td><span class="badge research-conclusion-{r.conclusion}">{r.conclusion}</span></td>
                    <td class="item-date">{r.created}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        {/if}
      {/if}
    </section>
    {/if}

    <!-- Deferred -->
    {#if data.proposals.deferred.length > 0}
      <section class="section">
        <button class="section-header" onclick={() => toggleSection('deferred')}>
          <span class="section-title">Deferred</span>
          <span class="badge badge-default">{data.proposals.deferred.length}</span>
          <span class="chevron">{collapsed['deferred'] ? '▸' : '▾'}</span>
        </button>
        {#if !collapsed['deferred']}
          <table class="items-table">
            <thead><tr><th>Pri</th><th>Title</th><th>Complexity</th></tr></thead>
            <tbody>
              {#each data.proposals.deferred as p}
                <tr class="item-row" onclick={() => navTo(p)}>
                  <td><span class="pri {priorityClass(p.priority)}">{p.priority || '—'}</span></td>
                  <td class="item-title">{p.title}</td>
                  <td>{#if p.complexity}<span class="complexity">{p.complexity}</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    {/if}

    <!-- Completed plans -->
    <section id="section-completed" class="section">
      <button class="section-header" onclick={() => toggleSection('completed')}>
        <span class="section-title">Completed Plans</span>
        <span class="badge badge-done">{data.plans.completed_count}</span>
        <span class="chevron">{collapsed['completed'] ? '▸' : '▾'}</span>
      </button>
      {#if !collapsed['completed']}
        {#if !data.plans.completed || data.plans.completed.length === 0}
          <div class="empty muted">No completed plans found</div>
        {:else}
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 100px;">Phase</th>
                <th>Title</th>
                <th style="width: 150px;">Completed Date</th>
                <th style="width: 150px;">Owner</th>
              </tr>
            </thead>
            <tbody>
              {#each data.plans.completed as p}
                <tr class="item-row" onclick={() => navTo(p)}>
                  <td>{#if p.phase}<span class="phase-badge">Phase {p.phase}</span>{:else}—{/if}</td>
                  <td class="item-title">{p.title}</td>
                  <td style="color: var(--muted); font-size: 13px;">{p.completed_date || '—'}</td>
                  <td>{#if p.assigned_to}<span class="assignee">{p.assigned_to}</span>{:else}—{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </section>

    <!-- Audit log link -->
    <div class="audit-link-row">
      <a href="/audit" class="audit-link">📊 View audit log →</a>
    </div>

    {/if} <!-- end {:else} list view -->
  {/if}

  {#if showReportBugModal}
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h3>🐞 Report a Bug</h3>
          <button class="close-btn" onclick={resetReport}>&times;</button>
        </div>

        {#if reportStep === 'form'}
          <form onsubmit={submitBugReport}>
            <div class="form-group">
              <label for="bug-title">Bug Title</label>
              <input id="bug-title" type="text" bind:value={bugTitle} required placeholder="e.g. Database connection pool timeout" />
            </div>
            <div class="form-group">
              <label for="bug-desc">Description</label>
              <textarea id="bug-desc" bind:value={bugDesc} required rows="4" placeholder="Detail the steps to reproduce, actual vs expected outcomes..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="bug-reporter">Reporter</label>
                <input id="bug-reporter" type="text" bind:value={bugReporter} required />
              </div>
              <div class="form-group">
                <label for="bug-priority">Priority</label>
                <select id="bug-priority" bind:value={bugPriority}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="bug-sysinfo">System Info</label>
              <input id="bug-sysinfo" type="text" bind:value={bugSysInfo} placeholder="e.g. Linux x86_64, Node v20" />
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-cancel" onclick={resetReport}>Cancel</button>
              <button type="submit" class="btn btn-submit" disabled={reportSubmitting}>
                {reportSubmitting ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </form>
        {:else}
          <p class="suggest-intro">These look similar — is one of them yours? Confirming adds your context and bumps its demand count. Nothing is auto-merged.</p>
          <ul class="suggest-list">
            {#each bugSuggestions as s (s.path)}
              <li class="suggest-item">
                <div class="suggest-meta">
                  <span class="suggest-title">{s.title}</span>
                  <span class="suggest-sub">
                    {#if s.source === 'gh'}<span class="gh-badge">GH#{s.ghIssueNumber}</span>{/if}
                    demand {s.demandCount} · {(s.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <button type="button" class="btn btn-submit" disabled={reportSubmitting} onclick={() => confirmExisting(s.path)}>This is mine</button>
              </li>
            {/each}
          </ul>
          <div class="modal-actions">
            <button type="button" class="btn btn-cancel" onclick={() => (reportStep = 'form')}>← Back</button>
            <button type="button" class="btn btn-submit" disabled={reportSubmitting} onclick={() => fileNewBug(bugSuggestions.map((s) => s.path))}>
              {reportSubmitting ? 'Filing…' : 'None of these — file new'}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>



<style lang="scss">
  @use '../../lib/tokens' as *;

  // ── Page structure ──────────────────────────────────────────────────────────
  .status-page { padding: 32px; }
  .status-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  h1 { font-size: 20px; font-weight: 600; color: $fg; margin: 0; flex: 1; }

  .refresh-btn {
    @include flat-btn;
    border: 1px solid $border; border-radius: 4px; padding: 2px 8px; font-size: 14px;
    &:hover { border-color: $muted; }
  }

  .friction-badge {
    color: $amber; background: $amber-bg;
    border: 1px solid $amber-bdr; border-radius: 4px;
    padding: 2px 8px; font-size: 12px; text-decoration: none; white-space: nowrap;
    &:hover { border-color: $amber; }
  }

  // ── Graph view ──────────────────────────────────────────────────────────────
  .graph-view {
    height: calc(100vh - 120px);
    margin: -32px -32px 0;
    overflow: hidden;
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
    background: var(--bg-header, #1a1a1a); border: none; color: $fg; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left;
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

  // ── Research section ────────────────────────────────────────────────────────
  .research-sub-head { padding: 6px 16px 3px; font-size: 11px; font-weight: 600; color: $teal; text-transform: uppercase; letter-spacing: 0.04em; }
  .research-sub-head.research-flag { color: $amber; }
  .research-question { color: $muted; font-size: 11px; max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .research-conclusion-recommends  { background: $green-bg;  color: $green;  border-color: $green-bdr; }
  .research-conclusion-inconclusive { background: $bg-2;     color: $muted;  border-color: $border; }
  .research-conclusion-superseded  { background: $bg-2;      color: $muted;  border-color: $border; }
  .research-conclusion-open        { background: $blue-bg;   color: $blue;   border-color: $blue-bdr; }
  .research-skipped-note { padding: 0 16px 4px; font-size: 11px; color: $muted; }
  .research-skipped-list { list-style: none; margin: 0; padding: 0 16px 8px; display: flex; flex-wrap: wrap; gap: 4px; }
  .research-skipped-list li { }
  .link-btn { background: none; border: 1px solid $border; border-radius: 3px; color: $muted; font-size: 11px; padding: 2px 8px; cursor: pointer; &:hover { border-color: $blue-bdr; color: $blue; } }

  // ── Phase gate review banner ─────────────────────────────────────────────────
  .phase-review-banner {
    margin-bottom: 12px; border: 1px solid $amber-bdr; border-radius: 6px;
    background: rgba(180,120,0,.07); padding: 14px 16px;
  }
  .prb-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .prb-icon      { font-size: 18px; flex-shrink: 0; }
  .prb-title     { font-size: 13px; font-weight: 700; color: $amber; }

  .prb-steps { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .prb-step {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 8px 10px; border-radius: 4px; background: rgba(0,0,0,.15);
    &.prb-step-done { opacity: 0.5; }
  }
  .prb-step-num {
    flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
    background: $amber-bg; border: 1px solid $amber-bdr; color: $amber;
    font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
  }
  .prb-step-body { display: flex; flex-direction: column; gap: 2px;
    strong { font-size: 12px; color: $fg-dim; }
  }
  .prb-step-hint { font-size: 11px; color: $muted; line-height: 1.4; }

  .prb-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px; }
  .prb-table th { text-align: left; padding: 4px 8px; color: $muted; font-weight: 500; border-bottom: 1px solid $border; font-size: 11px; }
  .prb-row td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }
  .prb-needs-review td { background: rgba(180,120,0,.05); }
  .prb-reviewed td { opacity: 0.55; }
  .prb-phase      { font-size: 11px; color: $muted; white-space: nowrap; width: 70px; }
  .prb-plan-title { font-size: 12px; color: $fg-dim; }
  .prb-date       { font-size: 11px; color: $muted; white-space: nowrap; width: 130px; }
  .prb-actions    { display: flex; align-items: center; gap: 6px; white-space: nowrap; }

  .prb-open-btn {
    background: $bg-2; border: 1px solid $border; border-radius: 3px;
    color: $fg-dim; font-size: 11px; padding: 3px 10px; cursor: pointer;
    &:hover { border-color: $blue-bdr; color: $blue; }
  }
  .prb-confirm-btn {
    background: $amber-bg; border: 1px solid $amber-bdr; border-radius: 3px;
    color: $amber; font-size: 11px; padding: 3px 10px; cursor: pointer;
    &:hover { filter: brightness(1.15); }
    &:disabled { opacity: 0.5; cursor: default; }
  }
  .prb-ok      { font-size: 11px; color: $green; }
  .prb-blocked { font-size: 11px; color: $muted; font-style: italic; cursor: help; }

  .prb-activate-cta {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 10px 12px; border-radius: 4px;
    background: rgba(45,125,70,.12); border: 1px solid $green-bdr;
  }
  .prb-activate-msg  { font-size: 12px; color: $green; font-weight: 600; flex: 1; }
  .prb-activate-btn  {
    background: $green-bg; border: 1px solid $green-bdr; border-radius: 4px;
    color: $green; font-size: 12px; font-weight: 600; padding: 5px 14px; cursor: pointer;
    white-space: nowrap;
    &:hover { filter: brightness(1.15); }
  }
  .prb-activate-hint { font-size: 11px; color: $muted; width: 100%; }
  .prb-progress { font-size: 11px; color: $muted; text-align: right; margin-top: 2px; }

  // ── Table ───────────────────────────────────────────────────────────────────
  .phase-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: $blue;
    border-top: 1px solid $border;
    margin-top: 4px;
    &:first-child { border-top: none; margin-top: 0; }
  }
  .phase-group-count {
    background: $blue-bg;
    color: $blue;
    border: 1px solid $blue-bdr;
    border-radius: 8px;
    padding: 0 6px;
    font-size: 10px;
    font-weight: 600;
  }
  .items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .items-table thead tr { border-bottom: 1px solid $border; }
  .items-table th { padding: 6px 16px; text-align: left; color: $muted; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .item-row { cursor: pointer; border-bottom: 1px solid $bg-hover; &:hover { background: $bg-hover; } }
  .item-row td { padding: 8px 16px; color: $fg-dim; }
  .item-title   { color: $fg; font-weight: 500; }
  .item-date    { color: $muted; font-size: 11px; }

  // ── Tags & complexity chips ──────────────────────────────────────────────────
  .cat-badge    { display: inline-block; border-radius: 8px; padding: 0 6px; font-size: 10px; border: 1px solid transparent; }
  .cat-feature  { background: #1a2f4a; color: #58a6ff; border-color: #2b5b84; }
  .cat-bug      { background: #2a1010; color: #e87; border-color: #5a2020; }
  .cat-thought  { background: #1a2a1a; color: #6d6; border-color: #2a4a2a; }
  .tag        { display: inline-block; background: $tag-bg; border: 1px solid $tag-bdr; border-radius: 8px; padding: 0 6px; font-size: 10px; color: $tag; margin-right: 3px; }
  .complexity { display: inline-block; background: $bg-3; border: 1px solid $border; border-radius: 4px; padding: 0 5px; font-size: 10px; color: $muted; }

  .pri { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .pri-critical { color: #e55; }
  .pri-high     { color: #e87; }
  .pri-med      { color: $amber; }
  .pri-low      { color: $muted; }

  .item-title-cell { display: flex; flex-direction: column; gap: 2px; }
  .item-deps { font-size: 10px; color: $muted; font-style: italic; }

  // ── Deferred ────────────────────────────────────────────────────────────────
  .deferred-list { padding: 6px 16px 10px; display: flex; flex-direction: column; gap: 4px; }
  .deferred-item { background: none; border: none; color: $muted; font-size: 12px; text-align: left; cursor: pointer; padding: 2px 0; &:hover { color: $fg-dim; } }

  // ── Gates ───────────────────────────────────────────────────────────────────
  .gates-section { margin-bottom: 8px; border: 1px solid $amber-bdr; border-radius: 6px; overflow: hidden; }
  .gates-header   { background: #1e1800; }
  .overdue-header { background: #1e0e00; }
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

  // ── Phase hint (in Active Plans header) ─────────────────────────────────────
  .phase-hint { font-size: 10px; color: $muted; font-family: monospace; margin-left: auto; margin-right: 4px; }

  // ── Audit log link ───────────────────────────────────────────────────────────
  .audit-link-row { padding: 12px 0 4px; text-align: center; }
  .audit-link { font-size: 11px; color: $muted; text-decoration: none; padding: 4px 12px; border: 1px solid $border; border-radius: 4px; &:hover { color: $blue; border-color: $blue-bdr; } }

  // ── Open PRs section ─────────────────────────────────────────────────────────
  .pr-link {
    color: $blue; font-weight: 600; font-size: 13px; text-decoration: none;
    &:hover { text-decoration: underline; }
  }
  .pr-ci-passing  { background: $green-bg; color: $green; border-color: $green-bdr; }
  .pr-ci-failing  { background: $red-bg;   color: #e87;  border-color: $red-bdr; }
  .pr-review-approved        { background: $green-bg; color: $green; border-color: $green-bdr; }
  .pr-review-changes-requested { background: $red-bg;  color: #e87;  border-color: $red-bdr; }
  .pr-merge-mergeable    { background: $green-bg; color: $green; border-color: $green-bdr; }
  .pr-merge-conflicting  { background: $red-bg;  color: #e87;  border-color: $red-bdr; }
  .pr-plan-link { color: $fg-dim; text-decoration: none; font-size: 12px; &:hover { color: $blue; text-decoration: underline; } }

  .roadplan-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 16px;
  }
  .roadplan-bucket-section {
    border: 1px solid $border;
    border-radius: 6px;
    background: $bg-2;
    overflow: hidden;
  }
  .roadplan-bucket-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: $bg-3;
    border-bottom: 1px solid $border;
    h2 {
      font-size: 13px;
      font-weight: 600;
      color: $fg;
      margin: 0;
    }
  }
  .phase-tag {
    display: inline-block;
    background: rgba(88, 166, 255, 0.08);
    color: #58a6ff;
    border: 1px solid rgba(88, 166, 255, 0.15);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 500;
  }

  .approve-btn {
    background: $green-bg; border: 1px solid $green-bdr; border-radius: 4px;
    color: $green; font-size: 11px; font-weight: 600; padding: 4px 12px; cursor: pointer;
    &:hover { filter: brightness(1.15); }
    &:disabled { opacity: 0.5; cursor: default; }
  }

  // ── Release-target box ──────────────────────────────────────────────────────
  .release-target-box {
    background: $bg-2;
    border: 1px solid $border;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 8px;
  }
  .release-target-header {
    display: flex; align-items: center; gap: 12px; margin-bottom: 8px;
  }
  .release-target-header h3 {
    margin: 0; font-size: 16px;
  }
  .release-target-header a {
    color: $accent; text-decoration: none;
    &:hover { text-decoration: underline; }
  }
  .release-target-badge {
    font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
    background: $bg-3; color: $muted;
    &.ready { background: $accent; color: #fff; }
  }
  .release-target-items {
    display: flex; flex-direction: column; gap: 4px; margin-top: 8px;
  }
  .release-target-item {
    display: flex; align-items: center; gap: 8px; padding: 4px 8px;
    border-radius: 4px; text-decoration: none; color: $fg;
    font-size: 13px;
    transition: background 0.15s;
    &:hover { background: $bg-hover; }
    &.completed { opacity: 0.65; }
  }
  .rti-status { font-size: 14px; width: 20px; text-align: center; }
  .rti-type-badge {
    font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px;
    text-transform: uppercase; width: 60px; text-align: center;
    &.rti-plan { background: $accent; color: #fff; }
    &.rti-issue { background: $bg-3; color: $muted; }
    &.rti-proposal { background: $accent; color: #fff; }
  }
  .rti-title { flex: 1; }
  .rti-status-text { font-size: 11px; color: $muted; }
  .release-tag {
    font-size: 14px; cursor: help; margin-left: 4px;
  }

  // ── Release Readiness Dashboard ──────────────────────────────────────────────
  .release-readiness-card {
    background: $bg-2;
    border: 1px solid $border;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .release-readiness-card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid $border;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .release-readiness-card .title-section {
    display: flex;
    align-items: center;
    gap: 12px;
    h3 {
      font-size: 15px;
      font-weight: 600;
      color: $fg;
      margin: 0;
    }
  }
  .release-readiness-card .milestone-badge {
    background: rgba(88, 166, 255, 0.1);
    color: #58a6ff;
    border: 1px solid rgba(88, 166, 255, 0.2);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: bold;
    font-family: monospace;
  }
  .release-readiness-card .channel-section {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: $muted;
  }
  .release-readiness-card .channel-badge {
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: bold;
    color: #fff;
    &.dev {
      background: #8f5fe8;
      border: 1px solid #7d4cd1;
    }
    &.beta {
      background: #ff9f1a;
      border: 1px solid #e08300;
    }
    &.stable {
      background: #2ed573;
      border: 1px solid #20b85a;
    }
  }
  .release-readiness-card .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
  }
  .release-readiness-card .metric-card {
    background: $bg-3;
    border: 1px solid $border;
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 0.2s, background 0.2s;
    &.passed {
      border-color: rgba(46, 213, 115, 0.3);
      background: rgba(46, 213, 115, 0.03);
    }
  }
  .release-readiness-card .metric-value {
    font-size: 20px;
    font-weight: bold;
    color: $fg;
  }
  .release-readiness-card .metric-label {
    font-size: 11px;
    color: $muted;
    font-weight: 500;
  }
  .release-readiness-card .metric-sublist {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 120px;
    overflow-y: auto;
    font-size: 11px;
    border-top: 1px solid $border;
    padding-top: 6px;
    margin-top: 4px;
  }
  .release-readiness-card .item-link {
    color: $fg-dim;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    &:hover {
      color: #58a6ff;
      text-decoration: underline;
    }
  }
  .release-readiness-card .progress-bar {
    width: 100%;
    height: 6px;
    background: $border;
    border-radius: 3px;
    overflow: hidden;
  }
  .release-readiness-card .progress-fill {
    height: 100%;
    background: #58a6ff;
    border-radius: 3px;
    .passed & {
      background: #2ed573;
    }
  }
  .release-readiness-card .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid $border;
    padding-top: 16px;
    margin-top: 16px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .release-readiness-card .status-msg {
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 4px;
    &.success {
      background: rgba(46, 213, 115, 0.1);
      color: #2ed573;
      border: 1px solid rgba(46, 213, 115, 0.2);
    }
    &.warning {
      background: rgba(255, 159, 26, 0.1);
      color: #ff9f1a;
      border: 1px solid rgba(255, 159, 26, 0.2);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }
  }
  .blocker-header {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 4px;
  }
  .blocker-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    li {
      padding: 4px 0;
      strong {
        color: #ff9f1a;
        font-weight: 600;
      }
    }
  }
  .blocker-detail {
    font-size: 11px;
    opacity: 0.75;
    margin-top: 2px;
    padding-left: 4px;
  }
  .release-readiness-card .promote-btn {
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    color: #fff;
    transition: opacity 0.2s, transform 0.1s;
    &:hover {
      opacity: 0.9;
    }
    &:active {
      transform: scale(0.98);
    }
    &.beta {
      background: #ff9f1a;
    }
    &.stable {
      background: #2ed573;
    }
    &.disabled {
      background: #444;
      color: #777;
      cursor: not-allowed;
      border: 1px solid #555;
      opacity: 0.6;
      &:hover {
        opacity: 0.6;
      }
      &:active {
        transform: none;
      }
    }
  }

  // ── Light theme — scoped via :global so Svelte appends the scope hash ────────
  // Pattern: :global(html[data-theme="light"]) .scoped-class compiles to
  //   html[data-theme="light"] .scoped-class.s-hash — beats the base rule.
  :global(html[data-theme="light"]) {
    .section { border-color: #d0d0d0; }
    .section-header { background: #e8e8e8; color: #1a1a1a; &:hover { background: #ddd; } }
    .badge { background: #e0e0e0; color: #555; border-color: #ccc; }
    .badge-warn { background: #fff8cc; color: #7a6000; border-color: #e8d400; }
    .item-row { border-bottom-color: #ebebeb; &:hover { background: #f5f5f5; } td { color: #444; } }
    .item-title { color: #1a1a1a; }
    .view-toggle { background: #e8e8e8; border-color: #ccc; }
    .view-btn { color: #777; &:hover { color: #333; } &.active { background: #d8d8d8; color: #1a1a1a; } }
    .gates-section { border-color: #e8c84a; }
    .gates-header   { background: #fff8cc; }
    .overdue-header { background: #fff0e0; }
    .gate-item { background: #fff; border-color: #d0d0d0; &:hover { background: #f5f5f5; border-color: #bbb; } }
    .gate-title { color: #1a1a1a; }
    .gate-meta { color: #666; }
    .gate-badge { background: #fff8cc; color: #7a6000; border-color: #e8c84a; }
    .audit-link { color: #888; border-color: #ccc; &:hover { color: #4a6cf7; border-color: #4a6cf7; } }
    .empty, .muted { color: #888; }
    .roadplan-bucket-section { border-color: #d0d0d0; background: #fff; }
    .roadplan-bucket-header { background: #e8e8e8; border-bottom-color: #d0d0d0; h2 { color: #1a1a1a; } }
    .phase-tag { background: rgba(74, 108, 247, 0.08); color: #4a6cf7; border-color: rgba(74, 108, 247, 0.15); }
    .approve-btn { background: #d4edda; border-color: #b8daff; color: #155724; }
    .pr-ci-passing  { background: #d4edda; color: #155724; border-color: #c3e6cb; }
    .pr-ci-failing  { background: #f8d7da; color: #721c24; border-color: #f5c6cb; }
    .pr-review-approved        { background: #d4edda; color: #155724; border-color: #c3e6cb; }
    .pr-review-changes-requested { background: #f8d7da; color: #721c24; border-color: #f5c6cb; }
    .pr-merge-mergeable    { background: #d4edda; color: #155724; border-color: #c3e6cb; }
    .pr-merge-conflicting  { background: #f8d7da; color: #721c24; border-color: #f5c6cb; }
  }

  // Two-phase bug-report suggestions
  .suggest-intro { font-size: 0.9rem; opacity: 0.85; margin: 0 0 0.75rem; }
  .suggest-list { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .suggest-item { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.75rem; border: 1px solid rgba(128,128,128,0.25); border-radius: 6px; }
  .suggest-meta { display: flex; flex-direction: column; min-width: 0; }
  .suggest-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
  .suggest-sub { font-size: 0.75rem; opacity: 0.7; }
  .gh-badge { display: inline-block; background: #2dba4e; color: #fff; font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 3px; margin-right: 0.35rem; vertical-align: middle; }

  // ── GH Promote ───────────────────────────────────────────────────────────────
  .heatmap-row { display: flex; align-items: center; gap: 0.5rem; }
  .heatmap-row .heatmap-item { flex: 1; }
  .gh-promote-btn { background: #238636; color: #fff; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.7rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .gh-promote-btn:hover { background: #2ea043; }
  .gh-promote-btn:disabled { background: #555; cursor: wait; }
  .gh-link { font-size: 0.7rem; font-weight: 600; color: #2dba4e; text-decoration: none; white-space: nowrap; padding: 0.2rem 0.45rem; border: 1px solid #2dba4e; border-radius: 4px; }
  .gh-link:hover { background: rgba(45, 186, 78, 0.1); }
  :global(html[data-theme="light"]) { .gh-promote-btn { background: #1a7f37; &:hover { background: #238636; } } .gh-link { border-color: #1a7f37; color: #1a7f37; } }

  // ── Heatmap ─────────────────────────────────────────────────────────────────
  .heatmap-card { background: #1c1c2e; border: 1px solid #333; border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem; }
  .heatmap-card .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; h3 { margin: 0; } }
  .heatmap-controls { display: flex; align-items: center; gap: 0.5rem; }
  .window-toggle { background: #333; color: #ccc; border: 1px solid #555; border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.7rem; cursor: pointer; }
  .window-toggle:hover { background: #444; color: #fff; }
  :global(html[data-theme="light"]) { .window-toggle { background: #e8e8e8; color: #555; border-color: #ccc; &:hover { background: #d8d8d8; color: #333; } } }
  .heatmap-grid { display: flex; flex-direction: column; gap: 0.35rem; }
  .heatmap-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.45rem 0.75rem; border-radius: 6px; text-decoration: none; transition: background 0.15s; }
  .heatmap-item.cool { background: rgba(74, 108, 247, 0.08); border-left: 3px solid #4a6cf7; }
  .heatmap-item.warm { background: rgba(247, 181, 74, 0.1); border-left: 3px solid #f7b54a; }
  .heatmap-item.hot  { background: rgba(247, 74, 74, 0.1); border-left: 3px solid #f74a4a; }
  .heatmap-item:hover { background: rgba(255,255,255,0.06); }
  .heatmap-rank { font-size: 0.75rem; font-weight: 700; color: #888; min-width: 1.5rem; }
  .heatmap-title { flex: 1; font-size: 0.85rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ccc; }
  .heatmap-demand { font-size: 0.75rem; font-weight: 700; background: rgba(255,255,255,0.08); padding: 0.15rem 0.5rem; border-radius: 10px; color: #aaa; }
  .heatmap-item.hot .heatmap-demand { background: rgba(247, 74, 74, 0.25); color: #f77; }

  // ── Heatmap light theme ──────────────────────────────────────────────────────
  :global(html[data-theme="light"]) {
    .heatmap-card { background: #fff; border-color: #d0d0d0; }
    .heatmap-item.cool { background: rgba(74, 108, 247, 0.05); }
    .heatmap-item.warm { background: rgba(247, 181, 74, 0.06); }
    .heatmap-item.hot  { background: rgba(247, 74, 74, 0.06); }
    .heatmap-item:hover { background: rgba(0,0,0,0.03); }
    .heatmap-title { color: #1a1a1a; }
    .heatmap-demand { background: rgba(0,0,0,0.06); color: #555; }
    .heatmap-item.hot .heatmap-demand { background: rgba(247, 74, 74, 0.12); color: #c33; }
  }
</style>
