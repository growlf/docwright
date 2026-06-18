/**
 * GET /api/graph — vault knowledge graph
 *
 * Returns the full document index as a graph with nodes (documents) and
 * edges (wikilinks + frontmatter cross-refs). Rebuilds the index if stale.
 *
 * Response: { nodes: GraphNode[], edges: GraphEdge[], indexedAt: string }
 */
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { rebuildIfStale, inferDocType } from '../../../../../dispatch/vault-index';
import type { VaultEntry, VaultEdge } from '../../../../../dispatch/vault-index';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');

interface GraphNode {
  id: string;
  title: string;
  docType: string;
  status: string;
  phase: string;
  tags: string[];
  author: string;
  approved?: boolean;
  contentHash: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

function toNode(entry: VaultEntry): GraphNode {
  const { fm, path: p, contentHash } = entry;
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String)
    : typeof fm.tags === 'string' ? fm.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : [];
  return {
    id: p,
    title: String(fm.title ?? path.basename(p, '.md')),
    docType: String(fm.docType ?? fm.type ?? inferDocType(p)),
    status: String(fm.status ?? (fm.approved === true ? 'approved' : 'draft')),
    phase: String(fm.phase ?? ''),
    tags,
    author: String(fm.author ?? ''),
    approved: fm.approved,
    contentHash,
  };
}

function toEdge(e: VaultEdge): GraphEdge {
  return { source: e.source, target: e.target, type: e.type };
}

export function GET() {
  try {
    const index = rebuildIfStale(REPO_ROOT);
    const nodes = Object.values(index).map(toNode);
    const edges = Object.values(index).flatMap(e => e.edges.map(toEdge));
    return json({ nodes, edges, indexedAt: new Date().toISOString() });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}
