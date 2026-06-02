import { writable } from 'svelte/store';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; onclick: () => void };
}

export const toasts = writable<Toast[]>([]);

let nextId = 0;

export function showToast(message: string, durationMs = 5000, action?: Toast['action']) {
  const id = nextId++;
  toasts.update(t => [...t, { id, message, action }]);
  if (durationMs > 0) {
    setTimeout(() => {
      toasts.update(t => t.filter(toast => toast.id !== id));
    }, durationMs);
  }
  return id;
}

export function dismissToast(id: number) {
  toasts.update(t => t.filter(toast => toast.id !== id));
}
