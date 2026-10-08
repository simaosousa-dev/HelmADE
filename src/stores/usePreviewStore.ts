import { useSyncExternalStore } from 'react';
import type {
  ConsoleLogEntry,
  ConsoleLogLevel,
  DetectedDevServer,
  PreviewState,
  ViewportMode,
} from '../types/preview';
import { sanitizeLogMessage } from '../utils/sanitizeLog.ts';

const DEFAULT_URL = 'http://localhost:5173';

const initialPreviewState: PreviewState = {
  isOpen: false,
  servers: [],
  activeServer: null,
  currentUrl: DEFAULT_URL,
  isLoading: false,

  // Histórico de navegação
  history: [DEFAULT_URL],
  historyIndex: 0,
  canGoBack: false,
  canGoForward: false,

  // Viewport responsivo
  viewportMode: 'desktop',

  // Consola de erros e logs
  logs: [],
  isConsoleOpen: false,
  consoleFilter: 'all',
};

let state: PreviewState = { ...initialPreviewState };

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

    let updatedHistory = state.history;
    let updatedHistoryIndex = state.historyIndex;
    let updatedCanGoBack = state.canGoBack;
    let updatedCanGoForward = state.canGoForward;

    if (shouldActivate) {
      updatedHistory = [server.url];
      updatedHistoryIndex = 0;
      updatedCanGoBack = false;
      updatedCanGoForward = false;
    }

    state = {
      ...state,
      servers: updatedServers,
      activeServer: shouldActivate ? server : state.activeServer,
      currentUrl: shouldActivate ? server.url : state.currentUrl,
      isOpen: shouldActivate ? true : state.isOpen,
      history: updatedHistory,
      historyIndex: updatedHistoryIndex,
      canGoBack: updatedCanGoBack,
      canGoForward: updatedCanGoForward,
    };
    emitChange();
  },

  setActiveServer(server: DetectedDevServer | null): void {
    const targetUrl = server ? server.url : state.currentUrl;
    let updatedHistory = state.history;
    let updatedHistoryIndex = state.historyIndex;

    if (server && targetUrl !== state.currentUrl) {
      const sliced = state.history.slice(0, state.historyIndex + 1);
      updatedHistory = [...sliced, targetUrl];
      updatedHistoryIndex = updatedHistory.length - 1;
    }

    state = {
      ...state,
      activeServer: server,
      currentUrl: targetUrl,
      history: updatedHistory,
      historyIndex: updatedHistoryIndex,
      canGoBack: updatedHistoryIndex > 0,
      canGoForward: false,
    };
    emitChange();
  },

  setCurrentUrl(url: string): void {
    if (state.currentUrl === url) return;
    const sliced = state.history.slice(0, state.historyIndex + 1);
    const newHistory = [...sliced, url];
    const newIndex = newHistory.length - 1;

    state = {
      ...state,
      currentUrl: url,
      history: newHistory,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false,
    };
    emitChange();
  },

  navigateTo(url: string): void {
    let target = url.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) {
      target = `http://${target}`;
    }
    this.setCurrentUrl(target);
  },

  goBack(): void {
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const targetUrl = state.history[newIndex];
      state = {
        ...state,
        currentUrl: targetUrl,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: true,
      };
      emitChange();
    }
  },

  goForward(): void {
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const targetUrl = state.history[newIndex];
      state = {
        ...state,
        currentUrl: targetUrl,
        historyIndex: newIndex,
        canGoBack: true,
        canGoForward: newIndex < state.history.length - 1,
      };
      emitChange();
    }
  },

  setLoading(isLoading: boolean): void {
    if (state.isLoading === isLoading) return;
    state = { ...state, isLoading };
    emitChange();
  },

  setViewportMode(viewportMode: ViewportMode): void {
    if (state.viewportMode === viewportMode) return;
    state = { ...state, viewportMode };
    emitChange();
  },

  addLog(entry: {
    level?: ConsoleLogLevel;
    message: string;
    source?: string;
    stack?: string;
  }): void {
    const level: ConsoleLogLevel = entry.level || 'log';
    const sanitizedMessage = sanitizeLogMessage(entry.message || '');
    const sanitizedStack = entry.stack ? sanitizeLogMessage(entry.stack) : undefined;

    const lastLog = state.logs[state.logs.length - 1];
    let updatedLogs: ConsoleLogEntry[];

    // Agrupa mensagens repetidas consecutivas com count incrementado
    if (
      lastLog &&
      lastLog.level === level &&
      lastLog.message === sanitizedMessage &&
      lastLog.source === entry.source
    ) {
      const updatedLast: ConsoleLogEntry = {
        ...lastLog,
        count: (lastLog.count || 1) + 1,
        timestamp: Date.now(),
      };
      updatedLogs = [...state.logs.slice(0, -1), updatedLast];
    } else {
      const newEntry: ConsoleLogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        level,
        message: sanitizedMessage,
        timestamp: Date.now(),
        source: entry.source,
        stack: sanitizedStack,
        count: 1,
      };
      // Limite máximo de 200 logs para evitar consumo excessivo de memória
      updatedLogs =
        state.logs.length >= 200
          ? [...state.logs.slice(state.logs.length - 199), newEntry]
          : [...state.logs, newEntry];
    }

    state = {
      ...state,
      logs: updatedLogs,
    };
    emitChange();
  },

  clearLogs(): void {
    if (state.logs.length === 0) return;
    state = { ...state, logs: [] };
    emitChange();
  },

  toggleConsole(isOpen?: boolean): void {
    const nextVal = isOpen !== undefined ? isOpen : !state.isConsoleOpen;
    if (state.isConsoleOpen === nextVal) return;
    state = { ...state, isConsoleOpen: nextVal };
    emitChange();
  },

  setConsoleOpen(isConsoleOpen: boolean): void {
    if (state.isConsoleOpen === isConsoleOpen) return;
    state = { ...state, isConsoleOpen };
    emitChange();
  },

  setConsoleFilter(consoleFilter: 'all' | ConsoleLogLevel): void {
    if (state.consoleFilter === consoleFilter) return;
    state = { ...state, consoleFilter };
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
      currentUrl: DEFAULT_URL,
      isLoading: false,
      history: [DEFAULT_URL],
      historyIndex: 0,
      canGoBack: false,
      canGoForward: false,
      viewportMode: 'desktop',
      logs: [],
      isConsoleOpen: false,
      consoleFilter: 'all',
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
    navigateTo: previewStore.navigateTo.bind(previewStore),
    goBack: previewStore.goBack.bind(previewStore),
    goForward: previewStore.goForward.bind(previewStore),
    setLoading: previewStore.setLoading,
    setViewportMode: previewStore.setViewportMode,
    addLog: previewStore.addLog,
    clearLogs: previewStore.clearLogs,
    toggleConsole: previewStore.toggleConsole,
    setConsoleOpen: previewStore.setConsoleOpen,
    setConsoleFilter: previewStore.setConsoleFilter,
    clearServers: previewStore.clearServers,
    reset: previewStore.reset,
  };
}
