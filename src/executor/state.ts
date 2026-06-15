import fs from 'node:fs';
import path from 'node:path';

export interface Checkpoint {
  current_step: number;
  session_id: string;
  started_at: string;
}

function getDocwrightDir(): string {
  const root = process.env.DOCWRIGHT_ROOT ?? process.cwd();
  return path.resolve(root, '.docwright');
}

function getLockDir(): string { return path.join(getDocwrightDir(), 'executor-locks'); }
function getCheckpointDir(): string { return path.join(getDocwrightDir(), 'executor-checkpoints'); }

function ensureDirs() {
  const lockDir = getLockDir();
  const cpDir = getCheckpointDir();
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });
  if (!fs.existsSync(cpDir)) fs.mkdirSync(cpDir, { recursive: true });
}

/**
 * Atomic lock acquisition using mkdir.
 * Returns true if lock acquired, false if already exists.
 */
export function acquireLock(planName: string): boolean {
  ensureDirs();
  const safeName = planName.replace(/[/\\?%*:|"<>]/g, '-');
  const lockPath = path.join(getLockDir(), `${safeName}.lock`);
  
  try {
    fs.mkdirSync(lockPath);
    return true;
  } catch (err: any) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

/**
 * Release the plan lock.
 */
export function releaseLock(planName: string): void {
  const safeName = planName.replace(/[/\\?%*:|"<>]/g, '-');
  const lockPath = path.join(getLockDir(), `${safeName}.lock`);
  if (fs.existsSync(lockPath)) {
    fs.rmdirSync(lockPath);
  }
}

/**
 * Persist execution state to a checkpoint file.
 */
export function writeCheckpoint(planName: string, checkpoint: Checkpoint): void {
  ensureDirs();
  const safeName = planName.replace(/[/\\?%*:|"<>]/g, '-');
  const cpPath = path.join(getCheckpointDir(), `${safeName}.json`);
  fs.writeFileSync(cpPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

/**
 * Read the current execution state if it exists.
 */
export function readCheckpoint(planName: string): Checkpoint | null {
  const safeName = planName.replace(/[/\\?%*:|"<>]/g, '-');
  const cpPath = path.join(getCheckpointDir(), `${safeName}.json`);
  if (!fs.existsSync(cpPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Clean up the checkpoint after completion or cancellation.
 */
export function removeCheckpoint(planName: string): void {
  const safeName = planName.replace(/[/\\?%*:|"<>]/g, '-');
  const cpPath = path.join(getCheckpointDir(), `${safeName}.json`);
  if (fs.existsSync(cpPath)) {
    fs.unlinkSync(cpPath);
  }
}
