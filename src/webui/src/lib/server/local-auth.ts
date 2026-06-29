import type { DocWrightUser } from '../../app.js';
import bcrypt from 'bcryptjs';

// Single-user local auth for air-gapped / dev deployments.
// LOCAL_AUTH_PASSWORD must be a bcrypt hash: `npx bcryptjs-cli hash <password>`
// or any bcrypt tool. Not intended for multi-user production use.
export async function validateLocalAuth(username: string, password: string): Promise<DocWrightUser | null> {
	const expectedUser = process.env.LOCAL_AUTH_USER || 'admin';
	const expectedHash = process.env.LOCAL_AUTH_PASSWORD;

	if (!expectedHash) return null;
	if (username !== expectedUser) return null;

	const valid = await bcrypt.compare(password, expectedHash);
	if (!valid) return null;

	return {
		id: 'local-admin',
		username,
		email: process.env.LOCAL_AUTH_EMAIL || `${username}@localhost`,
		displayName: process.env.LOCAL_AUTH_DISPLAY_NAME || username,
		teams: ['admin'],
	};
}
