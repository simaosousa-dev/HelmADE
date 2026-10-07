import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { SpawnPtyOptions } from '../types/terminal';

export const terminalService = {
  /**
   * Inicializa um novo processo PTY local com suporte a shell interativo e cwd configurável.
   */
  async spawnPty(options: SpawnPtyOptions): Promise<void> {
    return invoke<void>('spawn_pty', {
      sessionId: options.sessionId,
      cwd: options.cwd,
      shell: options.shell,
      cols: options.cols,
      rows: options.rows,
      env: options.env,
    });
  },

  /**
   * Envia dados de entrada do utilizador (comandos ou teclas ANSI) para o stdin do PTY.
   */
  async writePty(sessionId: string, data: string): Promise<void> {
    return invoke<void>('write_pty', { sessionId, data });
  },

  /**
   * Redimensiona as colunas e linhas da pseudo-terminal emulada no SO.
   */
  async resizePty(sessionId: string, cols: number, rows: number): Promise<void> {
    return invoke<void>('resize_pty', { sessionId, cols, rows });
  },

  /**
   * Encerra o processo do PTY e liberta os recursos do sistema.
   */
  async killPty(sessionId: string): Promise<boolean> {
    return invoke<boolean>('kill_pty', { sessionId });
  },

  /**
   * Obtém o histórico completo acumulado no ring-buffer circular em memória.
   */
  async getScrollback(sessionId: string): Promise<string[]> {
    return invoke<string[]>('get_pty_scrollback', { sessionId });
  },

  /**
   * Subscreve o stream reativo de saída em tempo real (stdout/stderr) via eventos Tauri IPC.
   */
  async onData(sessionId: string, callback: (chunk: string) => void): Promise<UnlistenFn> {
    return listen<string>(`pty-output-${sessionId}`, (event) => {
      callback(event.payload);
    });
  },
};
