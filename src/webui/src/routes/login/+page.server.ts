import type { PageServerLoad, Actions } from './$types.js';
import { fail, redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { getAuthUrl } from '$lib/server/forgejo-oauth.js';
import { validateLocalAuth } from '$lib/server/local-auth.js';
import { createSession } from '$lib/server/session.js';

const AUTH_MODE = process.env.AUTH_MODE ?? 'none';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (locals.user) throw redirect(303, url.searchParams.get('returnTo') || '/');
	return {
		authMode: AUTH_MODE,
		forgejoUrl: process.env.FORGEJO_URL || '',
	};
};

export const actions: Actions = {
	forgejo: async ({ url, cookies }) => {
		const state = randomBytes(16).toString('hex');
		cookies.set('oauth_state', state, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 10,
			secure: url.hostname !== 'localhost',
		});
		const redirectUri = `${url.origin}/auth/callback`;
		throw redirect(303, getAuthUrl(state, redirectUri));
	},

	local: async ({ request, cookies, url }) => {
		if (AUTH_MODE !== 'local') return fail(403, { error: 'Local auth is not enabled' });

		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const user = validateLocalAuth(username, password);
		if (!user) return fail(401, { error: 'Invalid username or password' });

		const sessionId = createSession(user);
		cookies.set('dw_session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 8 * 60 * 60,
			secure: url.hostname !== 'localhost',
		});

		throw redirect(303, url.searchParams.get('returnTo') || '/');
	},
};
