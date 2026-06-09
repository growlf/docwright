// Cross-session coordination for WAITING prompts.
// Maps sessionId → { resolve, reject } so the follow-up endpoint can
// deliver human responses back to the running session.

const pendingWaiting = new Map<string, { resolve: (msg: string) => void; reject: (err: Error) => void }>();

export function createWaitingPromise(sessionId: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    pendingWaiting.set(sessionId, { resolve, reject });
  });
}

export function resolveWaiting(sessionId: string, message: string): boolean {
  const entry = pendingWaiting.get(sessionId);
  if (!entry) return false;
  entry.resolve(message);
  pendingWaiting.delete(sessionId);
  return true;
}

export function rejectWaiting(sessionId: string, error: string): boolean {
  const entry = pendingWaiting.get(sessionId);
  if (!entry) return false;
  entry.reject(new Error(error));
  pendingWaiting.delete(sessionId);
  return true;
}
