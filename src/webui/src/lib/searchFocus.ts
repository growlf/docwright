import { writable } from 'svelte/store';

// Increment to signal SearchPanel (or any searchable VC) to focus its input.
export const searchFocusTrigger = writable(0);
