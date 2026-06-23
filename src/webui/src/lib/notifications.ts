import { writable, derived } from 'svelte/store';

export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'drift';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  persistent: boolean;
  action?: { label: string; onclick: () => void };
}

function createNotificationStore() {
  const { subscribe, update } = writable<Notification[]>([]);
  let nextId = 0;

  return {
    subscribe,

    add(n: Omit<Notification, 'id' | 'timestamp'>) {
      const id = nextId++;
      const notification: Notification = {
        ...n,
        id,
        timestamp: new Date().toISOString(),
      };
      update(notifications => [...notifications, notification]);

      // Auto-dismiss non-persistent notifications
      if (!n.persistent) {
        setTimeout(() => {
          update(notifications => notifications.filter(n => n.id !== id));
        }, 8000);
      }

      return id;
    },

    dismiss(id: number) {
      update(notifications => notifications.filter(n => n.id !== id));
    },

    clear() {
      update(() => []);
    },

    dismissByType(type: NotificationType) {
      update(notifications => notifications.filter(n => n.type !== type));
    },
  };
}

export const notifications = createNotificationStore();

// Convenience methods
export function notifyInfo(title: string, message: string, persistent = false) {
  return notifications.add({ type: 'info', title, message, persistent });
}

export function notifyWarning(title: string, message: string, persistent = true) {
  return notifications.add({ type: 'warning', title, message, persistent });
}

export function notifyError(title: string, message: string, persistent = true) {
  return notifications.add({ type: 'error', title, message, persistent });
}

export function notifySuccess(title: string, message: string, persistent = false) {
  return notifications.add({ type: 'success', title, message, persistent });
}

export function notifyDrift(title: string, message: string, action?: Notification['action']) {
  return notifications.add({ type: 'drift', title, message, persistent: true, action });
}

// Derived: count by type
export const notificationCounts = derived(notifications, $n => ({
  total: $n.length,
  info: $n.filter(n => n.type === 'info').length,
  warning: $n.filter(n => n.type === 'warning').length,
  error: $n.filter(n => n.type === 'error').length,
  success: $n.filter(n => n.type === 'success').length,
  drift: $n.filter(n => n.type === 'drift').length,
}));
