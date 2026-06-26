<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Snippet } from 'svelte';
  import * as d3 from 'd3';
  import type { ForceNode, ForceEdge, FilterControl, GapItem } from './force-graph.js';

  let {
    nodes = [],
    edges = [],
    colorBy = '',
    colorMap = {},
    defaultNodeColor = '#4a9eff',
    labelField = 'label',
    controls = [],
    edgeColorMap,
    gapHighlights = {},
    gapSummary = [],
    onRefresh,
    nodeSizeFn,
    nodeOpacityFn,
    children,
  }: {
    nodes: ForceNode[];
    edges: ForceEdge[];
    colorBy?: string;
    colorMap?: Record<string, string>;
    defaultNodeColor?: string;
    labelField?: string;
    controls?: FilterControl[];
    edgeColorMap?: Record<string, string>;
    gapHighlights?: Record<string, string>;
    gapSummary?: GapItem[];
    onRefresh?: () => void;
    nodeSizeFn?: (n: ForceNode) => number;
    nodeOpacityFn?: (n: ForceNode) => number;
    children?: Snippet;
  } = $props();

  let canvasEl: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let sim: d3.Simulation<ForceNode, ForceEdge> | null = null;
  let zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let ro: ResizeObserver | null = null;
  let ready = false;

  // ── Filter state ─────────────────────────────────────────────────────────

  let activeCtrls: FilterControl[] = $state([]);
  let activeFilters = $state<Map<string, Set<string>>>(new Map());
  let activeEdgeTypes = $state<Set<string>>(new Set());
  let tooltip = $state<{ x: number; y: number; node: ForceNode } | null>(null);

  function autoControls(ns: ForceNode[]): FilterControl[] {
    const counts = new Map<string, Set<string>>();
    for (const n of ns) {
      for (const [k, v] of Object.entries(n.fields)) {
        if (v == null || v === '') continue;
        if (!counts.has(k)) counts.set(k, new Set());
        counts.get(k)!.add(String(v));
      }
    }
    return [...counts.entries()]
      .filter(([, vals]) => vals.size >= 2 && vals.size <= 12)
      .map(([field]) => ({
        field,
        label: field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        colors: field === colorBy ? colorMap : undefined,
      }));
  }

  function initFilters(ns: ForceNode[]) {
    activeCtrls = controls.length ? controls : autoControls(ns);
    const m = new Map<string, Set<string>>();
    for (const c of activeCtrls) {
      const prev = activeFilters.get(c.field);
      if (prev) { m.set(c.field, prev); continue; }
      const vals = new Set(ns.map(n => String(n.fields[c.field] ?? '')).filter(Boolean));
      m.set(c.field, vals);
    }
    activeFilters = m;

    if (edgeColorMap) {
      const prev = activeEdgeTypes.size ? activeEdgeTypes : null;
      activeEdgeTypes = prev ?? new Set(edges.map(e => e.type));
    }
  }

  function uniqueVals(field: string): string[] {
    return [...new Set(nodes.map(n => String(n.fields[field] ?? '')).filter(Boolean))].sort();
  }

  function uniqueEdgeTypes(): string[] {
    return [...new Set(edges.map(e => e.type))].sort();
  }

  function nodeId(n: string | ForceNode): string {
    return typeof n === 'string' ? n : n.id;
  }

  function filteredNodes(): ForceNode[] {
    return nodes.filter(n => {
      for (const [field, active] of activeFilters) {
        const v = String(n.fields[field] ?? '');
        if (!active.has(v)) return false;
      }
      return true;
    });
  }

  function filteredEdges(visIds: Set<string>): ForceEdge[] {
    return edges.filter(e => {
      const s = nodeId(e.source), t = nodeId(e.target);
      if (!visIds.has(s) || !visIds.has(t)) return false;
      if (edgeColorMap && !activeEdgeTypes.has(e.type)) return false;
      return true;
    });
  }

  // ── D3 ───────────────────────────────────────────────────────────────────

  function getNodeColor(n: ForceNode): string {
    if (!colorBy) return defaultNodeColor;
    return colorMap[String(n.fields[colorBy] ?? '')] ?? defaultNodeColor;
  }

  function getNodeRadius(n: ForceNode): number {
    return nodeSizeFn ? nodeSizeFn(n) : 11;
  }

  function getNodeOpacity(n: ForceNode): number {
    return nodeOpacityFn ? nodeOpacityFn(n) : 0.88;
  }

  function buildGraph() {
    if (!svgEl || !canvasEl || !ready) return;
    if (sim) { sim.stop(); sim = null; }

    const rect = canvasEl.getBoundingClientRect();
    const w = rect.width || 900, h = rect.height || 540;
    if (w < 10 || h < 10) return;

    const fns = filteredNodes();
    const visIds = new Set(fns.map(n => n.id));
    const fes = filteredEdges(visIds);

    // Seed positions for new nodes only
    for (const n of fns) {
      if (n.x !== undefined) continue;
      n.x = w / 2 + (Math.random() - 0.5) * 200;
      n.y = h / 2 + (Math.random() - 0.5) * 200;
    }

    const svg = d3.select(svgEl).attr('width', w).attr('height', h);
    svg.selectAll('*').remove();

    svg.append('defs').append('marker')
      .attr('id', 'fg-arr').attr('viewBox', '0 -4 8 8')
      .attr('refX', 20).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#555');

    const root = svg.append('g');
    zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 6])
      .on('zoom', ev => root.attr('transform', ev.transform));
    svg.call(zoom).on('dblclick.zoom', null);

    const link = root.append('g').selectAll<SVGLineElement, ForceEdge>('line')
      .data(fes).join('line')
      .attr('stroke', (d: ForceEdge) => edgeColorMap?.[d.type] ?? '#333')
      .attr('stroke-width', 1.3)
      .attr('stroke-opacity', 0.5)
      .attr('marker-end', 'url(#fg-arr)');

    const node = root.append('g').selectAll<SVGGElement, ForceNode>('g')
      .data(fns).join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, ForceNode>()
        .on('start', (ev, d) => { if (!ev.active) sim?.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end',   (ev, d) => { if (!ev.active) sim?.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on('mouseover', (ev: MouseEvent, d: ForceNode) => { tooltip = { x: ev.clientX + 14, y: ev.clientY - 10, node: d }; })
      .on('mousemove', (ev: MouseEvent) => { if (tooltip) tooltip = { ...tooltip, x: ev.clientX + 14, y: ev.clientY - 10 }; })
      .on('mouseout', () => { tooltip = null; })
      .on('click', (_: MouseEvent, d: ForceNode) => { window.location.href = '/' + d.path.replace(/\.md$/, ''); });

    // Gap highlight ring
    node.append('circle')
      .attr('r', (d: ForceNode) => gapHighlights[d.id] ? getNodeRadius(d) + 4 : 0)
      .attr('fill', 'none')
      .attr('stroke', (d: ForceNode) => gapHighlights[d.id] ?? 'none')
      .attr('stroke-width', 2).attr('stroke-dasharray', '3 2');

    // Main node circle
    node.append('circle')
      .attr('r', (d: ForceNode) => getNodeRadius(d))
      .attr('fill', (d: ForceNode) => getNodeColor(d))
      .attr('opacity', (d: ForceNode) => getNodeOpacity(d))
      .attr('stroke', '#111').attr('stroke-width', 1.5);

    // Label
    node.append('text')
      .text((d: ForceNode) => {
        const lbl = String(d.fields[labelField] ?? d.label);
        return lbl.length > 20 ? lbl.slice(0, 19) + '…' : lbl;
      })
      .attr('dy', (d: ForceNode) => getNodeRadius(d) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9).attr('fill', '#aaa')
      .attr('pointer-events', 'none');

    sim = d3.forceSimulation<ForceNode>(fns)
      .force('link', d3.forceLink<ForceNode, ForceEdge>(fes).id(d => d.id).distance(90).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-240).distanceMax(400))
      .force('center', d3.forceCenter(w / 2, h / 2).strength(0.05))
      .force('collide', d3.forceCollide(20))
      .on('tick', () => {
        link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
        node.attr('transform', (d: ForceNode) => `translate(${d.x ?? w/2},${d.y ?? h/2})`);
      });
  }

  function fitGraph() {
    if (!svgEl || !zoom) return;
    const g = d3.select(svgEl).select<SVGGElement>('g');
    if (g.empty()) return;
    const bb = (g.node() as SVGGElement).getBBox();
    if (!bb.width || !bb.height) return;
    const rect = svgEl.getBoundingClientRect();
    const cw = rect.width || 900, ch = rect.height || 540, pad = 40;
    const scale = Math.min((cw - pad*2)/bb.width, (ch - pad*2)/bb.height, 2);
    const tx = cw/2 - scale*(bb.x + bb.width/2);
    const ty = ch/2 - scale*(bb.y + bb.height/2);
    d3.select(svgEl).transition().duration(500)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function zoomBy(f: number) {
    if (!svgEl || !zoom) return;
    d3.select(svgEl).transition().duration(200).call(zoom.scaleBy, f);
  }

  // ── Sidebar interaction ───────────────────────────────────────────────────

  function toggleFilter(field: string, value: string) {
    const s = new Set(activeFilters.get(field) ?? []);
    s.has(value) ? s.delete(value) : s.add(value);
    activeFilters = new Map(activeFilters).set(field, s);
    buildGraph();
  }

  function toggleEdgeType(type: string) {
    const s = new Set(activeEdgeTypes);
    s.has(type) ? s.delete(type) : s.add(type);
    activeEdgeTypes = s;
    buildGraph();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(() => {
    ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) {
          if (!ready) { ready = true; initFilters(nodes); buildGraph(); }
          else buildGraph();
        }
      }
    });
    ro.observe(canvasEl);
    initFilters(nodes);
  });

  onDestroy(() => { sim?.stop(); ro?.disconnect(); });

  // Re-init filters and rebuild when nodes data changes
  $effect(() => {
    nodes; edges; // track
    if (ready) { initFilters(nodes); buildGraph(); }
  });

  let visibleCount = $derived(filteredNodes().length);
