import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export function GET({ request }) {
  let watcher: fs.FSWatcher | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: object) => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* ignore closed stream */ }
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

      request.signal.addEventListener('abort', () => {
        closed = true;
        if (watcher) watcher.close();
      });
    },
    cancel() {
      closed = true;
      if (watcher) watcher.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
