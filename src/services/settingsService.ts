import { invoke } from '../lib/ipc';

export interface ShieldConfig {
  /** Mask API keys, tokens and passwords in every stream. */
  maskSecrets: boolean;
  /** Presentation mode: additionally hide the home directory in paths. */
  streamerMode: boolean;
}

export const settingsService = {
  get(key: string): Promise<string | null> {
    return invoke<string | null>('get_setting', { key });
  },

  set(key: string, value: string): Promise<void> {
    return invoke<void>('set_setting', { key, value });
  },

  getShieldConfig(): Promise<ShieldConfig> {
    return invoke<ShieldConfig>('get_shield_config');
  },

  setShieldConfig(config: ShieldConfig): Promise<ShieldConfig> {
    return invoke<ShieldConfig>('set_shield_config', { config });
  },
};
