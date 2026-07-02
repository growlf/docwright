import { writable } from 'svelte/store';

// Shared between the Git VC registration (layout) and GitPanel.svelte.
// Updated by the shell when the per-VC search input changes.
export const gitSearchQuery = writable('');
