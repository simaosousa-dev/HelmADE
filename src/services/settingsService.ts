import { invoke } from '../lib/ipc';

export interface ShieldConfig {
  /** Mask API keys, tokens and passwords in every stream. */
  maskSecrets: boolean;
  /** Presentation mode: additionally hide the home directory in paths. */
  streamerMode: boolean;
}

export interface ShortcutConfig {
  /** Accelerator such as `Alt+Space` or `Command+Shift+V`. */
  pushToTalk: string;
  enabled: boolean;
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

  getShortcutConfig(): Promise<ShortcutConfig> {
    return invoke<ShortcutConfig>('get_shortcut_config');
  },

  /** Re-registers the system-wide push-to-talk shortcut. Rejects when the OS refuses it. */
  updateShortcutConfig(config: ShortcutConfig): Promise<ShortcutConfig> {
    return invoke<ShortcutConfig>('update_shortcut_config', { config });
  },
};
