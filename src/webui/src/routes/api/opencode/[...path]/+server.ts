import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { opencodeHeaders } from '../../../../../dispatch/opencode-auth';

const OPENCODE_BASE = process.env.OPENCODE_URL ?? 'http://127.0.0.1:4096';
const VAULT_DIR = process.env.DOCWRIGHT_ROOT ?? '';

function buildHeaders(incoming: Headers): HeadersInit {
  const h: Record<string, string> = opencodeHeaders({
    'Content-Type': incoming.get('content-type') ?? 'application/json',
  });
  if (VAULT_DIR) {
    h['x-opencode-directory'] = VAULT_DIR;
  }
  const accept = incoming.get('accept');
  if (accept) h['Accept'] = accept;
  return h;
}

async function proxy(method: string, path: string, searchStr: string, body?: BodyInit | null): Promise<Response> {
  const url = `${OPENCODE_BASE}/${path}${searchStr}`;
  try {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(new Headers()),
      body: body ?? undefined,
      // @ts-expect-error — Node 18+ fetch supports duplex
      duplex: 'half',
    });

    // Stream SSE and binary responses directly — do not buffer
    const ct = res.headers.get('content-type') ?? '';
    const headers = new Headers();
    if (ct) headers.set('content-type', ct);
    if (ct.includes('event-stream')) {
      headers.set('cache-control', 'no-cache');
      headers.set('x-accel-buffering', 'no');
    }
    const corsHeader = res.headers.get('access-control-allow-origin');
    if (corsHeader) headers.set('access-control-allow-origin', corsHeader);

    return new Response(res.body, { status: res.status, headers });
  } catch {
    return new Response(
      JSON.stringify({ error: 'OpenCode not reachable', hint: 'Run `opencode serve` to enable AI features' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }
}

export const GET: RequestHandler = ({ params, url }) =>
  proxy('GET', params.path, url.search);

export const POST: RequestHandler = ({ params, url, request }) =>
  proxy('POST', params.path, url.search, request.body);

export const DELETE: RequestHandler = ({ params, url }) =>
  proxy('DELETE', params.path, url.search);

export const PUT: RequestHandler = ({ params, url, request }) =>
  proxy('PUT', params.path, url.search, request.body);

export const PATCH: RequestHandler = ({ params, url, request }) =>
  proxy('PATCH', params.path, url.search, request.body);
