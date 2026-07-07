import type { PageServerLoad, Actions } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { getAuthUrl } from '$lib/server/forgejo-oauth.js';

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

};
