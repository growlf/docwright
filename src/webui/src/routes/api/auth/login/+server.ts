import { redirect, type RequestHandler } from '@sveltejs/kit';
import { validateLocalAuth } from '$lib/server/local-auth.js';
import { createSession, SESSION_COOKIE_MAX_AGE } from '$lib/server/session.js';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	console.log('[AUTH] POST /api/auth/login');

	if ((process.env.AUTH_MODE ?? 'none') !== 'local') {
		console.log('[AUTH] Mode not local, got:', process.env.AUTH_MODE);
		return new Response(JSON.stringify({ error: 'Local auth is not enabled' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const data = await request.formData();
	const username = String(data.get('username') ?? '').trim();
	const password = String(data.get('password') ?? '');

	console.log('[AUTH] Validating', username);

	const user = await validateLocalAuth(username, password);
	console.log('[AUTH] Validation result:', user ? 'OK' : 'FAILED');

	if (!user) {
		return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const sessionId = createSession(user);
	const secure = url.hostname !== 'localhost' && url.hostname !== 'docwright-dev.bms.local' && url.hostname !== '10.10.0.201';

	const response = new Response(null, {
		status: 303,
		headers: {
			'Location': url.searchParams.get('returnTo') || '/'
		}
	});

	response.headers.append('Set-Cookie', `dw_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${SESSION_COOKIE_MAX_AGE}`);

	return response;
};
