import fs from 'node:fs';
import path from 'node:path';
import { rebuildIfStale } from '../../../../../dispatch/vault-index';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const VAULT_ROOT = process.env.DOCWRIGHT_VAULT_ROOT ?? process.cwd();
const PLUGINS_DIR = path.join(VAULT_ROOT, 'plugins');

export function GET({ request }) {
  let watcher: fs.FSWatcher | null = null;
  let pluginWatcher: fs.FSWatcher | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let pluginDebounce: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (event: string, data: object) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* ignore closed stream */ }
      };

      const keepalive = () => {
        if (closed) return;
        try {
          // SSE comment line — ignored by browser, flushes the stream buffer
          controller.enqueue(enc.encode(': keepalive\n\n'));
        } catch { /* ignore */ }
      };

      try {
        // Debounce index rebuilds — file saves often fire multiple rapid events
        watcher = fs.watch(REPO_ROOT, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          const name = String(filename);
          if (!name.endsWith('.md') && eventType !== 'rename') return;
          send('filechange', { event: eventType, path: name.replace(/\\/g, '/') });
          // Rebuild and persist the index 500ms after the last change in the burst
          if (rebuildTimer) clearTimeout(rebuildTimer);
          rebuildTimer = setTimeout(() => {
            try { rebuildIfStale(REPO_ROOT); } catch { /* non-fatal */ }
          }, 500);
        });
      } catch (err) {
        send('error', { message: 'watch not supported on this platform' });
      }

      // Watch plugins/ for hot-reload — non-fatal if the directory doesn't exist yet
      if (fs.existsSync(PLUGINS_DIR)) {
        try {
          pluginWatcher = fs.watch(PLUGINS_DIR, { recursive: true }, (_eventType, filename) => {
            if (!filename) return;
            if (pluginDebounce) clearTimeout(pluginDebounce);
            pluginDebounce = setTimeout(() => {
              send('pluginchange', { changed: String(filename).replace(/\\/g, '/') });
            }, 300);
          });
        } catch { /* watch not supported — ignore */ }
      }

      send('open', { root: REPO_ROOT });

      // Heartbeat every 15s — keeps connection alive and flushes any buffered events
      heartbeat = setInterval(keepalive, 15_000);

      const cleanup = () => {
        closed = true;
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        if (watcher) { watcher.close(); watcher = null; }
        if (pluginWatcher) { pluginWatcher.close(); pluginWatcher = null; }
        if (rebuildTimer) { clearTimeout(rebuildTimer); rebuildTimer = null; }
        if (pluginDebounce) { clearTimeout(pluginDebounce); pluginDebounce = null; }
      };

      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
      if (watcher) { watcher.close(); watcher = null; }
      if (pluginWatcher) { pluginWatcher.close(); pluginWatcher = null; }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
