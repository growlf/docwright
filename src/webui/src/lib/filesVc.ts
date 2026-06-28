import { writable } from 'svelte/store';

// Shared between the Files VC registration (layout) and FileTree.svelte.
// Updated by the shell when the per-VC search input changes.
export const filesSearchQuery = writable('');
