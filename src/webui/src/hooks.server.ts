import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/server/session.js';

const AUTH_MODE = process.env.AUTH_MODE ?? 'none';

// Routes that never require authentication.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/api/health'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	// AUTH_MODE=none: single-user local dev — bypass all session logic.
	if (AUTH_MODE === 'none') {
		event.locals.user = null;
		return resolve(event);
	}

	const sessionId = event.cookies.get('dw_session');
	const user = sessionId ? getSession(sessionId) : null;
	event.locals.user = user;

	if (!user && !isPublic(event.url.pathname)) {
		const returnTo = event.url.pathname + event.url.search;
		throw redirect(303, `/login?returnTo=${encodeURIComponent(returnTo)}`);
	}

	return resolve(event);
};
