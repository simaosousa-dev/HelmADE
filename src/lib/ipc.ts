import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';

export type { UnlistenFn };

/** Shape of every error a backend command rejects with. */
export interface HelmError {
  code: string;
  message: string;
}

/** Calls a backend command. Rejects with a `HelmError`. */
export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(command, args);
}

/** Subscribes to a backend event. */
export function listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  return tauriListen<T>(event, (e) => handler(e.payload));
}

/** User-facing text for anything a command can reject with. */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Ocorreu um erro inesperado.';
}
