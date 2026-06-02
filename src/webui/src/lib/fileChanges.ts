import { writable } from 'svelte/store';

export const fileChanged = writable<{ path: string } | null>(null);
