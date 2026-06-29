import type { PageServerLoad, Actions } from './$types.js';
import { fail, redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { getAuthUrl } from '$lib/server/forgejo-oauth.js';
import { validateLocalAuth } from '$lib/server/local-auth.js';
import { createSession, SESSION_COOKIE_MAX_AGE } from '$lib/server/session.js';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (locals.user) throw redirect(303, url.searchParams.get('returnTo') || '/');
	return {
		authMode: process.env.AUTH_MODE ?? 'none',
		forgejoUrl: process.env.FORGEJO_URL || '',
	};
};

export const actions: Actions = {
	forgejo: async ({ url, cookies }) => {
		const state = randomBytes(16).toString('hex');
		const returnTo = url.searchParams.get('returnTo') || '/';
		const secure = url.hostname !== 'localhost';

		cookies.set('oauth_state', state, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 10,
			secure,
		});
		// Preserve the original destination through the OAuth round-trip.
		cookies.set('oauth_return', returnTo, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 10,
			secure,
		});

		throw redirect(303, getAuthUrl(state, `${url.origin}/auth/callback`));
	},

	local: async ({ request, cookies, url }) => {
		if ((process.env.AUTH_MODE ?? 'none') !== 'local') {
			return fail(403, { error: 'Local auth is not enabled' });
		}

		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const user = await validateLocalAuth(username, password);
		if (!user) return fail(401, { error: 'Invalid username or password' });

		const sessionId = createSession(user);
		cookies.set('dw_session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: SESSION_COOKIE_MAX_AGE,
			secure: url.hostname !== 'localhost',
		});

		throw redirect(303, url.searchParams.get('returnTo') || '/');
	},
};
