<script lang="ts">
  import ForceGraph from './ForceGraph.svelte';
  import type { ForceNode, ForceEdge, FilterControl, GapItem } from './force-graph.js';

  // ── Document graph types (from /api/graph) ────────────────────────────────

  interface RawNode {
    id: string; title: string; docType: string; status: string;
    phase: string; tags: string[]; author: string;
    approved?: boolean; deferred?: boolean;
  }
  interface RawEdge { source: string; target: string; type: string; }

  // ── Colors ────────────────────────────────────────────────────────────────

  const TYPE_COLOR: Record<string, string> = {
    proposal: '#4a90d9', plan: '#9b59b6', doc: '#27ae60',
    policy: '#16a085', research: '#e67e22', unknown: '#7f8c8d',
  };
  const EDGE_COLOR: Record<string, string> = {
    wikilink: '#555', related_to: '#4a90d9', depends_on: '#e74c3c',
    blocks: '#c0392b', consumed_by: '#9b59b6', proposal_source: '#8e44ad',
    absorbs: '#27ae60', subsumed_by: '#7f8c8d',
  };

  const TYPE_CONTROLS: FilterControl[] = [
    { field: 'docType', label: 'Document Types', colors: TYPE_COLOR },
  ];

  // ── State ─────────────────────────────────────────────────────────────────

  let rawNodes: RawNode[] = $state([]);
  let rawEdges: RawEdge[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Pre-filter toggles (applied before ForceGraph receives data)
  let showCompleted = $state(false);
  let showConsumed  = $state(false);
  let showGaps      = $state(true);
  let phaseFilter   = $state('');

  // ── Gap detection ─────────────────────────────────────────────────────────

  interface GapSets {
    orphanedPlans: Set<string>; deadEndResearch: Set<string>;
    approvedNoResearch: Set<string>; blockedPlans: Set<string>;
    thematicOrphans: Set<string>; phaseOrphans: Set<string>;
  }

  function detectGaps(ns: RawNode[], es: RawEdge[]): GapSets {
    const edgeMap = new Map<string, {target:string; type:string}[]>();
    for (const e of es) {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      edgeMap.get(e.source)!.push({ target: e.target, type: e.type });
    }
    const byId = new Map(ns.map(n => [n.id, n]));
    const out = (id: string) => edgeMap.get(id) ?? [];

    const orphanedPlans = new Set<string>();
    for (const n of ns) {
      if (n.docType !== 'plan' || n.status === 'completed' || n.status === 'canceled') continue;
      if (!out(n.id).some(e => e.type === 'proposal_source' || (e.type === 'related_to' && byId.get(e.target)?.docType === 'proposal')))
        orphanedPlans.add(n.id);
    }

    const deadEndResearch = new Set<string>();
    for (const n of ns) {
      if (n.docType !== 'research') continue;
      if (n.status !== 'concluded' && n.status !== 'completed') continue;
      if (!out(n.id).some(e => byId.get(e.target)?.docType === 'proposal')) deadEndResearch.add(n.id);
    }

    const approvedNoResearch = new Set<string>();
    for (const n of ns) {
      if (n.docType !== 'proposal' || n.approved !== true || n.deferred) continue;
      if (!out(n.id).some(e => byId.get(e.target)?.docType === 'research')) approvedNoResearch.add(n.id);
    }

    const blockedPlans = new Set<string>();
    for (const n of ns) {
      if (n.docType !== 'plan') continue;
      for (const e of out(n.id)) {
        if (e.type !== 'depends_on') continue;
        const dep = byId.get(e.target);
        if (dep && (dep.status === 'canceled' || dep.status === 'deferred')) blockedPlans.add(n.id);
      }
    }

    const thematicOrphans = new Set<string>();
    const proposals = ns.filter(n => n.docType === 'proposal' && !n.deferred);
    for (let i = 0; i < proposals.length; i++) {
      for (let j = i + 1; j < proposals.length; j++) {
        const a = proposals[i], b = proposals[j];
        if (a.tags.filter(t => b.tags.includes(t)).length < 2) continue;
        if (!out(a.id).some(e => e.target === b.id) && !out(b.id).some(e => e.target === a.id)) {
          thematicOrphans.add(a.id); thematicOrphans.add(b.id);
        }
      }
    }

    const phaseOrphans = new Set<string>();
    for (const n of ns) {
      if (n.docType !== 'plan' || n.status !== 'in-progress') continue;
      if (!n.phase || n.phase === '' || n.phase === 'null') phaseOrphans.add(n.id);
    }

    return { orphanedPlans, deadEndResearch, approvedNoResearch, blockedPlans, thematicOrphans, phaseOrphans };
  }

  // ── Derived data for ForceGraph ───────────────────────────────────────────

  function consumedIds(): Set<string> {
    const ids = new Set<string>();
    for (const e of rawEdges) { if (e.type === 'consumed_by') ids.add(e.source); }
    return ids;
  }

  let forceNodes: ForceNode[] = $derived.by(() => {
    const consumed = showConsumed ? new Set<string>() : consumedIds();
    return rawNodes
      .filter(n => {
        if (!showCompleted && (n.status === 'completed' || n.status === 'canceled')) return false;
        if (!showConsumed && consumed.has(n.id)) return false;
        if (phaseFilter && n.phase !== phaseFilter) return false;
        return true;
      })
      .map(n => ({
        id: n.id, label: n.title, path: n.id,
        fields: { docType: n.docType, status: n.status, phase: n.phase ?? '' },
      }));
  });

  // Shallow-copy edges into plain objects so d3's forceLink can mutate
  // source/target (string → node ref) without triggering Svelte's $state proxy,
  // which would re-fire the ForceGraph $effect and kill the simulation prematurely.
  let forceEdges: ForceEdge[] = $derived(rawEdges.map(e => ({ ...e }) as ForceEdge));

  let gaps: GapSets = $derived(detectGaps(rawNodes, rawEdges));

  let gapHighlights: Record<string, string> = $derived.by(() => {
    if (!showGaps) return {};
    const h: Record<string, string> = {};
    for (const id of gaps.orphanedPlans)      h[id] = '#f39c12';
    for (const id of gaps.deadEndResearch)    h[id] = '#e74c3c';
    for (const id of gaps.approvedNoResearch) h[id] = '#e67e22';
    for (const id of gaps.blockedPlans)       h[id] = '#c0392b';
    for (const id of gaps.thematicOrphans)    h[id] = '#8e44ad';
    for (const id of gaps.phaseOrphans)       h[id] = '#f39c12';
    return h;
  });

  let gapSummary: GapItem[] = $derived(showGaps ? [
    { label: 'orphaned plans',          color: '#f39c12', count: gaps.orphanedPlans.size },
    { label: 'dead-end research',        color: '#e74c3c', count: gaps.deadEndResearch.size },
    { label: 'approved, no research',   color: '#e67e22', count: gaps.approvedNoResearch.size },
    { label: 'blocked by canceled dep', color: '#c0392b', count: gaps.blockedPlans.size },
    { label: 'thematic orphans',        color: '#8e44ad', count: gaps.thematicOrphans.size },
    { label: 'plans without phase',     color: '#f39c12', count: gaps.phaseOrphans.size },
  ].filter(g => g.count > 0) : []);

  let phases: string[] = $derived([...new Set(rawNodes.map(n => n.phase).filter(Boolean))].sort());

  // ── Data fetching ─────────────────────────────────────────────────────────

  async function load() {
    loading = true; error = '';
    try {
      const res = await fetch('/api/graph');
      if (!res.ok) throw new Error(`/api/graph ${res.status}`);
      const data = await res.json();
      rawNodes = data.nodes ?? [];
      rawEdges = data.edges ?? [];
      loading = false;
    } catch (e: any) {
      error = e.message; loading = false;
    }
  }

  function nodeSizeFn(n: ForceNode): number {
    const status = String(n.fields.status ?? '');
    if (status === 'completed' || status === 'canceled') return 5;
    if (n.fields.docType === 'proposal') return 10;
    if (status === 'in-progress') return 9;
    return 7;
  }

  function nodeOpacityFn(n: ForceNode): number {
    const status = String(n.fields.status ?? '');
    return (status === 'completed' || status === 'canceled') ? 0.35 : 1;
  }

  import { onMount } from 'svelte';
  onMount(load);
</script>

{#if loading}
  <div class="kg-state">Building graph…</div>
{:else if error}
  <div class="kg-state kg-error">{error}</div>
{:else}
  <ForceGraph
    nodes={forceNodes}
    edges={forceEdges}
    colorBy="docType"
    colorMap={TYPE_COLOR}
    defaultNodeColor="#7f8c8d"
    controls={TYPE_CONTROLS}
    edgeColorMap={EDGE_COLOR}
    {gapHighlights}
    {gapSummary}
    {nodeSizeFn}
    {nodeOpacityFn}
    onRefresh={load}
  >
    {#snippet children()}
      <!-- Phase filter -->
      {#if phases.length}
        <div class="kg-extra-section">
          <div class="kg-extra-title">Phase</div>
          <select class="kg-select" value={phaseFilter}
            onchange={e => phaseFilter = (e.target as HTMLSelectElement).value}>
            <option value="">All phases</option>
            {#each phases as p}<option value={p}>{p}</option>{/each}
          </select>
        </div>
      {/if}

      <!-- Toggles -->
      <div class="kg-extra-section">
        <label class="kg-toggle">
          <input type="checkbox" bind:checked={showCompleted} />
          <span>Show completed</span>
          <span class="kg-cnt">{rawNodes.filter(n => n.status === 'completed' || n.status === 'canceled').length}</span>
        </label>
        <label class="kg-toggle">
          <input type="checkbox" bind:checked={showConsumed} />
          <span>Show consumed proposals</span>
          <span class="kg-cnt">{consumedIds().size}</span>
        </label>
        <label class="kg-toggle">
          <input type="checkbox" bind:checked={showGaps} />
          <span>Highlight gaps</span>
        </label>
      </div>
    {/snippet}
  </ForceGraph>
{/if}

<style lang="scss">
  @use './tokens' as *;

  .kg-state { display: flex; align-items: center; justify-content: center;
    height: 100%; color: $muted; font-size: 13px; }
  .kg-error { color: $red; }

  .kg-extra-section { margin-bottom: 12px; }
  .kg-extra-title { font-size: 9px; font-weight: 700; color: $muted; text-transform: uppercase;
    letter-spacing: 0.8px; margin-bottom: 5px; }
  .kg-select { background: $bg; border: 1px solid $border; color: $fg-dim;
    font-size: 11px; padding: 2px 5px; border-radius: 4px; width: 100%; }
  .kg-toggle { display: flex; align-items: center; gap: 5px; color: $fg-dim;
    cursor: pointer; padding: 1px 0; font-size: 11px;
    input { cursor: pointer; width: 11px; height: 11px; accent-color: $blue; flex-shrink: 0; }
    span { flex: 1; }
  }
  .kg-cnt { font-size: 9px; color: $muted; background: $bg-3; border: 1px solid $border;
    border-radius: 8px; padding: 0 4px; flex-shrink: 0; }
</style>
