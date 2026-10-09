import { invoke } from '@tauri-apps/api/core';
import type { ShortcutConfig } from '../types/shortcuts';

export const shortcutService = {
  /**
   * Obtém a configuração de atalhos e push-to-talk ativa.
   */
  async getShortcutConfig(): Promise<ShortcutConfig> {
    try {
      return await invoke<ShortcutConfig>('get_shortcut_config');
    } catch {
      // Fallback gracioso para ambiente web/testes
      return {
        pushToTalk: 'Option+Space',
        enabled: true,
        soundFeedback: false,
      };
    }
  },

  /**
   * Atualiza a configuração de atalhos no backend Tauri.
   */
  async updateShortcutConfig(config: ShortcutConfig): Promise<ShortcutConfig> {
    try {
      return await invoke<ShortcutConfig>('update_shortcut_config', { config });
    } catch {
      return config;
    }
  },

  /**
   * Valida se o push-to-talk nativo está disponível na plataforma atual.
   */
  async isPushToTalkAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>('is_push_to_talk_available');
    } catch {
      return true;
    }
  },
};
