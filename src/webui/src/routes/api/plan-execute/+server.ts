import fs from 'node:fs';
import path from 'node:path';
import { executePlan, isExecuting } from '../../../../../executor/orchestrator';
import { runStepSession } from '../../../../../executor/session';
import { createWaitingPromise } from '../../../../../executor/waiting';
import type { SessionConfig } from '../../../../../executor/session';
import type { PlanStep } from '../../../../../executor/plan-parser';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

const OPENCODE_URL = process.env.OPENCODE_URL;
const STEP_TIMEOUT = parseInt(process.env.DOCWRIGHT_EXECUTOR_TIMEOUT_SECONDS || '300', 10) * 1000;
const MAX_RETRIES = parseInt(process.env.DOCWRIGHT_EXECUTOR_MAX_RETRIES || '1', 10);

function readProjectModel(): string | undefined {
  try {
    const p = path.join(REPO_ROOT, 'opencode.json');
    if (fs.existsSync(p)) {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return cfg.model || undefined;
    }
  } catch { /* ignore */ }
  return undefined;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST({ request }) {
  const { path: planPath } = await request.json();
  if (!planPath) return new Response('missing path', { status: 400 });

  const resolved = path.resolve(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return new Response('invalid path', { status: 403 });
  if (!fs.existsSync(resolved)) return new Response('not found', { status: 404 });

  const planName = planPath.replace(/\.md$/, '').split('/').pop() || planPath;

  if (isExecuting(planName)) {
    return new Response(JSON.stringify({ error: `Plan "${planName}" is already being executed` }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!OPENCODE_URL) {
    return new Response(JSON.stringify({ error: 'OPENCODE_URL not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionConfig: SessionConfig = {
    opencodeUrl: OPENCODE_URL,
    repoRoot: REPO_ROOT,
    stepTimeout: STEP_TIMEOUT,
    maxRetries: MAX_RETRIES,
    model: readProjectModel(),
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(new TextEncoder().encode(sse(event, data)));
      };

      async function runStep(step: PlanStep, total: number, stepSend: (event: string, data: unknown) => void) {
        const result = await runStepSession(step, total, resolved, sessionConfig, {
          onLog: (text: string) => stepSend('log', { text }),
          onWaiting: async (_question: string, sessionId: string) => {
            return await createWaitingPromise(sessionId);
          },
        });
        return result;
      }

      try {
        await executePlan(resolved, runStep, send);
      } catch (err: any) {
        send('error', { message: `Orchestrator error: ${err.message}` });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
