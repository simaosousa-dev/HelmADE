import { useSyncExternalStore } from 'react';
import { errorMessage } from '../lib/ipc';
import { BROADCAST_RECIPIENT_ID, type A2AMessageType } from '../types/a2a';
import { a2aStore } from './useA2AStore';
import { gridLayoutStore } from './useGridLayoutStore';

export interface DispatchResult {
  success: boolean;
  recipientCount: number;
  message: string;
}

export interface TeamWireStoreState {
  isBroadcastMode: boolean;
  selectedRecipientId: string;
  selectedMessageType: A2AMessageType;
  draftPrompt: string;
  isDispatching: boolean;
  lastDispatchedTimestamp: number | null;
  lastDispatchResult: DispatchResult | null;
}

let state: TeamWireStoreState = {
  isBroadcastMode: false,
  selectedRecipientId: 'orchestrator',
  selectedMessageType: 'task',
  draftPrompt: '',
  isDispatching: false,
  lastDispatchedTimestamp: null,
  lastDispatchResult: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const teamWireStore = {
  getState(): TeamWireStoreState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setBroadcastMode(enabled: boolean): void {
    if (state.isBroadcastMode === enabled) return;
    state = {
      ...state,
      isBroadcastMode: enabled,
    };
    emitChange();
  },

  toggleBroadcastMode(): void {
    state = {
      ...state,
      isBroadcastMode: !state.isBroadcastMode,
    };
    emitChange();
  },

  setSelectedRecipientId(id: string): void {
    if (state.selectedRecipientId === id) return;
    state = {
      ...state,
      selectedRecipientId: id,
    };
    emitChange();
  },

  setSelectedMessageType(type: A2AMessageType): void {
    if (state.selectedMessageType === type) return;
    state = {
      ...state,
      selectedMessageType: type,
    };
    emitChange();
  },

  setDraftPrompt(prompt: string): void {
    state = {
      ...state,
      draftPrompt: prompt,
    };
    emitChange();
  },

  resetDispatchResult(): void {
    if (!state.lastDispatchResult) return;
    state = {
      ...state,
      lastDispatchResult: null,
    };
    emitChange();
  },

  /** Sends the draft (or `overrideContent`) through the router to the selected recipient or to everyone. */
  async dispatchPrompt(overrideContent?: string): Promise<DispatchResult> {
    const content = (overrideContent ?? state.draftPrompt).trim();
    if (!content) {
      return { success: false, recipientCount: 0, message: 'Prompt vazio' };
    }

    state = { ...state, isDispatching: true };
    emitChange();

    let result: DispatchResult;
    try {
      const message = await a2aStore.sendPrompt({
        recipient: state.isBroadcastMode ? BROADCAST_RECIPIENT_ID : state.selectedRecipientId,
        content,
        messageType: state.isBroadcastMode ? 'broadcast' : state.selectedMessageType,
      });
      const recipientCount = state.isBroadcastMode ? gridLayoutStore.getState().panels.length : 1;
      result = {
        success: true,
        recipientCount,
        message: state.isBroadcastMode
          ? `Transmitido para ${recipientCount} painel(éis)`
          : `Enviado para ${message.recipientName}`,
      };
    } catch (error) {
      result = { success: false, recipientCount: 0, message: errorMessage(error) };
    }

    state = {
      ...state,
      draftPrompt: result.success ? '' : state.draftPrompt,
      isDispatching: false,
      lastDispatchedTimestamp: result.success ? Date.now() : state.lastDispatchedTimestamp,
      lastDispatchResult: result,
    };
    emitChange();
    return result;
  },
};

export function useTeamWireStore() {
  const storeState = useSyncExternalStore(teamWireStore.subscribe, teamWireStore.getState);

  return {
    ...storeState,
    setBroadcastMode: teamWireStore.setBroadcastMode,
    toggleBroadcastMode: teamWireStore.toggleBroadcastMode,
    setSelectedRecipientId: teamWireStore.setSelectedRecipientId,
    setSelectedMessageType: teamWireStore.setSelectedMessageType,
    setDraftPrompt: teamWireStore.setDraftPrompt,
    resetDispatchResult: teamWireStore.resetDispatchResult,
    dispatchPrompt: teamWireStore.dispatchPrompt,
  };
}
