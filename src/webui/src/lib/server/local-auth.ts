import type { DocWrightUser } from '../../app.js';

// Single-user local auth for air-gapped / dev deployments.
// Set LOCAL_AUTH_USER and LOCAL_AUTH_PASSWORD in .env.
// Not intended for multi-user production use.
export function validateLocalAuth(username: string, password: string): DocWrightUser | null {
	const expectedUser = process.env.LOCAL_AUTH_USER || 'admin';
	const expectedPass = process.env.LOCAL_AUTH_PASSWORD;

	if (!expectedPass) return null;
	if (username !== expectedUser || password !== expectedPass) return null;

	return {
		id: 'local-admin',
		username,
		email: process.env.LOCAL_AUTH_EMAIL || `${username}@localhost`,
		displayName: process.env.LOCAL_AUTH_DISPLAY_NAME || username,
		teams: ['admin'],
	};
}
