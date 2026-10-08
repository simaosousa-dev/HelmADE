import { useSyncExternalStore } from 'react';
import type { DetectedDevServer, PreviewState } from '../types/preview';

let state: PreviewState = {
  isOpen: false,
  servers: [],
  activeServer: null,
  currentUrl: 'http://localhost:5173',
  isLoading: false,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const previewStore = {
  getState(): PreviewState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setOpen(isOpen: boolean): void {
    if (state.isOpen === isOpen) return;
    state = { ...state, isOpen };
    emitChange();
  },

  toggleOpen(): void {
    state = { ...state, isOpen: !state.isOpen };
    emitChange();
  },

  addServer(server: DetectedDevServer): void {
    const exists = state.servers.some(
      (s) => s.port === server.port && s.session_id === server.session_id
    );
    const updatedServers = exists
      ? state.servers.map((s) =>
          s.port === server.port && s.session_id === server.session_id ? server : s
        )
      : [...state.servers, server];

    const shouldActivate = !state.activeServer || state.servers.length === 0;

    state = {
      ...state,
      servers: updatedServers,
      activeServer: shouldActivate ? server : state.activeServer,
      currentUrl: shouldActivate ? server.url : state.currentUrl,
      isOpen: shouldActivate ? true : state.isOpen,
    };
    emitChange();
  },

  setActiveServer(server: DetectedDevServer | null): void {
    state = {
      ...state,
      activeServer: server,
      currentUrl: server ? server.url : state.currentUrl,
    };
    emitChange();
  },

  setCurrentUrl(url: string): void {
    if (state.currentUrl === url) return;
    state = { ...state, currentUrl: url };
    emitChange();
  },

  setLoading(isLoading: boolean): void {
    if (state.isLoading === isLoading) return;
    state = { ...state, isLoading };
    emitChange();
  },

  clearServers(sessionId?: string): void {
    if (sessionId) {
      const remaining = state.servers.filter((s) => s.session_id !== sessionId);
      const activeStillValid = state.activeServer?.session_id !== sessionId;
      state = {
        ...state,
        servers: remaining,
        activeServer: activeStillValid ? state.activeServer : remaining[0] ?? null,
        currentUrl: activeStillValid ? state.currentUrl : (remaining[0]?.url ?? state.currentUrl),
      };
    } else {
      state = {
        ...state,
        servers: [],
        activeServer: null,
      };
    }
    emitChange();
  },

  reset(): void {
    state = {
      isOpen: false,
      servers: [],
      activeServer: null,
      currentUrl: 'http://localhost:5173',
      isLoading: false,
    };
    emitChange();
  },
};

export function usePreviewStore() {
  const storeState = useSyncExternalStore(previewStore.subscribe, previewStore.getState);

  return {
    ...storeState,
    setOpen: previewStore.setOpen,
    toggleOpen: previewStore.toggleOpen,
    addServer: previewStore.addServer,
    setActiveServer: previewStore.setActiveServer,
    setCurrentUrl: previewStore.setCurrentUrl,
    setLoading: previewStore.setLoading,
    clearServers: previewStore.clearServers,
    reset: previewStore.reset,
  };
}
