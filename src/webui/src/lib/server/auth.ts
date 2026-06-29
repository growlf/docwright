import type { RequestHandler } from '@sveltejs/kit';

function jsonErr(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

// Wrap a route handler so it returns 401 when the session is missing.
// AUTH_MODE=none always passes (locals.user is the synthetic dev user).
export function requireAuth(handler: RequestHandler): RequestHandler {
	return async (event) => {
		if (!event.locals.user) return jsonErr('Unauthorized', 401);
		return handler(event);
	};
}

// Like requireAuth but also checks Forgejo team membership.
// roles: one or more team names — the user must be in at least one.
export function requireRole(roles: string[], handler: RequestHandler): RequestHandler {
	return async (event) => {
		if (!event.locals.user) return jsonErr('Unauthorized', 401);
		const teams = event.locals.user.teams ?? [];
		if (!roles.some((r) => teams.includes(r))) return jsonErr('Forbidden', 403);
		return handler(event);
	};
}

// True when the request is an API call (expects JSON, not an HTML redirect).
export function isApiRequest(url: URL): boolean {
	return url.pathname.startsWith('/api/');
}
