/**
 * GET /api/vault/query — filtered document list from the vault index
 *
 * Query params (all optional, combinable):
 *   type    — docType: proposal | plan | doc | policy | research
 *   status  — document status: draft | approved | in-progress | completed | canceled
 *   phase   — phase number or string
 *   tags    — comma-separated tag list (all must match)
 *   author  — author name
 *
 * Response: { documents: QueryResult[], count: number }
 */
import path from 'node:path';
import { json } from '@sveltejs/kit';
import {
  rebuildIfStale, queryDocuments, inferDocType,
} from '../../../../../../dispatch/vault-index';
import type { VaultEntry } from '../../../../../../dispatch/vault-index';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');

function toResult(entry: VaultEntry) {
  const { fm, path: p, edges, contentHash } = entry;
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String)
    : typeof fm.tags === 'string' ? fm.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : [];
  return {
    path: p,
    title: String(fm.title ?? path.basename(p, '.md')),
    docType: String(fm.docType ?? fm.type ?? inferDocType(p)),
    status: String(fm.status ?? (fm.approved === true ? 'approved' : 'draft')),
    phase: String(fm.phase ?? ''),
    tags,
    author: String(fm.author ?? ''),
    priority: fm.priority ?? '',
    approved: fm.approved,
    edgeCount: edges.length,
    contentHash,
  };
}

export function GET({ url }) {
  try {
    const index = rebuildIfStale(REPO_ROOT);

    const typeParam   = url.searchParams.get('type');
    const statusParam = url.searchParams.get('status');
    const phaseParam  = url.searchParams.get('phase');
    const tagsParam   = url.searchParams.get('tags');
    const authorParam = url.searchParams.get('author');

    const filter: Record<string, any> = {};
    if (typeParam)   filter.docType = typeParam.includes(',') ? typeParam.split(',') : typeParam;
    if (statusParam) filter.status  = statusParam.includes(',') ? statusParam.split(',') : statusParam;
    if (phaseParam)  filter.phase   = phaseParam;
    if (tagsParam)   filter.tags    = tagsParam.split(',').map(t => t.trim()).filter(Boolean);
    if (authorParam) filter.author  = authorParam;

    const results = queryDocuments(index, filter).map(toResult);
    return json({ documents: results, count: results.length });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}
