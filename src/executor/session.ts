import type { PlanStep } from './plan-parser';

export interface SessionConfig {
  opencodeUrl: string;
  repoRoot: string;
  stepTimeout: number;
  maxRetries: number;
  model?: string; // e.g. "opencode/big-pickle" — read from opencode.json at plan-execute time
}

export interface SessionEvents {
  onLog: (text: string) => void;
  onWaiting: (question: string, sessionId: string) => Promise<string>;
  /**
   * Called with the OpenCode session id as soon as it is created, BEFORE the
   * prompt is sent. The live executor (LIVE_AI_EXECUTOR) uses this to tell the
   * panel which session to stream via /api/ai/stream. Optional — the legacy
   * blocking path leaves it unset.
   */
  onSession?: (sessionId: string) => void;
}

export interface SessionResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * Pluggable per-step transport. The control flow (retries, timeout, marker
 * parsing, WAITING follow-ups) lives in runStepSession and never changes; only
 * HOW a session is created and a turn is sent differs:
 *   - blocking (default): POST /session + blocking POST /message (legacy).
 *   - live (injected by the webui route): owned session + prompt_async streamed
 *     on the /event bus, so the panel can render it live.
 * `send` returns the assistant's full text for marker parsing either way.
 */
export interface StepTransport {
  createSession(signal: AbortSignal): Promise<string>;
  send(sessionId: string, text: string, signal: AbortSignal): Promise<string>;
}

// ── Pure helpers (exported so the live transport/tests can reuse them) ───────

export function buildStepPrompt(step: PlanStep, total: number, planName: string, repoRoot: string): string {
  return [
    `You are executing Step ${step.stepNumber}/${total} of plan "${planName}".`,
    '',
    `Action: ${step.action}`,
    step.details ? `Details: ${step.details}` : '',
    '',
    `Complete the work described above in the repository at ${repoRoot}.`,
    'When you are done and have verified the work, respond with exactly:',
    'STEP DONE',
    '',
    'If you are blocked and need human input, respond with:',
    'WAITING: <your question>',
    '',
    'If the step cannot be completed, respond with:',
    'STEP FAILED: <reason>',
  ].filter(Boolean).join('\n');
}

export function extractMarker(text: string): 'done' | 'failed' | 'waiting' | null {
  if (text.includes('STEP DONE')) return 'done';
  if (text.includes('STEP FAILED:')) return 'failed';
  if (text.includes('WAITING:')) return 'waiting';
  return null;
}

export function extractFailedReason(text: string): string {
  const m = text.match(/STEP FAILED:\s*(.+)/);
  return m ? m[1].trim() : 'No reason given';
}

export function extractWaitingQuestion(text: string): string {
  const m = text.match(/WAITING:\s*(.+)/);
  return m ? m[1].trim() : 'No question provided';
}

/**
 * Default (legacy) transport: create a plain session and send via the blocking
 * /message endpoint. Behavior is byte-for-byte what runStepSession did inline
 * before the transport was extracted.
 */
export function createBlockingTransport(config: SessionConfig): StepTransport {
  const dirParam = `directory=${encodeURIComponent(config.repoRoot)}`;
  return {
    async createSession(signal) {
      let sessionBody: Record<string, string> = {};
      if (config.model) {
        const slash = config.model.indexOf('/');
        if (slash > 0) {
          sessionBody = { providerID: config.model.slice(0, slash), modelID: config.model.slice(slash + 1) };
        }
      }
      const sessRes = await fetch(`${config.opencodeUrl}/session?${dirParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody),
        signal,
      });
      if (!sessRes.ok) throw new Error(`Session create failed: ${sessRes.status}`);
      const sess = await sessRes.json();
      const sessionId: string = sess?.id ?? sess?.sessionID;
      if (!sessionId) throw new Error('OpenCode returned no session ID');
      return sessionId;
    },
    async send(sessionId, text, signal) {
      const msgRes = await fetch(`${config.opencodeUrl}/session/${sessionId}/message?${dirParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text }] }),
        signal,
      });
      if (!msgRes.ok) {
        const friendly = msgRes.status === 500
          ? 'AI unavailable — model backend not responding. Check that ollama/Olla is running.'
          : `Message failed: ${msgRes.status}`;
        throw new Error(friendly);
      }
      const data = await msgRes.json();
      const parts: Array<{ type: string; text?: string }> = data?.parts ?? [];
      return parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('');
    },
  };
}

