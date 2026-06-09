import assert from 'assert';
import { runStepSession } from '../../src/executor/session';
import type { PlanStep, SessionConfig, SessionEvents } from '../../src/executor/session';

function makeStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    stepNumber: 1,
    action: 'Test step',
    details: 'Do something',
    status: 'pending',
    rawStatus: '⏳ Pending',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    opencodeUrl: 'http://localhost:3000',
    repoRoot: '/tmp/test-repo',
    stepTimeout: 5000,
    maxRetries: 1,
    ...overrides,
  };
}

describe('session', () => {
  describe('runStepSession', () => {
    it('returns success when OpenCode returns STEP DONE', async () => {
      // Mock fetch
      const originalFetch = globalThis.fetch;

      let callCount = 0;
      globalThis.fetch = async (url: string, opts: any) => {
        callCount++;
        if (url.includes('/session') && opts.method === 'POST' && !url.includes('/message')) {
          return new Response(JSON.stringify({ id: 'sess-1' }));
        }
        if (url.includes('/message')) {
          return new Response(JSON.stringify({
            parts: [{ type: 'text', text: 'Work complete.\nSTEP DONE' }],
          }));
        }
        return new Response(null, { status: 404 });
      };

      const logs: string[] = [];
      const events: SessionEvents = {
        onLog: (text: string) => logs.push(text),
        onWaiting: async () => '',
      };

      const result = await runStepSession(
        makeStep(),
        1,
        'plan.md',
        makeConfig(),
        events,
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.sessionId, 'sess-1');
      assert.strictEqual(callCount, 2); // session create + message

      globalThis.fetch = originalFetch;
    });

    it('returns failure when OpenCode returns STEP FAILED', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = async (url: string) => {
        callCount++;
        if (url.includes('/session') && callCount === 1) {
          return new Response(JSON.stringify({ id: 'sess-1' }));
        }
        return new Response(JSON.stringify({
          parts: [{ type: 'text', text: 'Could not do it.\nSTEP FAILED: missing dependency xyz' }],
        }));
      };

      const result = await runStepSession(makeStep(), 1, 'plan.md', makeConfig(), {
        onLog: () => {},
        onWaiting: async () => '',
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('missing dependency xyz'));

      globalThis.fetch = originalFetch;
    });

    it('retries on timeout', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;

      globalThis.fetch = async (url: string) => {
        callCount++;
        // First call (session create in attempt 0) aborts
        if (callCount === 1) {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          throw err;
        }
        // Attempt 1: session create succeeds
        if (callCount === 2) {
          return new Response(JSON.stringify({ id: 'sess-2' }));
        }
        // Attempt 1: message succeeds
        return new Response(JSON.stringify({
          parts: [{ type: 'text', text: 'Done.\nSTEP DONE' }],
        }));
      };

      const logs: string[] = [];
      const result = await runStepSession(makeStep(), 1, 'plan.md', makeConfig({ maxRetries: 1, stepTimeout: 10 }), {
        onLog: (text: string) => logs.push(text),
        onWaiting: async () => '',
      });

      assert.strictEqual(result.success, true);
      // 1 failed call (attempt 0) + 2 successful calls (attempt 1) = 3
      assert.strictEqual(callCount, 3);
      assert.ok(logs.some(l => l.includes('Retry')));

      globalThis.fetch = originalFetch;
    });

    it('fails after exhausting retries', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;

      globalThis.fetch = async () => {
        callCount++;
        throw new DOMException('The operation was aborted', 'AbortError');
      };

      const result = await runStepSession(makeStep(), 1, 'plan.md', makeConfig({ maxRetries: 1, stepTimeout: 10 }), {
        onLog: () => {},
        onWaiting: async () => '',
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('timed out'));

      globalThis.fetch = originalFetch;
    });

    it('pauses for WAITING and resumes after human input', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;

      globalThis.fetch = async (url: string) => {
        callCount++;
        if (callCount === 2) {
          // First message — agent needs input
          return new Response(JSON.stringify({
            parts: [{ type: 'text', text: 'I need to know:\nWAITING: Which port should I use?' }],
          }));
        }
        if (callCount === 4) {
          // Follow-up message — agent resumes
          return new Response(JSON.stringify({
            parts: [{ type: 'text', text: 'Using port 3100.\nSTEP DONE' }],
          }));
        }
        // Session create or other calls
        return new Response(JSON.stringify({ id: 'sess-1' }));
      };

      let askedQuestion = '';
      const events: SessionEvents = {
        onLog: () => {},
        onWaiting: async (question: string, sessionId: string) => {
          askedQuestion = question;
          return 'Port 3100';
        },
      };

      const result = await runStepSession(makeStep(), 1, 'plan.md', makeConfig(), events);

      assert.strictEqual(result.success, true);
      assert.ok(askedQuestion.includes('Which port'));

      globalThis.fetch = originalFetch;
    });

    it('returns success for responses without any marker', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = async (url: string) => {
        callCount++;
        if (url.includes('/session') && !url.includes('/message')) {
          return new Response(JSON.stringify({ id: 'sess-1' }));
        }
        return new Response(JSON.stringify({
          parts: [{ type: 'text', text: 'Here is the implementation.\n```\nconsole.log("hello");\n```' }],
        }));
      };

      const result = await runStepSession(makeStep(), 1, 'plan.md', makeConfig(), {
        onLog: () => {},
        onWaiting: async () => '',
      });

      assert.strictEqual(result.success, true);

      globalThis.fetch = originalFetch;
    });
  });
});
