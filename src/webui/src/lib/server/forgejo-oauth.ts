import type { DocWrightUser } from '../../app.js';

function cfg() {
	const url = process.env.FORGEJO_URL?.replace(/\/$/, '');
	const clientId = process.env.FORGEJO_CLIENT_ID;
	const clientSecret = process.env.FORGEJO_CLIENT_SECRET;
	if (!url || !clientId || !clientSecret) {
		throw new Error('Missing FORGEJO_URL, FORGEJO_CLIENT_ID, or FORGEJO_CLIENT_SECRET');
	}
	return { url, clientId, clientSecret };
}

export function getAuthUrl(state: string, redirectUri: string): string {
	const { url, clientId } = cfg();
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'read:user read:organization',
		state,
	});
	return `${url}/login/oauth/authorize?${params}`;
}

export async function exchangeCode(
	code: string,
	redirectUri: string
): Promise<string> {
	const { url, clientId, clientSecret } = cfg();
	const res = await fetch(`${url}/login/oauth/access_token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
	});
	if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
	const data = await res.json();
	if (!data.access_token) throw new Error('No access_token in response');
	return data.access_token;
}

export async function getUserInfo(token: string): Promise<Omit<DocWrightUser, 'teams'>> {
	const { url } = cfg();
	const res = await fetch(`${url}/api/v1/user`, {
		headers: { Authorization: `token ${token}` },
	});
	if (!res.ok) throw new Error(`getUserInfo failed: ${res.status}`);
	const u = await res.json();
	return {
		id: String(u.id),
		username: u.login,
		email: u.email ?? '',
		displayName: u.full_name || u.login,
		avatarUrl: u.avatar_url,
	};
}

export async function getUserTeams(token: string): Promise<string[]> {
	const { url } = cfg();
	try {
		const res = await fetch(`${url}/api/v1/teams?limit=50`, {
			headers: { Authorization: `token ${token}` },
		});
		if (!res.ok) return [];
		const teams = await res.json();
		return Array.isArray(teams) ? teams.map((t: { name: string }) => t.name) : [];
	} catch {
		return [];
	}
}
