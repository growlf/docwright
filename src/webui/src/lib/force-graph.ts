/** Shared types for ForceGraph.svelte and its wrappers. */

export interface ForceNode {
  id: string;
  label: string;          // primary display label
  path: string;           // navigation path on click
  fields: Record<string, string | number | boolean>;  // filterable attributes
  // D3 simulation positions (mutated in place)
  x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null;
}

export interface ForceEdge {
  source: string | ForceNode;
  target: string | ForceNode;
  type: string;
}

export interface FilterControl {
  field: string;                       // key in ForceNode.fields
  label: string;                       // sidebar section heading
  colors?: Record<string, string>;     // value → CSS color dot
  type?: 'multiselect' | 'select';    // default: multiselect
}

export interface GapItem {
  label: string;
  color: string;
  count: number;
}
