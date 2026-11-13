import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, type ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { terminalService } from '../../services/terminalService';
import { defaultTerminalOptions } from './terminalThemes';

export interface UseTerminalSessionOptions {
  autoFocus?: boolean;
  onReady?: () => void;
  customOptions?: ITerminalOptions;
}

export function useTerminalSession(
  sessionId: string,
  options: UseTerminalSessionOptions = {}
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !sessionId) return;

    let isDisposed = false;
    let unlistenOutput: (() => void) | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    // 1. Instanciação do terminal com opções Apple HIG
    const terminal = new Terminal({
      ...defaultTerminalOptions,
      ...options.customOptions,
    });
    terminalRef.current = terminal;

    // 2. Acoplamento do FitAddon para responsividade automática
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    // 3. Acoplamento de renderizador acelerado por GPU (WebGL) com fallback
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      terminal.loadAddon(webglAddon);
    } catch (err) {
      console.warn(
        '[useTerminalSession] WebGL não suportado na WebView, fallback para renderizador Canvas padrão:',
        err
      );
    }

    // 4. Montagem no elemento do DOM
    terminal.open(container);

    // Ajusta o terminal ao contentor e propaga as dimensões ao PTY. Um contentor ainda sem
    // tamanho (painel oculto) ou um PTY que ainda não arrancou não são erros: o próximo
    // redimensionamento volta a tentar.
    const syncSize = () => {
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      fitAddon.fit();
      terminalService.resizePty(sessionId, terminal.cols, terminal.rows).catch((err: unknown) => {
        console.debug('[useTerminalSession] PTY ainda não disponível para redimensionar:', err);
      });
    };
    syncSize();

    // 5. Reposição do fluxo bruto acumulado no Rust (cores, cursor e ecrãs completos incluídos)
    terminalService
      .getScrollback(sessionId)
      .then((scrollback) => {
        if (!isDisposed && scrollback) {
          terminal.write(scrollback);
        }
      })
      .catch((err: unknown) => {
        console.debug('[useTerminalSession] Sem scrollback prévio para esta sessão:', err);
      });

    // 6. Streaming bidirecional: entrada do utilizador para o PTY
    const inputDisposable = terminal.onData((data) => {
      terminalService.writePty(sessionId, data).catch((err) => {
        console.error('[useTerminalSession] Falha ao enviar input para o PTY:', err);
      });
    });

    // 7. Streaming bidirecional: escuta do stream de saída via eventos Tauri IPC
    terminalService
      .onData(sessionId, (chunk) => {
        if (!isDisposed) {
          terminal.write(chunk);
        }
      })
      .then((unlisten) => {
        if (!isDisposed) {
          unlistenOutput = unlisten;
        } else {
          unlisten();
        }
      })
      .catch((err) => {
        console.error('[useTerminalSession] Falha ao subscrever stream do PTY:', err);
      });

    // 8. Observador de redimensionamento fluido
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!isDisposed) syncSize();
      }, 60);
    });

    resizeObserver.observe(container);

    if (options.autoFocus) {
      terminal.focus();
    }

    setIsReady(true);
    options.onReady?.();

    // 9. Descarte limpo ao desmontar o componente
    return () => {
      isDisposed = true;
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      if (unlistenOutput) {
        unlistenOutput();
      }
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      setIsReady(false);
    };
  }, [sessionId]);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const fit = useCallback(() => {
    fitAddonRef.current?.fit();
  }, []);

  return {
    containerRef,
    terminal: terminalRef.current,
    isReady,
    focus,
    clear,
    fit,
  };
}
