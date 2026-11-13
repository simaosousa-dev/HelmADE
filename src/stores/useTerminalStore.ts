import { useSyncExternalStore } from 'react';
import { terminalService } from '../services/terminalService.ts';
import type { BlockedPromptInfo, TerminalStatus } from '../types/terminal.ts';

export interface TerminalStoreState {
  blockedPrompts: Record<string, BlockedPromptInfo>;
  standbySessions: Record<string, boolean>;
  sessionStatuses: Record<string, TerminalStatus>;
}

let state: TerminalStoreState = {
  blockedPrompts: {},
  standbySessions: {},
  sessionStatuses: {},
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const terminalStore = {
  getState(): TerminalStoreState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Inicializa subscrições de eventos IPC Tauri para deteção reativa de prompts e standby.
   */
  async initListeners(): Promise<() => void> {
    const unlisteners = await Promise.all([
      terminalService.onBlockedPrompt((prompt) => {
        terminalStore.setBlockedPrompt(prompt.sessionId, prompt);
      }),
      terminalService.onBlockedCleared(({ sessionId }) => {
        terminalStore.clearBlockedPrompt(sessionId);
      }),
      terminalService.onStandbyChanged(({ sessionId, isStandby }) => {
        terminalStore.setStandby(sessionId, isStandby);
      }),
    ]);
    return () => {
      for (const unlisten of unlisteners) unlisten();
    };
  },

  setBlockedPrompt(sessionId: string, prompt: BlockedPromptInfo): void {
    state = {
      ...state,
      blockedPrompts: {
        ...state.blockedPrompts,
        [sessionId]: prompt,
      },
      sessionStatuses: {
        ...state.sessionStatuses,
        [sessionId]: 'blocked',
      },
    };
    emitChange();
  },

  clearBlockedPrompt(sessionId: string): void {
    if (!state.blockedPrompts[sessionId]) return;

    const nextPrompts = { ...state.blockedPrompts };
    delete nextPrompts[sessionId];

    state = {
      ...state,
      blockedPrompts: nextPrompts,
      sessionStatuses: {
        ...state.sessionStatuses,
        [sessionId]: state.standbySessions[sessionId] ? 'standby' : 'running',
      },
    };
    emitChange();
  },

  setStandby(sessionId: string, isStandby: boolean): void {
    state = {
      ...state,
      standbySessions: {
        ...state.standbySessions,
        [sessionId]: isStandby,
      },
      sessionStatuses: {
        ...state.sessionStatuses,
        [sessionId]: isStandby ? 'standby' : 'running',
      },
    };
    emitChange();
  },

  async toggleStandby(sessionId: string): Promise<void> {
    const nextVal = !state.standbySessions[sessionId];
    terminalStore.setStandby(sessionId, nextVal);
    try {
      await terminalService.setSessionStandby(sessionId, nextVal);
    } catch (err) {
      console.warn('[terminalStore] Falha ao alternar standby no PTY:', err);
    }
  },

  setSessionStatus(sessionId: string, status: TerminalStatus): void {
    state = {
      ...state,
      sessionStatuses: {
        ...state.sessionStatuses,
        [sessionId]: status,
      },
    };
    emitChange();
  },

  /**
   * Responde ao prompt interativo diretamente pelo banner ou atalho (y/N, password, input).
   */
  async respondToPrompt(sessionId: string, response: string): Promise<void> {
    terminalStore.clearBlockedPrompt(sessionId);
    try {
      await terminalService.respondToPrompt(sessionId, response);
    } catch (err) {
      console.error('[terminalStore] Falha ao enviar resposta de prompt para o backend:', err);
    }
  },

  reset(): void {
    state = {
      blockedPrompts: {},
      standbySessions: {},
      sessionStatuses: {},
    };
    emitChange();
  },
};

export function useTerminalStore() {
  const storeState = useSyncExternalStore(terminalStore.subscribe, terminalStore.getState);

  return {
    ...storeState,
    setBlockedPrompt: terminalStore.setBlockedPrompt,
    clearBlockedPrompt: terminalStore.clearBlockedPrompt,
    setStandby: terminalStore.setStandby,
    toggleStandby: terminalStore.toggleStandby,
    setSessionStatus: terminalStore.setSessionStatus,
    respondToPrompt: terminalStore.respondToPrompt,
    initListeners: terminalStore.initListeners,
  };
}
