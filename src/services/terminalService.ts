import { invoke, listen, type UnlistenFn } from '../lib/ipc';
import type {
  SpawnPtyOptions,
  BlockedPromptInfo,
  SessionStatusPayload,
  PtyExitPayload,
} from '../types/terminal.ts';

/** Tail of the pending writes of each session, so input reaches the PTY in order. */
const writeQueues = new Map<string, Promise<void>>();

export const terminalService = {
  /**
   * Inicializa um novo processo PTY local com suporte a shell interativo e cwd configurável.
   */
  async spawnPty(options: SpawnPtyOptions): Promise<void> {
    return invoke<void>('spawn_pty', {
      sessionId: options.sessionId,
      cwd: options.cwd,
      command: options.command,
      cols: options.cols,
      rows: options.rows,
      env: options.env,
    });
  },

  /**
   * Envia dados de entrada do utilizador (comandos ou teclas ANSI) para o stdin do PTY.
   * As escritas de cada sessão são encadeadas: cada tecla é um pedido assíncrono e, sem
   * isto, duas teclas rápidas podiam chegar ao terminal pela ordem errada.
   */
  writePty(sessionId: string, data: string): Promise<void> {
    const previous = writeQueues.get(sessionId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined) // a failed write must not block the ones after it
      .then(() => invoke<void>('write_pty', { sessionId, data }));
    writeQueues.set(sessionId, next);
    const forget = () => {
      if (writeQueues.get(sessionId) === next) writeQueues.delete(sessionId);
    };
    next.then(forget, forget);
    return next;
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
  async getScrollback(sessionId: string): Promise<string> {
    return invoke<string>('get_pty_scrollback', { sessionId });
  },

  /**
   * Indica se o processo do terminal ainda está vivo.
   */
  async isAlive(sessionId: string): Promise<boolean> {
    return invoke<boolean>('is_pty_alive', { sessionId });
  },

  /**
   * Escuta o fim de qualquer processo de terminal (com o respetivo código de saída).
   */
  async onExit(callback: (payload: PtyExitPayload) => void): Promise<UnlistenFn> {
    return listen<PtyExitPayload>('pty-exit', callback);
  },

  /**
   * Subscreve o stream reativo de saída em tempo real (stdout/stderr) via eventos Tauri IPC.
   */
  async onData(sessionId: string, callback: (chunk: string) => void): Promise<UnlistenFn> {
    return listen<string>(`pty-output-${sessionId}`, callback);
  },

  /**
   * Responde a um prompt bloqueado (y/N, password, texto) no terminal.
   */
  async respondToPrompt(sessionId: string, response: string): Promise<void> {
    return invoke<void>('respond_to_blocked_prompt', { sessionId, response });
  },

  /**
   * Obtém o estado de inatividade e standby de uma sessão PTY.
   */
  async getSessionIdleStatus(sessionId: string): Promise<SessionStatusPayload> {
    return invoke<SessionStatusPayload>('get_session_idle_status', { sessionId });
  },

  /**
   * Lista o estado de inatividade de todos os terminais ativos.
   */
  async listAllIdleStatuses(): Promise<SessionStatusPayload[]> {
    return invoke<SessionStatusPayload[]>('list_all_terminal_idle_statuses');
  },

  /**
   * Define o estado de standby/hibernação de uma sessão.
   */
  async setSessionStandby(sessionId: string, standby: boolean): Promise<void> {
    return invoke<void>('set_session_standby', { sessionId, standby });
  },

  /**
   * Envia uma notificação nativa macOS via canal IPC.
   */
  async sendNativeNotification(
    title: string,
    subtitle?: string,
    body?: string,
    sound?: boolean
  ): Promise<void> {
    return invoke<void>('send_macos_notification', {
      title,
      subtitle: subtitle ?? null,
      body: body ?? '',
      sound: sound ?? true,
    });
  },

  /**
   * Escuta alertas de prompt interativo bloqueado (y/N, password, etc.).
   */
  async onBlockedPrompt(callback: (info: BlockedPromptInfo) => void): Promise<UnlistenFn> {
    return listen<BlockedPromptInfo>('pty-blocked-prompt', callback);
  },

  /**
   * Escuta desativação do estado de bloqueio quando o processo prossegue.
   */
  async onBlockedCleared(callback: (payload: { sessionId: string }) => void): Promise<UnlistenFn> {
    return listen<{ sessionId: string }>('pty-blocked-cleared', callback);
  },

  /**
   * Escuta transições de estado de standby (hibernação/ativação).
   */
  async onStandbyChanged(
    callback: (payload: { sessionId: string; state: string; isStandby: boolean }) => void
  ): Promise<UnlistenFn> {
    return listen<{ sessionId: string; state: string; isStandby: boolean }>(
      'pty-standby-changed',
      callback
    );
  },
};

