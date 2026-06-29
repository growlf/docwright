import type { LayoutServerLoad } from './$types.js';
import { getSessionExpiry } from '$lib/server/session.js';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const sessionId = cookies.get('dw_session');
	const sessionExpiresAt = sessionId ? getSessionExpiry(sessionId) : null;
	return { user: locals.user, sessionExpiresAt };
};