export async function runStepSession(
  step: PlanStep,
  total: number,
  planFilepath: string,
  config: SessionConfig,
  events: SessionEvents,
  transport: StepTransport = createBlockingTransport(config),
): Promise<SessionResult> {
  const planName = planFilepath.replace(/\.md$/, '').split('/').pop() || planFilepath;
  const prompt = buildStepPrompt(step, total, planName, config.repoRoot);

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (attempt > 0) {
      events.onLog(`Retrying (attempt ${attempt + 1}/${config.maxRetries + 1})…\n`);
    }

    const abortCtrl = new AbortController();
    const abortTimer = setTimeout(() => abortCtrl.abort(), config.stepTimeout);

    try {
      events.onLog('Creating session…\n');
      const sessionId = await transport.createSession(abortCtrl.signal);
      events.onSession?.(sessionId);

      events.onLog('Sending prompt to AI…\n');

      // Heartbeat: emit a tick every 5s while waiting so the Execute panel
      // shows activity and humans don't assume the executor is frozen.
      let waitSecs = 0;
      const heartbeat = setInterval(() => {
        waitSecs += 5;
        events.onLog(`⏳ BigPickle thinking… ${waitSecs}s\n`);
      }, 5000);

      let fullText: string;
      try {
        fullText = await transport.send(sessionId, prompt, abortCtrl.signal);
      } finally {
        clearInterval(heartbeat);
      }

      clearTimeout(abortTimer);

      // Stream the response as log events (in 80-char chunks for progressive display)
      const chunkSize = 80;
      for (let i = 0; i < fullText.length; i += chunkSize) {
        events.onLog(fullText.slice(i, i + chunkSize));
      }
      events.onLog('\n');

      // Check for completion markers
      const marker = extractMarker(fullText);

      switch (marker) {
        case 'done':
          return { success: true, sessionId };

        case 'failed':
          return { success: false, sessionId, error: extractFailedReason(fullText) };

        case 'waiting': {
          const question = extractWaitingQuestion(fullText);
          const humanResponse = await events.onWaiting(question, sessionId);

          // Send human response to the same session
          const followText = await transport.send(sessionId, humanResponse, abortCtrl.signal);

          // Stream follow-up tokens
          for (let i = 0; i < followText.length; i += chunkSize) {
            events.onLog(followText.slice(i, i + chunkSize));
          }
          events.onLog('\n');

          // Check final marker after follow-up
          const followMarker = extractMarker(followText);
          if (followMarker === 'done') return { success: true, sessionId };
          if (followMarker === 'failed') return { success: false, sessionId, error: extractFailedReason(followText) };
          // If still waiting, loop until resolved or failed
          if (followMarker === 'waiting') {
            // Recursive call to handle chained WAITING
            const subResult = await runStepSession(step, total, planFilepath, config, events, transport);
            return subResult;
          }

          // No explicit marker after follow-up — assume success
          return { success: true, sessionId };
        }

        default:
          // No explicit marker — assume success
          return { success: true, sessionId };
      }
    } catch (err: any) {
      clearTimeout(abortTimer);
      lastError = err.message;

      if (err.name === 'AbortError' || err.message.includes('aborted')) {
        events.onLog(`Timeout after ${config.stepTimeout / 1000}s\n`);
        if (attempt < config.maxRetries) {
          events.onLog(`Retrying (${attempt + 1}/${config.maxRetries})…\n`);
          continue;
        }
        return { success: false, error: `Step timed out after ${config.maxRetries + 1} attempts` };
      }

      // Non-timeout error — no retry
      return { success: false, error: lastError };
    }
  }

  return { success: false, error: lastError || 'Unknown session error' };
}
