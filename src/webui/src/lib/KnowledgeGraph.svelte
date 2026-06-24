<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import * as d3 from 'd3';

  // ── Types ──────────────────────────────────────────────────────────────────

  interface GraphNode {
    id: string; title: string; docType: string; status: string;
    phase: string; tags: string[]; author: string;
    approved?: boolean; deferred?: boolean; contentHash: string;
    x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null;
  }

  interface GraphEdge {
    source: string | GraphNode; target: string | GraphNode; type: string;
  }

  interface GapSet {
    orphanedPlans: Set<string>; deadEndResearch: Set<string>;
    approvedNoResearch: Set<string>; blockedPlans: Set<string>;
    thematicOrphans: Set<string>; phaseOrphans: Set<string>;
  }

  // ── State ──────────────────────────────────────────────────────────────────

  let canvasEl: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let simulation: d3.Simulation<GraphNode, GraphEdge> | null = null;
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let ro: ResizeObserver | null = null;
  let svgWidth = 900;
  let svgHeight = 600;

  let nodes: GraphNode[] = $state([]);
  let edges: GraphEdge[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let ready = $state(false);  // true once SVG has real dimensions

  let showTypes = $state(new Set(['proposal','plan','doc','policy','research']));
  let showEdgeTypes = $state(new Set(['wikilink','related_to','depends_on','blocks','consumed_by','proposal_source']));
  let showCompleted = $state(false);
  let showConsumed  = $state(false); // hide proposals already converted to plans
  let showGaps = $state(true);
  let phaseFilter = $state<string>('');

  let gaps = $state<GapSet>({
    orphanedPlans: new Set(), deadEndResearch: new Set(),
    approvedNoResearch: new Set(), blockedPlans: new Set(),
    thematicOrphans: new Set(), phaseOrphans: new Set(),
  });

  let tooltip = $state<{ x: number; y: number; node: GraphNode } | null>(null);

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
  // Cluster angles by docType — spread nodes by type so they don't pile up
  const TYPE_ANGLE: Record<string, number> = {
    proposal: 0, plan: Math.PI * 0.4, doc: Math.PI * 0.8,
    policy: Math.PI * 1.2, research: Math.PI * 1.6,
  };

  function nodeColor(n: GraphNode): string { return TYPE_COLOR[n.docType] ?? TYPE_COLOR.unknown; }
  function nodeRadius(n: GraphNode): number {
    if (n.status === 'completed' || n.status === 'canceled') return 5;
    if (n.approved === true) return 10;
    if (n.status === 'in-progress') return 9;
    return 7;
  }
  function gapColor(id: string): string | null {
    if (gaps.orphanedPlans.has(id))      return '#f39c12';
    if (gaps.deadEndResearch.has(id))    return '#e74c3c';
    if (gaps.approvedNoResearch.has(id)) return '#e67e22';
    if (gaps.blockedPlans.has(id))       return '#c0392b';
    if (gaps.thematicOrphans.has(id))    return '#8e44ad';
    if (gaps.phaseOrphans.has(id))       return '#f39c12';
    return null;
  }

  // ── Gap detection ─────────────────────────────────────────────────────────

  function detectGaps(ns: GraphNode[], es: GraphEdge[]): GapSet {
    const edgeMap = new Map<string, {source:string; target:string; type:string}[]>();
    for (const e of es) {
      const s = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const t = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      if (!edgeMap.has(s)) edgeMap.set(s, []);
      edgeMap.get(s)!.push({ source: s, target: t, type: e.type });
    }
    const byId = new Map(ns.map(n => [n.id, n]));
    const out = (id: string) => edgeMap.get(id) ?? [];

    const orphanedPlans = new Set<string>();
    for (const n of ns) {
      if (n.docType !== 'plan' || n.status === 'completed' || n.status === 'canceled') continue;
      const hasProposalLink = out(n.id).some(e =>
        e.type === 'proposal_source' || (e.type === 'related_to' && byId.get(e.target)?.docType === 'proposal')
      );
      if (!hasProposalLink) orphanedPlans.add(n.id);
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
        // Use status field only (fm not available in graph nodes)
        if (dep && (dep.status === 'canceled' || dep.status === 'deferred')) blockedPlans.add(n.id);
      }
    }

    const thematicOrphans = new Set<string>();
    // Exclude deferred proposals — they're intentionally parked, not lost
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

  // ── Filtered sets ─────────────────────────────────────────────────────────

  // IDs of proposals that have a consumed_by edge (they became a plan)
  function consumedProposalIds(): Set<string> {
    const ids = new Set<string>();
    for (const e of edges) {
      if (e.type !== 'consumed_by') continue;
      const src = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      ids.add(src);
    }
    return ids;
  }

  function filteredNodes(): GraphNode[] {
    const consumed = showConsumed ? new Set<string>() : consumedProposalIds();
    return nodes.filter(n => {
      if (!showTypes.has(n.docType)) return false;
      if (!showCompleted && (n.status === 'completed' || n.status === 'canceled')) return false;
      if (!showConsumed && consumed.has(n.id)) return false;
      if (phaseFilter && n.phase !== phaseFilter) return false;
      return true;
    });
  }

  function filteredEdges(visibleIds: Set<string>): GraphEdge[] {
    return edges.filter(e => {
      const s = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const t = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      return visibleIds.has(s) && visibleIds.has(t) && showEdgeTypes.has(e.type);
    });
  }

  // ── D3 rendering ──────────────────────────────────────────────────────────

  function buildGraph() {
    if (!svgEl || !ready) return;
    // Read live pixel dimensions from the SVG element itself
    const rect = svgEl.getBoundingClientRect();
    const w = rect.width || svgWidth || 900;
    const h = rect.height || svgHeight || 600;
    if (w < 10 || h < 10) return; // not laid out yet — ResizeObserver will retry

    const fns = filteredNodes();
    const visIds = new Set(fns.map(n => n.id));
    const fes = filteredEdges(visIds);

    // Spread initial positions by type cluster to avoid all-at-origin pile-up
    const typeCount = new Map<string, number>();
    for (const n of fns) {
      if (n.x !== undefined && n.y !== undefined) continue; // keep existing positions on re-render
      const count = typeCount.get(n.docType) ?? 0;
      typeCount.set(n.docType, count + 1);
      const angle = (TYPE_ANGLE[n.docType] ?? 0) + (count * 0.4);
      const r = 120 + count * 15;
      n.x = w / 2 + Math.cos(angle) * r;
      n.y = h / 2 + Math.sin(angle) * r;
    }

    d3.select(svgEl).selectAll('*').remove();
    const svg = d3.select(svgEl);

    const defs = svg.append('defs');
    defs.append('marker').attr('id', 'arr').attr('viewBox','-0 -5 10 10')
      .attr('refX', 16).attr('refY', 0).attr('orient','auto')
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .append('path').attr('d','M 0,-5 L 10,0 L 0,5').attr('fill','#666').style('stroke','none');

    const g = svg.append('g').attr('class', 'root');

    zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 6])
      .on('zoom', ev => g.attr('transform', ev.transform));
    svg.call(zoomBehavior).on('dblclick.zoom', null);

    if (simulation) simulation.stop();
    simulation = d3.forceSimulation<GraphNode>(fns)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(fes).id(d => d.id)
        .distance(d => d.type === 'wikilink' ? 70 : 120).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-250).distanceMax(400))
      .force('center', d3.forceCenter(w / 2, h / 2).strength(0.05))
      .force('collide', d3.forceCollide(20));

    const link = g.append('g').selectAll('line').data(fes).enter().append('line')
      .attr('stroke', (d: GraphEdge) => EDGE_COLOR[d.type] ?? '#555')
      .attr('stroke-width', (d: GraphEdge) => d.type === 'wikilink' ? 1 : 1.5)
      .attr('stroke-opacity', (d: GraphEdge) => d.type === 'wikilink' ? 0.25 : 0.55)
      .attr('marker-end', (d: GraphEdge) => d.type !== 'wikilink' ? 'url(#arr)' : null);

    const node = g.append('g').selectAll<SVGGElement, GraphNode>('g').data(fns).enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (ev, d) => { if (!ev.active) simulation?.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end',   (ev, d) => { if (!ev.active) simulation?.alphaTarget(0); d.fx = null; d.fy = null; }));

    // Gap ring
    node.append('circle')
      .attr('r', (d: GraphNode) => showGaps && gapColor(d.id) ? nodeRadius(d) + 4 : 0)
      .attr('fill', 'none')
      .attr('stroke', (d: GraphNode) => gapColor(d.id) ?? 'none')
      .attr('stroke-width', 2).attr('stroke-dasharray', '3 2');

    // Main circle
    node.append('circle')
      .attr('r', (d: GraphNode) => nodeRadius(d))
      .attr('fill', (d: GraphNode) => nodeColor(d))
      .attr('stroke', '#0d0d1e').attr('stroke-width', 1.5)
      .attr('opacity', (d: GraphNode) => (d.status === 'completed' || d.status === 'canceled') ? 0.35 : 1);

    // Labels
    node.append('text')
      .attr('dy', (d: GraphNode) => nodeRadius(d) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px').attr('fill', '#aaa')
      .attr('pointer-events', 'none')
      .text((d: GraphNode) => d.title.length > 24 ? d.title.slice(0, 22) + '…' : d.title);

    node
      .on('mouseover', (ev: MouseEvent, d: GraphNode) => { tooltip = { x: ev.clientX + 14, y: ev.clientY - 10, node: d }; })
      .on('mousemove', (ev: MouseEvent) => { if (tooltip) tooltip = { ...tooltip, x: ev.clientX + 14, y: ev.clientY - 10 }; })
      .on('mouseout', () => { tooltip = null; })
      .on('click', (_: MouseEvent, d: GraphNode) => { window.location.href = '/' + d.id.replace(/\.md$/, ''); });

    simulation.on('tick', () => {
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d: GraphNode) => `translate(${d.x ?? w/2},${d.y ?? h/2})`);
    });
  }

  function fitGraph() {
    if (!svgEl || !zoomBehavior) return;
    const g = d3.select(svgEl).select<SVGGElement>('g.root');
    if (g.empty()) return;
    const bb = (g.node() as SVGGElement).getBBox();
    if (!bb.width || !bb.height) return;
    const rect = svgEl.getBoundingClientRect();
    const cw = rect.width || svgWidth, ch = rect.height || svgHeight;
    const pad = 40;
    const scale = Math.min((cw - pad * 2) / bb.width, (ch - pad * 2) / bb.height, 2);
    const tx = cw / 2 - scale * (bb.x + bb.width / 2);
    const ty = ch / 2 - scale * (bb.y + bb.height / 2);
    d3.select(svgEl).transition().duration(500)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function zoomBy(factor: number) {
    if (!svgEl || !zoomBehavior) return;
    d3.select(svgEl).transition().duration(200).call(zoomBehavior.scaleBy, factor);
  }

  // ── Data fetching ─────────────────────────────────────────────────────────

  async function load() {
    loading = true; error = '';
    try {
      const res = await fetch('/api/graph');
      if (!res.ok) throw new Error(`/api/graph ${res.status}`);
      const data = await res.json();
      // Set all state together before building the graph
      nodes = data.nodes ?? [];
      edges = data.edges ?? [];
      gaps = detectGaps(nodes, edges);
      loading = false;
      await tick(); // wait for DOM to render the SVG
      buildGraph();
    } catch (e: any) {
      error = e.message;
      loading = false;
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  // NOTE: No $effect for graph rendering — $effect fires multiple times as
  // nodes/edges/gaps update separately, restarting the simulation before nodes
  // spread. Instead: explicit buildGraph() after load() + filter changes.

  onMount(async () => {
    ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          svgWidth = width; svgHeight = height;
          if (!ready) { ready = true; }
          else { buildGraph(); }  // resize
        }
      }
    });
    ro.observe(canvasEl);
    await load();
  });

  onDestroy(() => { simulation?.stop(); ro?.disconnect(); });

  // ── Sidebar helpers ────────────────────────────────────────────────────────

  function gapCount() {
    return gaps.orphanedPlans.size + gaps.deadEndResearch.size +
           gaps.approvedNoResearch.size + gaps.blockedPlans.size +
           gaps.thematicOrphans.size + gaps.phaseOrphans.size;
  }
  function toggleType(t: string) {
    const s = new Set(showTypes); s.has(t) ? s.delete(t) : s.add(t); showTypes = s;
    buildGraph();
  }
  function toggleEdgeType(t: string) {
    const s = new Set(showEdgeTypes); s.has(t) ? s.delete(t) : s.add(t); showEdgeTypes = s;
    buildGraph();
  }
  function toggleCompleted(v: boolean) { showCompleted = v; buildAndFit(); }
  function toggleConsumed(v: boolean)  { showConsumed  = v; buildAndFit(); }
  function toggleGaps(v: boolean) { showGaps = v; buildGraph(); }
  function changePhase(v: string) { phaseFilter = v; buildAndFit(); }

  // Rebuild then auto-fit after a short delay (let simulation spread before fitting)
  function buildAndFit() {
    buildGraph();
    setTimeout(fitGraph, 1800);
  }

  const phases = $derived([...new Set(nodes.map(n => n.phase).filter(Boolean))].sort());
