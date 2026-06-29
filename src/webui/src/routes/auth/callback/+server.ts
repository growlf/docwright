import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { exchangeCode, getUserInfo, getUserTeams } from '$lib/server/forgejo-oauth.js';
import { createSession, SESSION_COOKIE_MAX_AGE } from '$lib/server/session.js';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const savedState = cookies.get('oauth_state');

	if (!code || !state || state !== savedState) {
		throw redirect(303, '/login?error=invalid_state');
	}

	cookies.delete('oauth_state', { path: '/' });

	const returnTo = cookies.get('oauth_return') || '/';
	cookies.delete('oauth_return', { path: '/' });

	try {
		const token = await exchangeCode(code, `${url.origin}/auth/callback`);
		const [info, teams] = await Promise.all([getUserInfo(token), getUserTeams(token)]);

		const sessionId = createSession({ ...info, teams });
		cookies.set('dw_session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: SESSION_COOKIE_MAX_AGE,
			secure: url.hostname !== 'localhost',
		});

		throw redirect(303, returnTo);
	} catch (err) {
		if (err instanceof Response) throw err;
		console.error('OAuth callback error:', err);
		throw redirect(303, '/login?error=oauth_failed');
	}
};
