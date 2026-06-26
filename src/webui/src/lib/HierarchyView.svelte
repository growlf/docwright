<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { goto } from '$app/navigation';

  interface NoteData { path: string; filename: string; frontmatter: Record<string, any>; }
  interface DwViewConfig {
    type?: string; mode?: string; root?: string;
    parentField?: string; labelField?: string;
    nodes?: { labelField?: string };
  }

  let { rows, allNotes, docwright, viewConfig = null }: {
    rows: NoteData[];
    allNotes: NoteData[];
    docwright: any;
    viewConfig?: DwViewConfig | null;
  } = $props();

  let container: HTMLDivElement;
  let svgEl:     SVGSVGElement;

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

  function buildHierarchy(rows: NoteData[], allNotes: NoteData[]) {
    const labelF = viewConfig?.labelField ?? viewConfig?.nodes?.labelField ?? 'hostname';

    // Determine parent field: viewConfig.parentField wins, else first ref field
    let refEntries: [string, any][] = [];
    if (viewConfig?.parentField) {
      refEntries = [[viewConfig.parentField, docwright?.fields?.[viewConfig.parentField] ?? {}]];
    } else {
      refEntries = Object.entries(docwright?.fields ?? {})
        .filter(([, c]: any) => c.type === 'ref');
    }

    if (!refEntries.length) {
      // No ref fields — group by type
      const byType = new Map<string, NoteData[]>();
      for (const n of rows) {
        const t = n.frontmatter.type ?? 'unknown';
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t)!.push(n);
      }
      return {
        id: '__root__', label: 'All', isGroup: true,
        children: [...byType.entries()].map(([type, notes]) => ({
          id: '__type__' + type, label: type, isGroup: true,
          children: notes.map(n => ({ id: n.filename, label: n.frontmatter[labelF] ?? n.filename, note: n })),
        })),
      };
    }

    const [parentField, cfg] = refEntries[0] as [string, any];
    const targetField = (cfg as any).target ?? 'hostname';
    const byTarget = new Map(allNotes.map(n => [n.frontmatter[targetField] ?? n.filename, n]));
    const inView   = new Set(rows.map(n => n.filename));

    // Build children map
    const childrenOf = new Map<string, NoteData[]>();
    const hasParent  = new Set<string>();

    for (const note of rows) {
      const val = note.frontmatter[parentField];
      if (!val) continue;
      const parent = byTarget.get(val);
      if (!parent || parent.filename === note.filename) continue;
      if (!childrenOf.has(parent.filename)) childrenOf.set(parent.filename, []);
      childrenOf.get(parent.filename)!.push(note);
      hasParent.add(note.filename);
    }

    // Roots = nodes in current view with no in-view parent
    const roots = rows.filter(n => !hasParent.has(n.filename));

    // For nodes whose parent is outside current view, attach to a virtual "External" group
    const externalParents = new Map<string, NoteData>();
    for (const note of rows) {
      const val = note.frontmatter[parentField];
      if (!val) continue;
      const parent = byTarget.get(val);
      if (!parent) continue;
      if (!inView.has(parent.filename)) {
        externalParents.set(parent.filename, parent);
      }
    }

    function toNode(note: NoteData): any {
      const ch = (childrenOf.get(note.filename) ?? []).map(toNode);
      return {
        id: note.filename,
        label: note.frontmatter[labelF] ?? note.filename,
        note,
        ...(ch.length ? { children: ch } : {}),
      };
    }

    const rootChildren = roots.map(toNode);

    // Add external parent groups if any children depend on out-of-view parents
    for (const [pfn, pnote] of externalParents) {
      const ch = (childrenOf.get(pfn) ?? []);
      if (ch.length) {
        rootChildren.push({
          id: '__ext__' + pfn,
          label: pnote.frontmatter[labelF] ?? pfn,
          note: pnote,
          extra: true,
          children: ch.map(toNode),
        });
      }
    }

    return { id: '__root__', label: 'root', isRoot: true, children: rootChildren };
  }

  function render() {
    if (!svgEl || !container || rows.length === 0) return;

    const treeData = buildHierarchy(rows, allNotes);
    const root = d3.hierarchy(treeData, d => (d as any).children);

    const NODE_W = 160;
    const NODE_H = 36;

    const layout = d3.tree<any>()
      .nodeSize([NODE_H + 8, NODE_W + 40]);

    layout(root);

    // Compute bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    root.each(d => {
      if (d.x < minX) minX = d.x; if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y; if (d.y > maxY) maxY = d.y;
    });

    const PAD = 40;
    const totalW = (maxY - minY) + NODE_W + PAD * 2;
    const totalH = (maxX - minX) + NODE_H + PAD * 2;
    const svgW = Math.max(container.clientWidth || 900, totalW);
    const svgH = Math.max(container.clientHeight || 540, totalH);

    const svg = d3.select(svgEl).attr('width', svgW).attr('height', svgH);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${PAD - minY},${PAD - minX})`);

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', e => g.attr('transform', e.transform))
    );

    // Links (curved)
    g.append('g').selectAll('path')
      .data(root.links()).join('path')
      .attr('fill', 'none').attr('stroke', '#333').attr('stroke-width', 1.2)
      .attr('d', d3.linkHorizontal<any, any>()
        .x((d: any) => d.y).y((d: any) => d.x));

    // Nodes
    const node = g.append('g').selectAll<SVGGElement, any>('g')
      .data(root.descendants()).join('g')
      .attr('transform', d => `translate(${d.data.isRoot ? -999 : d.y},${d.x})`)
      .attr('cursor', d => d.data.note && !d.data.extra ? 'pointer' : 'default')
      .on('click', (_, d) => {
        if (d.data.note && !d.data.extra && !d.data.isGroup)
          goto('/' + d.data.note.path.replace(/\.md$/, ''));
      });

    // Node rect
    node.filter(d => !d.data.isRoot)
      .append('rect')
      .attr('x', -NODE_W / 2).attr('y', -NODE_H / 2)
      .attr('width', NODE_W).attr('height', NODE_H)
      .attr('rx', 4)
      .attr('fill', d => {
        if (d.data.isGroup) return '#2a2a2a';
        const type = d.data.note?.frontmatter?.type ?? 'unknown';
        return TYPE_COLOR[type] ?? '#555';
      })
      .attr('opacity', d => d.data.extra ? 0.35 : 0.85)
      .attr('stroke', '#111').attr('stroke-width', 1);

    // Label
    node.filter(d => !d.data.isRoot)
      .append('text')
      .attr('dy', '0.35em').attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', d => {
        if (d.data.isGroup) return '#999';
        return d.data.extra ? '#555' : '#111';
      })
      .attr('pointer-events', 'none')
      .text(d => {
        const lbl = d.data.label ?? '';
        return lbl.length > 18 ? lbl.slice(0, 17) + '…' : lbl;
      });

    // Sub-label (IP)
    node.filter(d => !d.data.isRoot && d.data.note && !d.data.isGroup)
      .append('text')
      .attr('dy', '1.6em').attr('text-anchor', 'middle')
      .attr('font-size', 9).attr('fill', '#1a1a1a').attr('opacity', 0.7)
      .attr('pointer-events', 'none')
      .text(d => d.data.note?.frontmatter?.ip ?? '');

    // Tooltip
    node.filter(d => !d.data.isRoot).append('title').text(d => {
      if (!d.data.note) return d.data.label;
      const f = d.data.note.frontmatter;
      return [f.hostname, f.ip, f.type, f.role].filter(Boolean).join(' · ');
    });
  }

  onMount(() => {
    const stop = $effect.root(() => {
      rows; allNotes; docwright; // track reactive deps
      render();
    });
    const ro = new ResizeObserver(() => render());
    ro.observe(container);
    return () => {
      stop();
      ro.disconnect();
    };
  });
</script>

<div class="hier-wrap" bind:this={container}>
  <svg bind:this={svgEl}></svg>
  {#if rows.length === 0}
    <div class="empty">No nodes to display.</div>
  {/if}
</div>

<style lang="scss">
  @use './tokens' as *;

  .hier-wrap {
    position: relative; width: 100%; height: 560px;
    background: $bg-2; border-radius: 6px; overflow: auto;
  }
  svg { display: block; min-width: 100%; min-height: 100%; }

  .empty {
    position: absolute; inset: 0; display: flex; align-items: center;
    justify-content: center; color: $muted; font-size: 13px;
  }
</style>
