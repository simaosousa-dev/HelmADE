import { useSyncExternalStore } from 'react';
import { SWARM_PRESETS, type SwarmPreset } from '../config/swarmPresets';

export interface SwarmStoreState {
  presets: SwarmPreset[];
  activePresetId: string | null;
  isLaunching: boolean;
  lastError: string | null;
}

let state: SwarmStoreState = {
  presets: SWARM_PRESETS,
  activePresetId: null,
  isLaunching: false,
  lastError: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const swarmStore = {
  getState(): SwarmStoreState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  selectPreset(id: string | null): void {
    if (state.activePresetId === id) return;
    state = {
      ...state,
      activePresetId: id,
    };
    emitChange();
  },

  setLaunching(isLaunching: boolean): void {
    if (state.isLaunching === isLaunching) return;
    state = {
      ...state,
      isLaunching,
    };
    emitChange();
  },

  setError(lastError: string | null): void {
    if (state.lastError === lastError) return;
    state = {
      ...state,
      lastError,
    };
    emitChange();
  },

  setPresets(presets: SwarmPreset[]): void {
    state = {
      ...state,
      presets,
    };
    emitChange();
  },

  reset(): void {
    state = {
      presets: SWARM_PRESETS,
      activePresetId: null,
      isLaunching: false,
      lastError: null,
    };
    emitChange();
  },
};

export function useSwarmStore() {
  const storeState = useSyncExternalStore(swarmStore.subscribe, swarmStore.getState);

  return {
    ...storeState,
    selectPreset: swarmStore.selectPreset,
    setLaunching: swarmStore.setLaunching,
    setError: swarmStore.setError,
    setPresets: swarmStore.setPresets,
    reset: swarmStore.reset,
  };
}
