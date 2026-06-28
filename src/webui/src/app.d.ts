export interface DocWrightUser {
	id: string;
	username: string;
	email: string;
	displayName: string;
	teams: string[];
	avatarUrl?: string;
}

declare global {
	namespace App {
		interface Locals {
			user: DocWrightUser | null;
		}
	}
}

export {};
