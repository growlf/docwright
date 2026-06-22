<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { goto } from '$app/navigation';

  interface NoteData { path: string; filename: string; frontmatter: Record<string, any>; }
  interface RefField  { field: string; target: string; label: string; }

  let { rows, allNotes, docwright }: {
    rows: NoteData[];
    allNotes: NoteData[];
    docwright: any;
  } = $props();

  let container: HTMLDivElement;
  let svgEl:     SVGSVGElement;
  let sim: d3.Simulation<any, any> | null = null;

  const TYPE_COLOR: Record<string, string> = {
    hypervisor:      '#4a9eff',
    lxc:             '#4ecdc4',
    qemu:            '#45b7d1',
    router:          '#ff6b6b',
    switch:          '#ff8e53',
    'bare-metal':    '#a8e6cf',
    workstation:     '#ffd93d',
    camera:          '#c3a6ff',
    printer:         '#ffaaa5',
    'access-control':'#ff9f7f',
    unknown:         '#555',
  };

  function refFields(): RefField[] {
    return Object.entries(docwright?.fields ?? {})
      .filter(([, c]: any) => c.type === 'ref')
      .map(([field, c]: any) => ({ field, target: c.target ?? 'hostname', label: c.edgeLabel ?? field }));
  }

  function buildGraph(rows: NoteData[], allNotes: NoteData[]) {
    const refs = refFields();
    const byTarget = new Map(allNotes.map(n => [n.frontmatter.hostname ?? n.filename, n]));
    const inView   = new Set(rows.map(n => n.filename));

    const nodes: any[] = rows.map(n => ({
      id: n.filename, note: n,
      type: n.frontmatter.type ?? 'unknown',
      extra: false,
    }));
    const extraMap = new Map<string, any>();
    const links: any[] = [];

    for (const note of rows) {
      for (const ref of refs) {
        const val = note.frontmatter[ref.field];
        if (!val) continue;
        const target = byTarget.get(val);
        if (!target) continue;
        if (!inView.has(target.filename) && !extraMap.has(target.filename)) {
          extraMap.set(target.filename, {
            id: target.filename, note: target,
            type: target.frontmatter.type ?? 'unknown',
            extra: true,
          });
        }
        links.push({ source: note.filename, target: target.filename, label: ref.label });
      }
    }

    return { nodes: [...nodes, ...extraMap.values()], links };
  }

  function render() {
    if (!svgEl || !container) return;
    if (sim) { sim.stop(); sim = null; }

    const { nodes, links } = buildGraph(rows, allNotes);
    const w = container.clientWidth  || 900;
    const h = container.clientHeight || 540;

    const svg = d3.select(svgEl).attr('width', w).attr('height', h);
    svg.selectAll('*').remove();

    const root = svg.append('g');

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.15, 5])
        .on('zoom', e => root.attr('transform', e.transform))
    );

    // Arrowhead marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow').attr('viewBox', '0 -4 8 8')
      .attr('refX', 22).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#444');

    const link = root.append('g').selectAll('line')
      .data(links).join('line')
      .attr('stroke', '#333').attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#arrow)');

    const node = root.append('g').selectAll<SVGGElement, any>('g')
      .data(nodes).join('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => { if (!d.extra) goto('/' + d.note.path.replace(/\.md$/, '')); });

    // Drag
    node.call(
      d3.drag<SVGGElement, any>()
        .on('start', (e, d) => { if (!e.active) sim!.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim!.alphaTarget(0); d.fx = null; d.fy = null; })
    );

    node.append('circle')
      .attr('r', d => d.extra ? 9 : 13)
      .attr('fill', d => TYPE_COLOR[d.type] ?? '#555')
      .attr('opacity', d => d.extra ? 0.35 : 0.88)
      .attr('stroke', d => d.extra ? '#333' : '#111')
      .attr('stroke-width', 1.5);

    node.append('text')
      .text(d => (d.note.frontmatter.hostname ?? d.id).slice(0, 18))
      .attr('y', 24).attr('text-anchor', 'middle')
      .attr('font-size', 10).attr('fill', d => d.extra ? '#555' : '#ccc')
      .attr('pointer-events', 'none');

    node.append('title').text(d => {
      const f = d.note.frontmatter;
      return [f.hostname, f.ip, f.type, f.role, f.status].filter(Boolean).join(' · ');
    });

    sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(90).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide(22))
      .on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
        node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });
  }

  onMount(() => {
    // bind:this is guaranteed to have run before onMount fires
    const stop = $effect.root(() => {
      rows; allNotes; docwright; // track reactive deps — re-render on tab switch
      render();
    });
    const ro = new ResizeObserver(() => render());
    ro.observe(container);
    return () => {
      stop();
      ro.disconnect();
      if (sim) { sim.stop(); sim = null; }
    };
  });
</script>

<div class="graph-wrap" bind:this={container}>
  <svg bind:this={svgEl}></svg>

  <!-- Legend -->
  <div class="legend">
    {#each Object.entries(TYPE_COLOR).filter(([t]) => rows.some(n => n.frontmatter.type === t)) as [type, color]}
      <span class="leg-item">
        <span class="leg-dot" style="background:{color}"></span>
        {type}
      </span>
    {/each}
  </div>

  {#if rows.length === 0}
    <div class="empty">No nodes to display.</div>
  {/if}
</div>

<style lang="scss">
  @use './tokens' as *;

  .graph-wrap {
    position: relative; width: 100%; height: 560px;
    background: $bg-2; border-radius: 6px; overflow: hidden;
  }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }

  .legend {
    position: absolute; bottom: 12px; left: 12px;
    display: flex; flex-wrap: wrap; gap: 8px;
    background: rgba(0,0,0,0.5); border-radius: 4px; padding: 6px 10px;
  }
  .leg-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: $fg-dim; }
  .leg-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  .empty {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: $muted; font-size: 13px;
  }
</style>
