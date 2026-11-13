import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';

export type { UnlistenFn };

/** Shape of every error a backend command rejects with. */
export interface HelmError {
  code: string;
  message: string;
}

/**
 * End-to-end tests load the frontend in Chromium, which has no Tauri IPC. When this is set
 * (test builds only) and the page is not inside the app, calls go to the backend's test bridge.
 */
const BRIDGE_URL: string | undefined = import.meta.env.VITE_E2E_BRIDGE_URL;
const useBridge = Boolean(BRIDGE_URL) && typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);

type BridgeHandler = (payload: unknown) => void;
const bridgeHandlers = new Map<string, Set<BridgeHandler>>();
let bridgeEvents: EventSource | null = null;

async function bridgePost<T>(route: string, body: unknown): Promise<T> {
  const response = await fetch(`${BRIDGE_URL}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const reply: { ok: boolean; data?: T; error?: unknown } = await response.json();
  if (!reply.ok) throw reply.error;
  return reply.data as T;
}

async function bridgeListen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  bridgeEvents ??= (() => {
    const source = new EventSource(`${BRIDGE_URL}/events`);
    source.onmessage = (message) => {
      const { event: name, payload } = JSON.parse(message.data) as { event: string; payload: unknown };
      for (const registered of bridgeHandlers.get(name) ?? []) registered(payload);
    };
    return source;
  })();
  const handlers = bridgeHandlers.get(event) ?? new Set<BridgeHandler>();
  bridgeHandlers.set(event, handlers);
  const registered = handler as BridgeHandler;
  handlers.add(registered);
  await bridgePost('/listen', { event });
  return () => handlers.delete(registered);
}

/** Calls a backend command. Rejects with a `HelmError`. */
export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (useBridge) return bridgePost<T>('/invoke', { cmd: command, args: args ?? {} });
  return tauriInvoke<T>(command, args);
}

/** Subscribes to a backend event. */
export function listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (useBridge) return bridgeListen(event, handler);
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
