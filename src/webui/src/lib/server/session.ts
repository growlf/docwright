import type { DocWrightUser } from '../../app.js';
import { randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

interface Session {
	user: DocWrightUser;
	expiresAt: number;
}

// In-memory store — sufficient for single-process deployments.
// Replace with a Redis adapter for horizontal scaling (Phase 3).
const store = new Map<string, Session>();

export function createSession(user: DocWrightUser): string {
	const id = randomBytes(32).toString('hex');
	store.set(id, { user, expiresAt: Date.now() + SESSION_TTL_MS });
	return id;
}

export function getSession(id: string): DocWrightUser | null {
	const session = store.get(id);
	if (!session) return null;
	if (Date.now() > session.expiresAt) {
		store.delete(id);
		return null;
	}
	return session.user;
}

export function deleteSession(id: string): void {
	store.delete(id);
}

// Prune expired sessions every hour to prevent unbounded growth.
setInterval(() => {
	const now = Date.now();
	for (const [id, session] of store) {
		if (now > session.expiresAt) store.delete(id);
	}
}, 60 * 60 * 1000).unref();
