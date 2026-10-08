/**
 * Representação de um servidor local de desenvolvimento detetado pelo sniffer PTY.
 */
export interface DetectedDevServer {
  session_id: string;
  url: string;
  port: number;
  detected_at?: number;
}

/**
 * Modos de viewport suportados pelo Live Browser.
 */
export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

/**
 * Preset descritivo de viewport responsivo com dimensões.
 */
export interface ViewportPreset {
  id: ViewportMode;
  name: string;
  width: number | string;
  height?: number | string;
  description: string;
}

/**
 * Níveis de severidade dos logs da consola webview.
 */
export type ConsoleLogLevel = 'log' | 'info' | 'warn' | 'error';

/**
 * Entrada de log intercetada da consola da webview.
 */
export interface ConsoleLogEntry {
  id: string;
  level: ConsoleLogLevel;
  message: string;
  timestamp: number;
  source?: string;
  stack?: string;
  count?: number;
}

/**
 * Estado reativo da Dock de Live Preview Webview.
 */
export interface PreviewState {
  isOpen: boolean;
  servers: DetectedDevServer[];
  activeServer: DetectedDevServer | null;
  currentUrl: string;
  isLoading: boolean;

  // Controlos de Navegação e Histórico
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;

  // Viewport Responsivo
  viewportMode: ViewportMode;

  // Consola de Erros e Logs Intercetados
  logs: ConsoleLogEntry[];
  isConsoleOpen: boolean;
  consoleFilter: 'all' | ConsoleLogLevel;
}
