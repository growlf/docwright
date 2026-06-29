export const PUBLIC_PATHS = ['/login', '/auth/callback', '/api/health'];

export function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
