import fs from 'node:fs';
import path from 'node:path';
import { readPlanSteps, markStepStatus } from './plan-parser';
import type { PlanStep, StepStatus } from './plan-parser';
import { acquireLock, releaseLock, writeCheckpoint, removeCheckpoint } from './state';

export type StepResult = { success: true; sessionId?: string } | { success: false; error: string };

export type ExecuteStepFn = (
  step: PlanStep,
  total: number,
  send: (event: string, data: unknown) => void,
) => Promise<StepResult>;

export interface VerifyResult {
  passed: boolean;
  category: string;
  details: string;
}

export type VerifyStepFn = (
  step: PlanStep,
) => Promise<VerifyResult>;

export function isExecuting(planName: string): boolean {
  const safeName = planName.replace(/[/\\?%*:|"<>]/g, '-');
  const lockPath = path.join('.docwright', 'executor-locks', `${safeName}.lock`);
  return fs.existsSync(lockPath);
}

export async function executePlan(
  planFilePath: string,
  executeStep: ExecuteStepFn,
  send: (event: string, data: unknown) => void,
  verifyStep?: VerifyStepFn,
  reExecuteStep?: ExecuteStepFn,
): Promise<void> {
  const planName = planFilePath.replace(/\.md$/, '').split('/').pop() || planFilePath;

  if (!acquireLock(planName)) {
    send('error', { message: `Plan "${planName}" is already being executed (lock held).` });
    return;
  }

  try {
    let content: string;
    try {
      content = fs.readFileSync(planFilePath, 'utf-8');
    } catch (err: any) {
      send('error', { message: `Cannot read plan: ${err.message}` });
      return;
    }

    const steps = readPlanSteps(planFilePath);
    if (steps.length === 0) {
      send('done', { message: 'No Implementation Steps found in plan.' });
      return;
    }

    const pending = steps.filter(s => s.status === 'pending' || s.status === 'failed' || s.status === 'unknown');
    if (pending.length === 0) {
      send('done', { message: 'All steps already complete.' });
      return;
    }

    send('status', { message: `Starting — ${pending.length}/${steps.length} step(s) pending` });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.status === 'done') continue;

      // Write checkpoint before starting the step
      writeCheckpoint(planName, {
        current_step: step.stepNumber,
        session_id: '', // To be filled by executeStep if possible
        started_at: new Date().toISOString(),
      });

      send('status', { message: `Executing step ${step.stepNumber}/${steps.length}: ${step.action}` });

      const result = await executeStep(step, steps.length, send);

      if (result.success) {
        // Verify the step result if a verify callback is provided
        if (verifyStep) {
          const verifyResult = await verifyStep(step);

          if (!verifyResult.passed) {
            send('status', { message: `Verification failed for step ${step.stepNumber}: ${verifyResult.details}` });

            // Re-run the step session once on verification failure
            if (reExecuteStep) {
              send('status', { message: `Re-running step ${step.stepNumber} after verification failure…` });
              const retryResult = await reExecuteStep(step, steps.length, send);

              if (retryResult.success) {
                // Re-verify after re-run
                const retryVerify = await verifyStep(step);
                if (retryVerify.passed) {
                  content = markStepStatus(content, step.stepNumber, 'done' as StepStatus);
                  fs.writeFileSync(planFilePath, content, 'utf-8');
                  steps[i] = { ...step, status: 'done' as StepStatus, rawStatus: '✅ Done' };
                  send('step_done', { step: step.stepNumber, action: step.action, verified: true });
                  continue;
                }
                // re-run succeeded but verify still fails
                send('status', { message: `Verification still failing after re-run: ${retryVerify.details}` });
              }
            }

            // Mark as failed
            content = markStepStatus(content, step.stepNumber, 'failed' as StepStatus);
            fs.writeFileSync(planFilePath, content, 'utf-8');
            send('error', {
              message: `Step ${step.stepNumber} failed verification: ${verifyResult.details}`,
              step: step.stepNumber,
            });
            return;
          }
        }

        content = markStepStatus(content, step.stepNumber, 'done' as StepStatus);
        fs.writeFileSync(planFilePath, content, 'utf-8');
        steps[i] = { ...step, status: 'done' as StepStatus, rawStatus: '✅ Done' };
        send('step_done', { step: step.stepNumber, action: step.action });
      } else {
        content = markStepStatus(content, step.stepNumber, 'failed' as StepStatus);
        fs.writeFileSync(planFilePath, content, 'utf-8');
        send('error', { message: result.error || `Step ${step.stepNumber} failed`, step: step.stepNumber });
        return;
      }
    }

    removeCheckpoint(planName);
    send('done', { message: 'All steps complete.' });
  } finally {
    releaseLock(planName);
  }
}
