<script lang="ts">
  import ForceGraph from './ForceGraph.svelte';
  import type { ForceNode, ForceEdge, FilterControl } from './force-graph.js';

  interface NoteData { path: string; filename: string; frontmatter: Record<string, any>; }
  interface DwViewConfig {
    type?: string; mode?: string;
    nodes?: { labelField?: string; groupBy?: string; colorBy?: string };
    edges?: Array<{ field: string; label: string }>;
    controls?: Array<{ field: string; label: string }>;
    labelField?: string; colorBy?: string;
  }

  let { rows, allNotes, docwright, viewConfig = null }: {
    rows: NoteData[];
    allNotes: NoteData[];
    docwright: any;
    viewConfig?: DwViewConfig | null;
  } = $props();

  // ── Device type colors ────────────────────────────────────────────────────

  const TYPE_COLOR: Record<string, string> = {
    hypervisor: '#4a9eff', lxc: '#4ecdc4', qemu: '#45b7d1',
    router: '#ff6b6b', switch: '#ff8e53', 'access-point': '#f39c12',
    workstation: '#ffd93d', 'bare-metal': '#a8e6cf',
    camera: '#c3a6ff', printer: '#ffaaa5', 'access-control': '#ff9f7f',
    iot: '#78e08f', solar: '#f7dc6f', 'smart-home': '#d2b4de',
    'personal-device': '#abebc6', unknown: '#555',
  };

  const STATUS_COLOR: Record<string, string> = {
    running: '#4ecdc4', active: '#4ecdc4', online: '#4ecdc4', connected: '#4ecdc4',
    stopped: '#ff6b6b', offline: '#ff6b6b', error: '#ff4444',
    inactive: '#888', unknown: '#555',
  };

  // ── Resolve config values ─────────────────────────────────────────────────

  const colorBy    = viewConfig?.nodes?.colorBy   ?? viewConfig?.colorBy   ?? 'type';
  const labelField = viewConfig?.nodes?.labelField ?? viewConfig?.labelField ?? 'hostname';
  const colorMap   = colorBy === 'status' ? STATUS_COLOR : TYPE_COLOR;

  // ── Ref fields → edges ────────────────────────────────────────────────────

  function refFields() {
    if (viewConfig?.edges?.length) {
      return viewConfig.edges.map(e => ({
        field: e.field,
        target: docwright?.fields?.[e.field]?.target ?? 'hostname',
        label: e.label,
      }));
    }
    return Object.entries(docwright?.fields ?? {})
      .filter(([, c]: any) => c.type === 'ref')
      .map(([field, c]: any) => ({ field, target: c.target ?? 'hostname', label: c.edgeLabel ?? field }));
  }

  // ── Map NoteData → ForceNode / ForceEdge ──────────────────────────────────

  let forceNodes: ForceNode[] = $derived(
    rows.map(n => ({
      id: n.filename,
      label: String(n.frontmatter[labelField] ?? n.filename),
      path: n.path,
      fields: Object.fromEntries(
        Object.entries(n.frontmatter)
          .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
          .map(([k, v]) => [k, v])
      ) as Record<string, string | number | boolean>,
    }))
  );

  let forceEdges: ForceEdge[] = $derived.by(() => {
    const refs = refFields();
    const byTarget = new Map(allNotes.map(n => [n.frontmatter.hostname ?? n.filename, n]));
    const links: ForceEdge[] = [];

    for (const note of rows) {
      for (const ref of refs) {
        const val = note.frontmatter[ref.field];
        if (val == null) continue;
        const values: string[] = Array.isArray(val) ? val.filter(v => typeof v === 'string') : [String(val)];
        for (const v of values) {
          const target = byTarget.get(v);
          if (!target) continue;
          links.push({ source: note.filename, target: target.filename, type: ref.label });
        }
      }
    }
    return links;
  });

  // ── Controls: explicit from .base or auto-detect by colorBy ──────────────

  let controls: FilterControl[] = $derived.by(() => {
    if (viewConfig?.controls?.length) {
      return viewConfig.controls.map(c => ({
        field: c.field,
        label: c.label,
        colors: c.field === 'type' ? TYPE_COLOR : c.field === 'status' ? STATUS_COLOR : undefined,
      }));
    }
    // Auto: always include colorBy field if it has entries
    return [{
      field: colorBy,
      label: colorBy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      colors: colorMap,
    }];
  });
</script>

<ForceGraph
  nodes={forceNodes}
  edges={forceEdges}
  {colorBy}
  {colorMap}
  defaultNodeColor="#555"
  {labelField}
  {controls}
/>
