import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAutoPortDetection } from '../../hooks/useAutoPortDetection';
import { BrowserToolbar } from './BrowserToolbar';
import { WebviewConsoleLogs } from './WebviewConsoleLogs';

export interface LiveBrowserDockProps {
  className?: string;
  onClose?: () => void;
}

const COMMON_PORTS = [
  { port: 5173, label: 'Vite / Svelte' },
  { port: 3000, label: 'Next.js / Remix' },
  { port: 4321, label: 'Astro' },
  { port: 8080, label: 'Webpack / Go' },
  { port: 8000, label: 'FastAPI / Django' },
];

export const LiveBrowserDock: React.FC<LiveBrowserDockProps> = ({
  className = '',
  onClose,
}) => {
  const {
    servers,
    activeServer,
    currentUrl,
    canGoBack,
    canGoForward,
    viewportMode,
    logs,
    isConsoleOpen,
    consoleFilter,
    setActiveServer,
    navigateTo,
    goBack,
    goForward,
    setViewportMode,
    addLog,
    clearLogs,
    toggleConsole,
    setConsoleFilter,
    setOpen,
    openInExternal,
  } = useAutoPortDetection();

  const [reloadKey, setReloadKey] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const errorCount = useMemo(() => logs.filter((l) => l.level === 'error').length, [logs]);
  const warnCount = useMemo(() => logs.filter((l) => l.level === 'warn').length, [logs]);

  // Interceção de mensagens e logs da consola emitidos pela webview via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === 'object' &&
        (event.data.type === 'helm-preview-log' || event.data.type === 'helm-preview-console')
      ) {
        addLog({
          level: event.data.level || 'log',
          message: event.data.message || '',
          source: event.data.source || 'webview',
          stack: event.data.stack,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [addLog]);

  const handleNavigate = useCallback(
    (target: string) => {
      navigateTo(target);
      setIsIframeLoading(true);
      setReloadKey((prev) => prev + 1);
    },
    [navigateTo]
  );

  const handleReload = useCallback(() => {
    setIsIframeLoading(true);
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleGoBack = useCallback(() => {
    goBack();
    setIsIframeLoading(true);
    setReloadKey((prev) => prev + 1);
  }, [goBack]);

  const handleGoForward = useCallback(() => {
    goForward();
    setIsIframeLoading(true);
    setReloadKey((prev) => prev + 1);
  }, [goForward]);

  const handleServerChange = useCallback(
    (port: number) => {
      const found = servers.find((s) => s.port === port);
      if (found) {
        setActiveServer(found);
        setIsIframeLoading(true);
        setReloadKey((prev) => prev + 1);
      }
    },
    [servers, setActiveServer]
  );

  const handleSelectPresetPort = useCallback(
    (port: number) => {
      const presetUrl = `http://localhost:${port}`;
      handleNavigate(presetUrl);
    },
    [handleNavigate]
  );

  const handleCopyUrl = useCallback(async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.warn('Falha ao copiar URL:', err);
    }
  }, [currentUrl]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setOpen(false);
    }
  }, [onClose, setOpen]);

  // Ao carregar o iframe, tenta injetar ou escutar eventuais erros em origens acessíveis
  const handleIframeLoad = useCallback(() => {
    setIsIframeLoading(false);
    try {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (iframeWindow) {
        iframeWindow.addEventListener('error', (event) => {
          addLog({
            level: 'error',
            message: event.message || 'Erro não tratado na aplicação webview',
            source: event.filename,
            stack: event.error?.stack,
          });
        });
      }
    } catch {
      // Cross-origin esperado para determinadas portas externas
    }
  }, [addLog]);

  return (
    <aside
      aria-label="Painel de Live Preview Webview Dockado"
      className={`flex flex-col h-full bg-[#161618] border-l border-white/10 text-white select-none backdrop-blur-xl transition-all duration-200 ${className}`}
    >
      {/* ── Barra de Ferramentas Superior Unificada ──────────────────────── */}
      <BrowserToolbar
        url={currentUrl}
        isLoading={isIframeLoading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onNavigate={handleNavigate}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        viewportMode={viewportMode}
        onSelectViewport={setViewportMode}
        servers={servers}
        activeServer={activeServer}
        onSelectServer={handleServerChange}
        isConsoleOpen={isConsoleOpen}
        errorCount={errorCount}
        warnCount={warnCount}
        onToggleConsole={toggleConsole}
        onOpenExternal={() => openInExternal(currentUrl)}
        onClose={handleClose}
      />

      {/* ── Área Central do Conteúdo do Navegador ─────────────────────────── */}
      <div className="flex-1 min-h-0 relative bg-[#101012] overflow-hidden flex flex-col">
        {servers.length === 0 && !activeServer ? (
          /* Estado Vazio Elegante (Apple HIG Minimalist) */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-lg">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
              </span>
            </div>

            <h3 className="text-[15px] font-semibold text-white/95 tracking-tight">
              À escuta de servidores locais
            </h3>
            <p className="text-[12px] text-white/60 mt-1.5 max-w-xs leading-relaxed">
              O sniffer PTY detetará automaticamente qualquer servidor iniciado nos teus terminais.
            </p>

            {/* Presets Rápidos de Portas Frequentes */}
            <div className="mt-6 w-full max-w-sm">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2.5">
                Portas Monitorizadas
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {COMMON_PORTS.map((preset) => (
                  <button
                    key={preset.port}
                    type="button"
                    onClick={() => handleSelectPresetPort(preset.port)}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 text-white/80 hover:text-emerald-200 transition-all flex items-center gap-2 text-[12px] focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
                    title={`Testar http://localhost:${preset.port}`}
                  >
                    <span className="font-mono font-bold text-white/95">:{preset.port}</span>
                    <span className="text-[10px] text-white/50">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Conexão Manual Rápida */}
            <div className="mt-6 pt-5 border-t border-white/5 w-full max-w-xs flex flex-col items-center">
              <span className="text-[11px] text-white/40 mb-2">Ou conecta diretamente:</span>
              <div className="w-full flex items-center gap-2">
                <input
                  type="text"
                  defaultValue="http://localhost:5173"
                  id="empty-manual-url-input"
                  placeholder="http://localhost:5173"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-[12px] font-mono text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/70"
                />
                <button
                  type="button"
                  onClick={() => {
                    const inputEl = document.getElementById('empty-manual-url-input') as HTMLInputElement | null;
                    if (inputEl?.value) {
                      handleNavigate(inputEl.value);
                    }
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[12px] font-semibold border border-emerald-400/30 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
                >
                  Conectar
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Moldura Responsiva com Suporte a Desktop, Tablet e Mobile */
          <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center bg-black/40 p-1 sm:p-2">
            {isIframeLoading && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2 text-white/80 pointer-events-none">
                <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[12px] font-medium font-mono text-white/90">
                  A carregar {currentUrl}...
                </span>
              </div>
            )}

            {/* Container Responsivo do Viewport com Transição Fluida */}
            <div
              className={`h-full relative flex flex-col transition-all duration-300 ease-out ${
                viewportMode === 'desktop'
                  ? 'w-full shadow-none rounded-none'
                  : viewportMode === 'tablet'
                  ? 'w-[768px] max-w-full rounded-2xl border border-white/15 shadow-2xl overflow-hidden bg-white'
                  : 'w-[390px] max-w-full rounded-3xl border-2 border-white/20 shadow-2xl overflow-hidden bg-white'
              }`}
            >
              {/* Barra de Moldura para Tablet ou Mobile */}
              {viewportMode === 'tablet' && (
                <div className="h-6 bg-[#242426] px-3 flex items-center justify-between text-white/50 text-[10px] select-none shrink-0 border-b border-white/10">
                  <span className="font-semibold text-white/70">Tablet Preview</span>
                  <span className="font-mono text-[9px] text-white/40">768 × 1024</span>
                </div>
              )}

              {viewportMode === 'mobile' && (
                <div className="h-7 bg-[#1c1c1e] px-4 flex items-center justify-between text-white/50 text-[10px] select-none shrink-0 border-b border-white/10">
                  <span className="font-mono text-[9px] text-white/70">9:41</span>
                  <div className="w-14 h-2.5 rounded-full bg-black/80 border border-white/15" />
                  <span className="font-mono text-[9px] text-white/40">390 × 844</span>
                </div>
              )}

              <iframe
                ref={iframeRef}
                key={reloadKey}
                src={currentUrl}
                title="Live Browser Webview"
                onLoad={handleIframeLoad}
                className="w-full flex-1 border-none bg-white min-h-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi"
              />
            </div>
          </div>
        )}

        {/* ── Gaveta de Logs da Consola da Webview (Colapsável) ─────────────── */}
        <WebviewConsoleLogs
          logs={logs}
          isOpen={isConsoleOpen}
          filter={consoleFilter}
          onFilterChange={setConsoleFilter}
          onClearLogs={clearLogs}
          onClose={() => toggleConsole(false)}
        />
      </div>

      {/* ── Barra de Rodapé / Status Bar macOS ─────────────────────────────── */}
      <footer className="h-8 px-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50 bg-[#161618] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full ${
              activeServer ? 'bg-emerald-400' : 'bg-amber-400/60'
            }`}
          />
          <span className="truncate">
            {activeServer
              ? `Ligado a :${activeServer.port}`
              : 'Sniffer ativo em segundo plano'}
          </span>
          <span className="text-white/30 hidden sm:inline">|</span>
          <span className="capitalize text-white/40 hidden sm:inline">
            Modo: {viewportMode}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Alternador Rápido de Consola no Rodapé */}
          <button
            type="button"
            onClick={() => toggleConsole()}
            className={`min-h-[24px] px-2 py-0.5 rounded text-[10px] transition-colors flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-emerald-400 focus-visible:outline-none ${
              isConsoleOpen
                ? 'bg-white/15 text-white font-medium'
                : errorCount > 0
                ? 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Alternar gaveta da consola webview"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Consola</span>
            {errorCount > 0 && (
              <span className="px-1 py-0.2 rounded-full text-[9px] bg-rose-500 text-white font-bold">
                {errorCount}
              </span>
            )}
          </button>

          {/* Copiar URL */}
          <button
            type="button"
            onClick={handleCopyUrl}
            className="min-h-[24px] px-2 py-0.5 rounded text-[10px] hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-emerald-400 focus-visible:outline-none"
            title="Copiar URL atual para a área de transferência"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            <span>{copiedUrl ? 'Copiado!' : 'Copiar URL'}</span>
          </button>
        </div>
      </footer>
    </aside>
  );
};

export default LiveBrowserDock;
