import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAutoPortDetection } from '../../hooks/useAutoPortDetection';
import type { DetectedDevServer } from '../../types/preview';

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
    setActiveServer,
    setCurrentUrl,
    setOpen,
    openInExternal,
  } = useAutoPortDetection();

  const [inputUrl, setInputUrl] = useState(currentUrl || 'http://localhost:5173');
  const [reloadKey, setReloadKey] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sincroniza o input da barra de URL quando o currentUrl ou activeServer muda
  useEffect(() => {
    if (currentUrl) {
      setInputUrl(currentUrl);
    }
  }, [currentUrl]);

  const handleNavigate = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      let target = inputUrl.trim();
      if (!target) return;
      if (!/^https?:\/\//i.test(target)) {
        target = `http://${target}`;
      }
      setCurrentUrl(target);
      setIsIframeLoading(true);
      setReloadKey((prev) => prev + 1);
    },
    [inputUrl, setCurrentUrl]
  );

  const handleReload = useCallback(() => {
    setIsIframeLoading(true);
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleServerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedPort = Number(e.target.value);
      const found = servers.find((s) => s.port === selectedPort);
      if (found) {
        setActiveServer(found);
        setInputUrl(found.url);
        setIsIframeLoading(true);
        setReloadKey((prev) => prev + 1);
      }
    },
    [servers, setActiveServer]
  );

  const handleSelectPresetPort = useCallback(
    (port: number) => {
      const presetUrl = `http://localhost:${port}`;
      setInputUrl(presetUrl);
      setCurrentUrl(presetUrl);
      setIsIframeLoading(true);
      setReloadKey((prev) => prev + 1);
    },
    [setCurrentUrl]
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

  return (
    <aside
      aria-label="Painel de Live Preview Webview Dockado"
      className={`flex flex-col h-full bg-[#161618] border-l border-white/10 text-white select-none backdrop-blur-xl transition-all duration-200 ${className}`}
    >
      {/* ── Barra de Ferramentas Superior (Apple HIG Safari Style) ────────────── */}
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between gap-2 border-b border-white/10 shrink-0 bg-[#1c1c1e]/90">
        {/* Identificador & Ícone do Browser */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold tracking-tight text-white/95">
                Live Preview
              </h2>
              {activeServer && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  :{activeServer.port}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/50 tracking-tight">
              {servers.length > 0
                ? `${servers.length} dev server${servers.length !== 1 ? 's' : ''} detetado${servers.length !== 1 ? 's' : ''}`
                : 'PTY Sniffer à escuta'}
            </p>
          </div>
        </div>

        {/* ── Barra de Endereço / Address Pill macOS Style ─────────────────── */}
        <form
          onSubmit={handleNavigate}
          className="flex-1 max-w-sm sm:max-w-md min-w-[140px] flex items-center"
        >
          <div className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 focus-within:border-emerald-500/70 focus-within:ring-1 focus-within:ring-emerald-500/40 transition-all">
            {/* Ícone Seguro / Local */}
            <svg
              className="w-3.5 h-3.5 shrink-0 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>

            {/* Input de URL */}
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://localhost:5173"
              className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-white/90 placeholder-white/40 focus:outline-none select-text"
            />

            {/* Botão Recarregar (com alvo tátil e animação) */}
            <button
              type="button"
              onClick={handleReload}
              title="Recarregar página (Cmd+R)"
              aria-label="Recarregar página"
              className="min-h-[32px] min-w-[32px] p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center focus-visible:ring-1 focus-visible:ring-emerald-400 focus-visible:outline-none"
            >
              <svg
                className={`w-3.5 h-3.5 ${isIframeLoading ? 'animate-spin text-emerald-400' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </form>

        {/* ── Controlos Rápidos (Direita) ─────────────────────────────────── */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Seletor Dropdown de Servidores (se houver mais de 1) */}
          {servers.length > 1 && (
            <div className="relative">
              <select
                aria-label="Selecionar servidor de desenvolvimento ativo"
                value={activeServer?.port ?? ''}
                onChange={handleServerChange}
                className="h-8 pl-2 pr-6 rounded-lg bg-white/[0.08] border border-white/10 text-[11px] font-medium text-white/90 hover:bg-white/15 focus:outline-none focus:border-emerald-500/80 cursor-pointer appearance-none"
              >
                {servers.map((s: DetectedDevServer) => (
                  <option key={`${s.session_id}-${s.port}`} value={s.port} className="bg-[#242428] text-white">
                    Porta :{s.port}
                  </option>
                ))}
              </select>
              <svg
                className="w-3 h-3 absolute right-2 top-2.5 text-white/50 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}

          {/* Abrir no Navegador Padrão do SO (macOS Safari/Chrome) */}
          <button
            type="button"
            onClick={() => openInExternal(currentUrl)}
            title="Abrir no navegador padrão do SO"
            aria-label="Abrir no navegador padrão do SO"
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>

          {/* Fechar/Colapsar a Dock */}
          <button
            type="button"
            onClick={handleClose}
            title="Fechar Live Preview"
            aria-label="Fechar painel Live Preview"
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Conteúdo Principal: Webview ou Estado Vazio ─────────────────────── */}
      <div className="flex-1 min-h-0 relative bg-black/30 overflow-hidden flex flex-col">
        {servers.length === 0 && !activeServer ? (
          /* Estado Vazio Elegante (Apple HIG Minimalist) */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
            <div className="relative mb-4">
              {/* Círculo com efeito de radar/escrita sutil */}
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

            {/* Formulário de Conexão Manual Rápida */}
            <div className="mt-6 pt-5 border-t border-white/5 w-full max-w-xs flex flex-col items-center">
              <span className="text-[11px] text-white/40 mb-2">Ou conecta diretamente:</span>
              <div className="w-full flex items-center gap-2">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="http://localhost:5173"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-[12px] font-mono text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/70"
                />
                <button
                  type="button"
                  onClick={() => handleNavigate()}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[12px] font-semibold border border-emerald-400/30 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
                >
                  Conectar
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Iframe Seguro para Live Preview */
          <div className="relative w-full h-full flex-1">
            {isIframeLoading && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2 text-white/80">
                <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[12px] font-medium font-mono text-white/90">
                  A carregar {currentUrl}...
                </span>
              </div>
            )}
            <iframe
              ref={iframeRef}
              key={reloadKey}
              src={currentUrl}
              title="Live Browser Preview"
              onLoad={() => setIsIframeLoading(false)}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi"
            />
          </div>
        )}
      </div>

      {/* ── Barra de Rodapé / Status Bar macOS ─────────────────────────────── */}
      <div className="h-8 px-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50 bg-[#161618] shrink-0">
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
          {activeServer?.session_id && (
            <span className="font-mono text-[10px] text-white/40 truncate hidden sm:inline">
              (sessão: {activeServer.session_id.slice(0, 8)})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
      </div>
    </aside>
  );
};

export default LiveBrowserDock;
