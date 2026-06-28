import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/session.js';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('dw_session');
	if (sessionId) {
		deleteSession(sessionId);
		cookies.delete('dw_session', { path: '/' });
	}
	throw redirect(303, '/login');
};
