import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { findPlugin, pluginStaticFile } from '$lib/server/plugins.js';
import type { RequestHandler } from './$types.js';

const MIME: Record<string, string> = {
  js:   'application/javascript',
  css:  'text/css',
  html: 'text/html',
  json: 'application/json',
  svg:  'image/svg+xml',
  png:  'image/png',
  ico:  'image/x-icon',
};

function mime(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

async function handle(method: string, params: { name: string; path: string }, request: Request): Promise<Response> {
  const plugin = findPlugin(params.name);
  if (!plugin) return new Response('Plugin not found', { status: 404 });

  const subpath = params.path ?? '';

  // Serve static files from the plugin directory (e.g. client/bundle.js)
  const staticPath = pluginStaticFile(plugin, subpath);
  if (staticPath) {
    return new Response(fs.readFileSync(staticPath), {
      headers: { 'Content-Type': mime(staticPath), 'Cache-Control': 'no-cache' },
    });
  }

  // Dispatch to plugin server.js handler
  const serverPath = path.join(plugin.dir, plugin.manifest.serverEntrypoint);
  if (!fs.existsSync(serverPath)) {
    return new Response('Plugin has no server handler', { status: 404 });
  }

  try {
    const req = createRequire(import.meta.url);
    // Bust require cache in dev so edits take effect without restart
    delete req.cache[req.resolve(serverPath)];
    const mod = req(serverPath) as Record<string, unknown>;
    const fn = mod[method] ?? mod['default'];
    if (typeof fn !== 'function') {
      return new Response(`Plugin has no ${method} handler`, { status: 404 });
    }
    return await (fn as (ctx: { request: Request; subpath: string }) => Promise<Response>)({ request, subpath });
  } catch (e) {
    console.error(`[plugin:${plugin.manifest.name}] ${method} error:`, e);
    return new Response('Plugin error', { status: 500 });
  }
}

export const GET:    RequestHandler = ({ params, request }) => handle('GET',    params as { name: string; path: string }, request);
export const POST:   RequestHandler = ({ params, request }) => handle('POST',   params as { name: string; path: string }, request);
export const PUT:    RequestHandler = ({ params, request }) => handle('PUT',    params as { name: string; path: string }, request);
export const DELETE: RequestHandler = ({ params, request }) => handle('DELETE', params as { name: string; path: string }, request);