</script>

<div class="kg-root">
  <!-- Filter sidebar -->
  <div class="kg-sidebar">
    <div class="kg-section">
      <div class="kg-section-title">Document Types</div>
      {#each Object.entries(TYPE_COLOR) as [type, color]}
        {#if type !== 'unknown'}
          <label class="kg-filter-row">
            <input type="checkbox" checked={showTypes.has(type)} onchange={() => toggleType(type)} />
            <span class="kg-dot" style="background:{color}"></span>
            <span class="kg-label">{type}</span>
          </label>
        {/if}
      {/each}
    </div>

    <div class="kg-section">
      <div class="kg-section-title">Edge Types</div>
      {#each Object.entries(EDGE_COLOR).slice(0,6) as [type, color]}
        <label class="kg-filter-row">
          <input type="checkbox" checked={showEdgeTypes.has(type)} onchange={() => toggleEdgeType(type)} />
          <span class="kg-line" style="background:{color}"></span>
          <span class="kg-label">{type.replace(/_/g,' ')}</span>
        </label>
      {/each}
    </div>

    <div class="kg-section">
      <div class="kg-section-title">Phase</div>
      <select class="kg-select" value={phaseFilter} onchange={e => changePhase((e.target as HTMLSelectElement).value)}>
        <option value="">All phases</option>
        {#each phases as p}<option value={p}>{p}</option>{/each}
      </select>
    </div>

    <div class="kg-section">
      <label class="kg-filter-row">
        <input type="checkbox" checked={showCompleted} onchange={e => toggleCompleted((e.target as HTMLInputElement).checked)} />
        <span class="kg-label">Show completed</span>
        <span class="kg-count">{nodes.filter(n => n.status === 'completed' || n.status === 'canceled').length}</span>
      </label>
      <label class="kg-filter-row">
        <input type="checkbox" checked={showConsumed} onchange={e => toggleConsumed((e.target as HTMLInputElement).checked)} />
        <span class="kg-label">Show consumed proposals</span>
        <span class="kg-count">{consumedProposalIds().size}</span>
      </label>
      <label class="kg-filter-row">
        <input type="checkbox" checked={showGaps} onchange={e => toggleGaps((e.target as HTMLInputElement).checked)} />
        <span class="kg-label">Highlight gaps</span>
      </label>
    </div>

    {#if showGaps && gapCount() > 0}
      <div class="kg-section kg-gaps">
        <div class="kg-section-title">Gaps — {gapCount()}</div>
        {#if gaps.orphanedPlans.size}
          <div class="kg-gap-row" style="color:#f39c12">⚠ {gaps.orphanedPlans.size} orphaned plan{gaps.orphanedPlans.size > 1 ? 's' : ''}</div>
        {/if}
        {#if gaps.deadEndResearch.size}
          <div class="kg-gap-row" style="color:#e74c3c">⚠ {gaps.deadEndResearch.size} dead-end research</div>
        {/if}
        {#if gaps.approvedNoResearch.size}
          <div class="kg-gap-row" style="color:#e67e22">⚠ {gaps.approvedNoResearch.size} approved, no research</div>
        {/if}
        {#if gaps.blockedPlans.size}
          <div class="kg-gap-row" style="color:#c0392b">⚠ {gaps.blockedPlans.size} blocked by canceled dep</div>
        {/if}
        {#if gaps.thematicOrphans.size}
          <div class="kg-gap-row" style="color:#8e44ad">⚠ {gaps.thematicOrphans.size} thematic orphan{gaps.thematicOrphans.size > 1 ? 's' : ''}</div>
        {/if}
        {#if gaps.phaseOrphans.size}
          <div class="kg-gap-row" style="color:#f39c12">⚠ {gaps.phaseOrphans.size} plan{gaps.phaseOrphans.size > 1 ? 's' : ''} without phase</div>
        {/if}
      </div>
    {/if}

    <div class="kg-section kg-stats">
      <div class="kg-stat">{filteredNodes().length} visible / {nodes.length} total</div>
    </div>

    <button class="kg-reload" onclick={load}>↻ Refresh</button>
  </div>

  <!-- Graph canvas — SVG is always in DOM so svgEl binding is stable -->
  <div class="kg-canvas" bind:this={canvasEl}>
    {#if loading}
      <div class="kg-overlay">Building graph…</div>
    {:else if error}
      <div class="kg-overlay kg-error">{error}</div>
    {:else if nodes.length === 0}
      <div class="kg-overlay">No documents indexed yet.</div>
    {/if}
    <!-- SVG always rendered; D3 populates it once dimensions are known -->
    <svg bind:this={svgEl} class="kg-svg"
         style="visibility:{(!loading && !error && nodes.length) ? 'visible' : 'hidden'}"></svg>
    {#if !loading && !error && nodes.length}
      <div class="kg-zoom-btns">
        <button onclick={() => zoomBy(1.3)} title="Zoom in">+</button>
        <button onclick={fitGraph} title="Fit all nodes">⊡</button>
        <button onclick={() => zoomBy(0.77)} title="Zoom out">−</button>
      </div>
    {/if}
  </div>

  <!-- Tooltip -->
  {#if tooltip}
    <div class="kg-tooltip" style="left:{tooltip.x}px; top:{tooltip.y}px">
      <div class="kg-tt-title">{tooltip.node.title}</div>
      <div class="kg-tt-meta">
        <span class="kg-tt-type" style="color:{TYPE_COLOR[tooltip.node.docType] ?? '#aaa'}">{tooltip.node.docType}</span>
        <span class="kg-tt-status">{tooltip.node.status}</span>
        {#if tooltip.node.phase}<span class="kg-tt-phase">Phase {tooltip.node.phase}</span>{/if}
      </div>
      {#if tooltip.node.tags.length}
        <div class="kg-tt-tags">{tooltip.node.tags.join(', ')}</div>
      {/if}
      {#if showGaps && gapColor(tooltip.node.id)}
        <div class="kg-tt-gap" style="color:{gapColor(tooltip.node.id)}">
          {#if gaps.orphanedPlans.has(tooltip.node.id)}⚠ Orphaned plan — no source proposal{/if}
          {#if gaps.deadEndResearch.has(tooltip.node.id)}⚠ Dead-end — no linked proposals{/if}
          {#if gaps.approvedNoResearch.has(tooltip.node.id)}⚠ Approved without research{/if}
          {#if gaps.blockedPlans.has(tooltip.node.id)}⚠ Blocked by canceled dependency{/if}
          {#if gaps.thematicOrphans.has(tooltip.node.id)}⚠ Thematic orphan{/if}
          {#if gaps.phaseOrphans.has(tooltip.node.id)}⚠ Active plan without phase{/if}
        </div>
      {/if}
      <div class="kg-tt-path">{tooltip.node.id}</div>
    </div>
  {/if}
</div>

<style>
  .kg-root   { display: flex; height: 100%; overflow: hidden; position: relative; background: #0d0d1e; }

  .kg-sidebar {
    width: 190px; flex-shrink: 0; overflow-y: auto;
    background: #111128; border-right: 1px solid #2a2a4a;
    padding: 12px 10px; display: flex; flex-direction: column; gap: 2px;
  }
  .kg-section       { margin-bottom: 10px; }
  .kg-section-title { font-size: 9px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; }
  .kg-filter-row    { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #bbb; cursor: pointer; padding: 1px 0; }
  .kg-filter-row input { cursor: pointer; width: 12px; height: 12px; accent-color: #4a90d9; flex-shrink: 0; }
  .kg-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .kg-line { width: 14px; height: 2px; flex-shrink: 0; border-radius: 1px; }
  .kg-label { font-size: 11px; flex: 1; }
  .kg-count { font-size: 9px; color: #444; background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 8px; padding: 0 5px; flex-shrink: 0; }
  .kg-select { background: #0d0d1e; border: 1px solid #2a2a4a; color: #bbb; font-size: 11px; padding: 3px 6px; border-radius: 4px; width: 100%; }
  .kg-gaps { border-top: 1px solid #1e1e3a; padding-top: 8px; }
  .kg-gap-row { font-size: 10px; padding: 1px 0; line-height: 1.4; }
  .kg-stats  { margin-top: auto; padding-top: 8px; border-top: 1px solid #1e1e3a; }
  .kg-stat   { font-size: 10px; color: #555; }
  .kg-reload { margin-top: 6px; background: none; border: 1px solid #2a2a4a; color: #555;
               font-size: 10px; padding: 4px 8px; border-radius: 4px; cursor: pointer; width: 100%;
               &:hover { border-color: #4a6aba; color: #aaa; } }

  .kg-canvas   { flex: 1; position: relative; overflow: hidden; }
  .kg-svg      { display: block; width: 100%; height: 100%; position: absolute; inset: 0; }
  .kg-overlay  { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
                  color: #555; font-size: 13px; }
  .kg-error    { color: #e74c3c; }

  .kg-zoom-btns {
    position: absolute; bottom: 16px; right: 16px;
    display: flex; flex-direction: column; gap: 4px;
    button {
      background: #111128; border: 1px solid #2a2a4a; color: #aaa;
      font-size: 15px; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; line-height: 1;
      &:hover { border-color: #4a6aba; color: #fff; }
    }
  }

  .kg-tooltip {
    position: fixed; z-index: 1000; pointer-events: none;
    background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 6px;
    padding: 8px 10px; min-width: 180px; max-width: 280px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  }
  .kg-tt-title  { font-size: 11px; font-weight: 600; color: #e0e0f0; margin-bottom: 4px; line-height: 1.3; }
  .kg-tt-meta   { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 3px; }
  .kg-tt-type, .kg-tt-status, .kg-tt-phase {
    font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 8px;
    background: #0d0d1e; border: 1px solid #2a2a4a;
  }
  .kg-tt-tags   { color: #666; font-size: 10px; }
  .kg-tt-gap    { font-size: 10px; margin-top: 4px; font-weight: 600; }
  .kg-tt-path   { color: #333; font-size: 9px; margin-top: 4px; font-family: monospace; }

  :global(html[data-theme="light"]) {
    .kg-root    { background: #f0f2fa; }
    .kg-sidebar { background: #e8eaf6; border-color: #c8cae6; }
    .kg-section-title { color: #999; }
    .kg-filter-row { color: #333; }
    .kg-select  { background: #fff; border-color: #c0c0e0; color: #333; }
    .kg-reload  { border-color: #c0c0e0; color: #aaa; &:hover { color: #333; } }
    .kg-zoom-btns button { background: #e8eaf6; border-color: #c8cae6; color: #555; }
    .kg-tooltip { background: #fff; border-color: #c0c0e0; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .kg-tt-title { color: #1a1a2e; }
    .kg-tt-path  { color: #bbb; }
    .kg-tt-type, .kg-tt-status, .kg-tt-phase { background: #f0f2fa; border-color: #c8cae6; }
  }
</style>
