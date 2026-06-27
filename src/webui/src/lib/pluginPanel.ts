import { writable } from 'svelte/store';

export interface RightPanelClaim { html: string; label: string; }
export const rightPanelClaim = writable<RightPanelClaim | null>(null);
