import { writable } from 'svelte/store';

export const pluginRightHtml  = writable<string>('');
export const pluginRightLabel = writable<string>('Info');
// Increment to signal layout to focus the plugin tab
export const pluginRightFocus = writable<number>(0);
