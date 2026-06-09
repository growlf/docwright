import type { PlanStep } from './plan-parser';

export interface SessionConfig {
  opencodeUrl: string;
  repoRoot: string;
  stepTimeout: number;
  maxRetries: number;
}

export interface SessionEvents {
  onLog: (text: string) => void;
  onWaiting: (question: string, sessionId: string) => Promise<string>;
}

export interface SessionResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

function buildStepPrompt(
  step: PlanStep,
  total: number,
  planName: string,
  repoRoot: string,
): string {
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

function extractMarker(text: string): 'done' | 'failed' | 'waiting' | null {
  if (text.includes('STEP DONE')) return 'done';
  if (text.includes('STEP FAILED:')) return 'failed';
  if (text.includes('WAITING:')) return 'waiting';
  return null;
}

function extractFailedReason(text: string): string {
  const m = text.match(/STEP FAILED:\s*(.+)/);
  return m ? m[1].trim() : 'No reason given';
}

function extractWaitingQuestion(text: string): string {
  const m = text.match(/WAITING:\s*(.+)/);
  return m ? m[1].trim() : 'No question provided';
}

export async function runStepSession(
  step: PlanStep,
  total: number,
  planFilepath: string,
  config: SessionConfig,
  events: SessionEvents,
): Promise<SessionResult> {
  const planName = planFilepath.replace(/\.md$/, '').split('/').pop() || planFilepath;
  const dirParam = `directory=${encodeURIComponent(config.repoRoot)}`;
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
      const sessRes = await fetch(`${config.opencodeUrl}/session?${dirParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: abortCtrl.signal,
      });
      if (!sessRes.ok) throw new Error(`Session create failed: ${sessRes.status}`);
      const sess = await sessRes.json();
      const sessionId: string = sess?.id ?? sess?.sessionID;
      if (!sessionId) throw new Error('OpenCode returned no session ID');

      events.onLog('Sending prompt to AI…\n');

      const msgRes = await fetch(
        `${config.opencodeUrl}/session/${sessionId}/message?${dirParam}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] }),
          signal: abortCtrl.signal,
        },
      );
      if (!msgRes.ok) throw new Error(`Message failed: ${msgRes.status}`);
      const data = await msgRes.json();
      const parts: Array<{ type: string; text?: string }> = data?.parts ?? [];
      const fullText = parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('');

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
          const followRes = await fetch(
            `${config.opencodeUrl}/session/${sessionId}/message?${dirParam}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parts: [{ type: 'text', text: humanResponse }],
              }),
              signal: abortCtrl.signal,
            },
          );
          if (!followRes.ok) throw new Error(`Follow-up message failed: ${followRes.status}`);
          const followData = await followRes.json();
          const followParts: Array<{ type: string; text?: string }> = followData?.parts ?? [];
          const followText = followParts.filter(p => p.type === 'text').map(p => p.text ?? '').join('');

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
            const subResult = await runStepSession(step, total, planFilepath, config, events);
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
