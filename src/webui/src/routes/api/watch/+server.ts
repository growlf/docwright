import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export function GET({ request }) {
  let watcher: fs.FSWatcher | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
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
        watcher = fs.watch(REPO_ROOT, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          const name = String(filename);
          if (!name.endsWith('.md') && eventType !== 'rename') return;
          send('filechange', { event: eventType, path: name.replace(/\\/g, '/') });
        });
      } catch (err) {
        send('error', { message: 'watch not supported on this platform' });
      }

      send('open', { root: REPO_ROOT });

      // Heartbeat every 15s — keeps connection alive and flushes any buffered events
      heartbeat = setInterval(keepalive, 15_000);

      const cleanup = () => {
        closed = true;
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        if (watcher) { watcher.close(); watcher = null; }
      };

      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
      if (watcher) { watcher.close(); watcher = null; }
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
