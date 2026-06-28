import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { exchangeCode, getUserInfo, getUserTeams } from '$lib/server/forgejo-oauth.js';
import { createSession } from '$lib/server/session.js';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const savedState = cookies.get('oauth_state');

	if (!code || !state || state !== savedState) {
		throw redirect(303, '/login?error=invalid_state');
	}

	cookies.delete('oauth_state', { path: '/' });

	try {
		const redirectUri = `${url.origin}/auth/callback`;
		const token = await exchangeCode(code, redirectUri);
		const [info, teams] = await Promise.all([getUserInfo(token), getUserTeams(token)]);
		const user = { ...info, teams };

		const sessionId = createSession(user);
		cookies.set('dw_session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 8 * 60 * 60,
			secure: url.hostname !== 'localhost',
		});

		throw redirect(303, '/');
	} catch (err) {
		if (err instanceof Response) throw err; // rethrow SvelteKit redirects
		console.error('OAuth callback error:', err);
		throw redirect(303, '/login?error=oauth_failed');
	}
};
