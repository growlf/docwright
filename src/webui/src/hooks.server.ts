import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/server/session.js';
import { isPublicPath } from '$lib/auth/constants.js';
import type { DocWrightUser } from './app.js';

// Synthetic identity used in AUTH_MODE=none so git commits have attribution.
const DEV_USER: DocWrightUser = {
	id: 'local-dev',
	username: process.env.LOCAL_AUTH_USER ?? 'dev',
	email: process.env.LOCAL_AUTH_EMAIL ?? 'dev@localhost',
	displayName: process.env.LOCAL_AUTH_DISPLAY_NAME ?? 'Dev User',
	teams: ['admin'],
};

export const handle: Handle = async ({ event, resolve }) => {
	const authMode = process.env.AUTH_MODE ?? 'none';

	// AUTH_MODE=none: single-user local dev — bypass all session logic.
	if (authMode === 'none') {
		event.locals.user = DEV_USER;
		return resolve(event);
	}

	const sessionId = event.cookies.get('dw_session');
	const user = sessionId ? getSession(sessionId) : null;
	event.locals.user = user;

	if (!user && !isPublicPath(event.url.pathname)) {
		const returnTo = event.url.pathname + event.url.search;
		throw redirect(303, `/login?returnTo=${encodeURIComponent(returnTo)}`);
	}

	return resolve(event);
};
