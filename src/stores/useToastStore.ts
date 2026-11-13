import { useSyncExternalStore } from 'react';

export type ToastKind = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const MAX_TOASTS = 4;
const DISMISS_AFTER_MS: Record<ToastKind, number> = {
  error: 10_000,
  warning: 8_000,
  success: 5_000,
  info: 5_000,
};

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function setToasts(next: Toast[]): void {
  toasts = next;
  for (const listener of listeners) listener();
}

export const toastStore = {
  getState(): Toast[] {
    return toasts;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Shows a message. An identical message already on screen is not duplicated. */
  push(kind: ToastKind, message: string): void {
    const text = message.trim();
    if (!text || toasts.some((toast) => toast.kind === kind && toast.message === text)) return;
    const toast: Toast = { id: nextId++, kind, message: text };
    for (const dropped of toasts.slice(0, Math.max(0, toasts.length + 1 - MAX_TOASTS))) {
      toastStore.dismiss(dropped.id);
    }
    setToasts([...toasts, toast]);
    timers.set(
      toast.id,
      setTimeout(() => toastStore.dismiss(toast.id), DISMISS_AFTER_MS[kind])
    );
  },

  error(message: string): void {
    toastStore.push('error', message);
  },

  dismiss(id: number): void {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    if (toasts.some((toast) => toast.id === id)) {
      setToasts(toasts.filter((toast) => toast.id !== id));
    }
  },

  reset(): void {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    setToasts([]);
  },
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(toastStore.subscribe, toastStore.getState);
}
