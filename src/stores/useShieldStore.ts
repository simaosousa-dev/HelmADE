import { useSyncExternalStore } from 'react';
import { errorMessage } from '../lib/ipc';
import { settingsService, type ShieldConfig } from '../services/settingsService';
import { toastStore } from './useToastStore';

let config: ShieldConfig = { maskSecrets: true, streamerMode: false };
const listeners = new Set<() => void>();

function setConfig(next: ShieldConfig): void {
  config = next;
  for (const listener of listeners) listener();
}

async function apply(next: ShieldConfig): Promise<void> {
  const previous = config;
  setConfig(next);
  try {
    setConfig(await settingsService.setShieldConfig(next));
  } catch (error) {
    // The backend is the one masking: never show a state it did not accept.
    setConfig(previous);
    toastStore.error(errorMessage(error));
  }
}

export const shieldStore = {
  getState(): ShieldConfig {
    return config;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async load(): Promise<void> {
    try {
      setConfig(await settingsService.getShieldConfig());
    } catch (error) {
      toastStore.error(errorMessage(error));
    }
  },

  toggleStreamerMode(): Promise<void> {
    return apply({ ...config, streamerMode: !config.streamerMode });
  },

  toggleMaskSecrets(): Promise<void> {
    return apply({ ...config, maskSecrets: !config.maskSecrets });
  },
};

export function useShieldStore(): ShieldConfig {
  return useSyncExternalStore(shieldStore.subscribe, shieldStore.getState);
}
