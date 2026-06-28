import { writable } from 'svelte/store';

export interface RightPanelClaim { html: string; label: string; }
export const rightPanelClaim = writable<RightPanelClaim | null>(null);

// Incremented each time a VC is registered via registerView().
// ViewContainerMount subscribes so its $effect re-runs when core VCs
// register during layout onMount (which fires after the initial render).
export const vcRegistryVersion = writable(0);
