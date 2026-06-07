import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');
const TAG_RE = /^v0\.\d+\.\d+$/;

function getGithubRepo(): string {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: REPO_ROOT, encoding: 'utf-8' });
  const m = r.stdout.trim().match(/github\.com[:/]([^/]+\/[^.]+?)(?:\.git)?$/);
  return m ? m[1] : '';
}

function ghJson(args: string[]): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn('gh', args, { cwd: REPO_ROOT });
    let out = '';
    proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    proc.on('close', () => { try { resolve(JSON.parse(out)); } catch { resolve(null); } });
    proc.on('error', () => resolve(null));
  });
}

export function GET({ url, request }: { url: URL; request: Request }) {
  const tag = url.searchParams.get('tag') ?? '';

  if (!TAG_RE.test(tag)) {
    return new Response('invalid tag — must be v0.x.x', { status: 400 });
  }

  const repo = getGithubRepo();
  if (!repo) {
    return new Response('could not determine GitHub repo from origin remote', { status: 500 });
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: object) => {
        if (closed) return;
        try {
          controller.enqueue(
            new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch { /* stream already closed */ }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        try { controller.close(); } catch { /* already closed */ }
      };

      let runId: string | null = null;
      let elapsed = 0;

      const poll = async () => {
        if (closed) return;
        elapsed += 3;

        if (!runId) {
          // Look for the run triggered by this tag push
          const runs = await ghJson([
            'run', 'list', '--repo', repo, '--limit', '5',
            '--json', 'databaseId,event,headBranch,status',
          ]) as Array<{ databaseId: number; event: string; headBranch: string; status: string }> | null;

          const match = runs?.find(
            r => r.event === 'push' && r.headBranch === tag && r.status !== 'completed'
          );

          if (match) {
            runId = String(match.databaseId);
            send('found', {
              runId,
              url: `https://github.com/${repo}/actions/runs/${runId}`,
              message: `CI run found — watching…`,
            });
          } else if (elapsed >= 45) {
            send('error', { message: 'CI run did not appear within 45s. Check GitHub Actions manually.' });
            close();
            return;
          } else {
            send('waiting', { message: `Waiting for CI run… (${elapsed}s)` });
          }
        } else {
          // Poll the run's current status
          const run = await ghJson([
            'run', 'view', runId, '--repo', repo,
            '--json', 'status,conclusion,jobs',
          ]) as { status: string; conclusion: string; jobs: Array<{ name: string; status: string; conclusion: string }> } | null;

          if (!run) {
            if (!closed) schedule();
            return;
          }

          const jobSummary = (run.jobs ?? []).map(j => ({
            name: j.name,
            status: j.status,
            conclusion: j.conclusion,
          }));

          if (run.status === 'completed') {
            send('conclusion', {
              conclusion: run.conclusion,
              runId,
              url: `https://github.com/${repo}/actions/runs/${runId}`,
              jobs: jobSummary,
            });
            close();
            return;
          }

          const inFlight = jobSummary.filter(j => j.status === 'in_progress').map(j => j.name);
          send('progress', {
            message: inFlight.length ? `Running: ${inFlight.join(', ')}` : 'Queued…',
            jobs: jobSummary,
          });
        }

        schedule();
      };

      const schedule = () => {
        if (!closed) timer = setTimeout(poll, 3000);
      };

      request.signal.addEventListener('abort', close);
      poll();
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
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
