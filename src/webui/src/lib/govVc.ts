import { writable } from 'svelte/store';

// Shared between the Governance Engine VC registration (layout) and GovernancePanel.svelte.
// Updated by the shell when the per-VC search input changes.
export const govSearchQuery = writable('');
