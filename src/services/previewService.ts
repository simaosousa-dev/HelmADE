import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { DetectedDevServer } from '../types/preview';

export const previewService = {
  /**
   * Obtém a lista de servidores de desenvolvimento locais detetados pelo sniffer Rust.
   */
  async getDetectedServers(sessionId?: string): Promise<DetectedDevServer[]> {
    return invoke<DetectedDevServer[]>('get_detected_servers', {
      sessionId: sessionId ?? null,
    });
  },

  /**
   * Limpa os servidores detetados para uma sessão específica ou para todas.
   */
  async clearDetectedServers(sessionId?: string): Promise<void> {
    return invoke<void>('clear_detected_servers', {
      sessionId: sessionId ?? null,
    });
  },

  /**
   * Abre uma URL no navegador padrão do sistema operacional (macOS).
   */
  async openInExternalBrowser(url: string): Promise<boolean> {
    return invoke<boolean>('open_in_external_browser', { url });
  },

  /**
   * Subscreve eventos em tempo real quando um novo dev server é detetado pelo sniffer PTY.
   */
  async onDevServerDetected(
    callback: (server: DetectedDevServer) => void
  ): Promise<UnlistenFn> {
    return listen<DetectedDevServer>('devserver-detected', (event) => {
      callback(event.payload);
    });
  },
};