</script>

<div class="fg-root">
  <!-- Sidebar -->
  <div class="fg-sidebar">
    {#each activeCtrls as ctrl}
      <div class="fg-section">
        <div class="fg-section-title">{ctrl.label}</div>
        {#if ctrl.type === 'select'}
          <select class="fg-select"
            onchange={e => { activeFilters = new Map(activeFilters).set(ctrl.field, new Set([(e.target as HTMLSelectElement).value].filter(Boolean))); buildGraph(); }}>
            <option value="">All</option>
            {#each uniqueVals(ctrl.field) as v}<option value={v}>{v}</option>{/each}
          </select>
        {:else}
          {#each uniqueVals(ctrl.field) as val}
            <label class="fg-filter-row">
              <input type="checkbox" checked={activeFilters.get(ctrl.field)?.has(val) ?? true}
                onchange={() => toggleFilter(ctrl.field, val)} />
              {#if ctrl.colors?.[val]}
                <span class="fg-dot" style="background:{ctrl.colors[val]}"></span>
              {/if}
              <span class="fg-label">{val}</span>
              <span class="fg-count">{nodes.filter(n => String(n.fields[ctrl.field]) === val).length}</span>
            </label>
          {/each}
        {/if}
      </div>
    {/each}

    {#if edgeColorMap}
      <div class="fg-section">
        <div class="fg-section-title">Edge Types</div>
        {#each uniqueEdgeTypes() as type}
          <label class="fg-filter-row">
            <input type="checkbox" checked={activeEdgeTypes.has(type)}
              onchange={() => toggleEdgeType(type)} />
            <span class="fg-line" style="background:{edgeColorMap[type] ?? '#555'}"></span>
            <span class="fg-label">{type.replace(/_/g, ' ')}</span>
          </label>
        {/each}
      </div>
    {/if}

    <!-- Extra sidebar content from parent (gap toggles, phase filter, etc.) -->
    {#if children}{@render children()}{/if}

    {#if gapSummary.length}
      <div class="fg-section fg-gaps">
        <div class="fg-section-title">Gaps — {gapSummary.reduce((s,g) => s+g.count, 0)}</div>
        {#each gapSummary as g}
          {#if g.count}<div class="fg-gap-row" style="color:{g.color}">⚠ {g.count} {g.label}</div>{/if}
        {/each}
      </div>
    {/if}

    <div class="fg-stats">
      <span>{visibleCount} visible / {nodes.length} total</span>
    </div>

    {#if onRefresh}
      <button class="fg-reload" onclick={onRefresh}>↻ Refresh</button>
    {/if}
  </div>

  <!-- Graph canvas -->
  <div class="fg-canvas" bind:this={canvasEl}>
    <svg bind:this={svgEl} class="fg-svg"></svg>
    {#if nodes.length}
      <div class="fg-zoom">
        <button onclick={() => zoomBy(1.3)} title="Zoom in">+</button>
        <button onclick={fitGraph} title="Fit">⊡</button>
        <button onclick={() => zoomBy(0.77)} title="Zoom out">−</button>
      </div>
    {/if}
  </div>

  <!-- Tooltip -->
  {#if tooltip}
    <div class="fg-tooltip" style="left:{tooltip.x}px;top:{tooltip.y}px">
      <div class="fg-tt-title">{tooltip.node.label}</div>
      <div class="fg-tt-fields">
        {#each Object.entries(tooltip.node.fields).slice(0, 5) as [k, v]}
          {#if v}<span class="fg-tt-chip">{k}: {v}</span>{/if}
        {/each}
      </div>
      {#if gapHighlights[tooltip.node.id]}
        <div class="fg-tt-gap" style="color:{gapHighlights[tooltip.node.id]}">⚠ gap detected</div>
      {/if}
      <div class="fg-tt-path">{tooltip.node.path}</div>
    </div>
  {/if}
</div>

<style lang="scss">
  @use './tokens' as *;

  .fg-root { display: flex; height: 100%; overflow: hidden; position: relative; }

  /* ── Sidebar ── */
  .fg-sidebar {
    width: 180px; flex-shrink: 0; overflow-y: auto;
    background: $bg-2; border-right: 1px solid $border;
    padding: 12px 10px; display: flex; flex-direction: column; gap: 0;
    font-size: 11px;
  }
  .fg-section { margin-bottom: 12px; }
  .fg-section-title {
    font-size: 9px; font-weight: 700; color: $muted; text-transform: uppercase;
    letter-spacing: 0.8px; margin-bottom: 5px;
  }
  .fg-filter-row {
    display: flex; align-items: center; gap: 5px; color: $fg-dim;
    cursor: pointer; padding: 1px 0; line-height: 1.4;
    input { cursor: pointer; width: 11px; height: 11px; flex-shrink: 0; accent-color: $blue; }
  }
  .fg-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .fg-line { width: 14px; height: 2px; flex-shrink: 0; border-radius: 1px; }
  .fg-label { flex: 1; font-size: 11px; }
  .fg-count { font-size: 9px; color: $muted; background: $bg-3; border: 1px solid $border; border-radius: 8px; padding: 0 4px; flex-shrink: 0; }
  .fg-select { background: $bg; border: 1px solid $border; color: $fg-dim; font-size: 11px; padding: 2px 5px; border-radius: 4px; width: 100%; }
  .fg-gaps { border-top: 1px solid $border; padding-top: 8px; }
  .fg-gap-row { font-size: 10px; padding: 1px 0; line-height: 1.4; }
  .fg-stats { margin-top: auto; padding-top: 8px; border-top: 1px solid $border; color: $muted; font-size: 10px; }
  .fg-reload {
    margin-top: 6px; background: none; border: 1px solid $border; color: $muted;
    font-size: 10px; padding: 3px 8px; border-radius: 4px; cursor: pointer; width: 100%;
    &:hover { border-color: $blue-bdr; color: $fg-dim; }
  }

  /* ── Canvas ── */
  .fg-canvas { flex: 1; position: relative; overflow: hidden; background: $bg-2; }
  .fg-svg    { display: block; width: 100%; height: 100%; position: absolute; inset: 0; }

  .fg-zoom {
    position: absolute; bottom: 12px; right: 12px;
    display: flex; flex-direction: column; gap: 3px;
    button {
      background: $bg-3; border: 1px solid $border; color: $fg-dim;
      font-size: 14px; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; line-height: 1;
      &:hover { border-color: $blue-bdr; color: $fg; }
    }
  }

  /* ── Tooltip ── */
  .fg-tooltip {
    position: fixed; z-index: 1000; pointer-events: none;
    background: $bg-3; border: 1px solid $border; border-radius: 6px;
    padding: 8px 10px; min-width: 160px; max-width: 260px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  }
  .fg-tt-title  { font-size: 11px; font-weight: 600; color: $fg; margin-bottom: 5px; line-height: 1.3; }
  .fg-tt-fields { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 3px; }
  .fg-tt-chip   { font-size: 9px; color: $fg-dim; background: $bg; border: 1px solid $border; border-radius: 8px; padding: 1px 5px; }
  .fg-tt-gap    { font-size: 10px; font-weight: 600; margin-top: 3px; }
  .fg-tt-path   { color: $muted; font-size: 9px; margin-top: 4px; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
