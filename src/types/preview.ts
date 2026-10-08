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
 * Estado reativo da Dock de Live Preview Webview.
 */
export interface PreviewState {
  isOpen: boolean;
  servers: DetectedDevServer[];
  activeServer: DetectedDevServer | null;
  currentUrl: string;
  isLoading: boolean;
}
