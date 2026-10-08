import React from 'react';
import { BrowserAddressBar } from './BrowserAddressBar';
import { ViewportSelector } from './ViewportSelector';
import type { DetectedDevServer, ViewportMode } from '../../types/preview';

export interface BrowserToolbarProps {
  url: string;
  isLoading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;

  viewportMode: ViewportMode;
  onSelectViewport: (mode: ViewportMode) => void;

  servers: DetectedDevServer[];
  activeServer: DetectedDevServer | null;
  onSelectServer: (port: number) => void;

  isConsoleOpen: boolean;
  errorCount: number;
  warnCount: number;
  onToggleConsole: () => void;

  onOpenExternal: () => void;
  onClose: () => void;
  className?: string;
}

export const BrowserToolbar: React.FC<BrowserToolbarProps> = ({
  url,
  isLoading = false,
  canGoBack = false,
  canGoForward = false,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  viewportMode,
  onSelectViewport,
  servers,
  activeServer,
  onSelectServer,
  isConsoleOpen,
  errorCount,
  warnCount,
  onToggleConsole,
  onOpenExternal,
  onClose,
  className = '',
}) => {
  return (
    <header
      aria-label="Barra de Ferramentas Principal do Live Browser"
      className={`h-14 px-3 sm:px-4 flex items-center justify-between gap-2.5 border-b border-white/10 shrink-0 bg-[#1c1c1e]/90 backdrop-blur-xl ${className}`}
    >
      {/* ── Esquerda: Identificador & Status ──────────────────────────────── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
        </div>
        <div className="hidden md:block">
          <div className="flex items-center gap-1.5">
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
              ? `${servers.length} servidor${servers.length !== 1 ? 'es' : ''}`
              : 'PTY Sniffer à escuta'}
          </p>
        </div>
      </div>

      {/* ── Centro: Barra de Endereço e Navegação ─────────────────────────── */}
      <div className="flex-1 max-w-sm lg:max-w-md min-w-[120px]">
        <BrowserAddressBar
          url={url}
          isLoading={isLoading}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onNavigate={onNavigate}
          onGoBack={onGoBack}
          onGoForward={onGoForward}
          onReload={onReload}
        />
      </div>

      {/* ── Centro/Direita: Seletor de Viewport (Desktop, Tablet, Mobile) ─── */}
      <div className="hidden sm:flex items-center">
        <ViewportSelector
          currentMode={viewportMode}
          onSelectMode={onSelectViewport}
        />
      </div>

      {/* ── Direita: Ações, Consola & Fechar ──────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Dropdown de Servidores Múltiplos */}
        {servers.length > 1 && (
          <div className="relative">
            <select
              aria-label="Selecionar servidor de desenvolvimento ativo"
              value={activeServer?.port ?? ''}
              onChange={(e) => onSelectServer(Number(e.target.value))}
              className="h-9 pl-2 pr-6 rounded-xl bg-white/[0.08] border border-white/10 text-[11px] font-medium text-white/90 hover:bg-white/15 focus:outline-none focus:border-emerald-500/80 cursor-pointer appearance-none"
            >
              {servers.map((s) => (
                <option key={`${s.session_id}-${s.port}`} value={s.port} className="bg-[#242428] text-white">
                  Porta :{s.port}
                </option>
              ))}
            </select>
            <svg
              className="w-3 h-3 absolute right-2 top-3 text-white/50 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}

        {/* Botão Gaveta da Consola (com Badge de Erros) */}
        <button
          type="button"
          onClick={onToggleConsole}
          aria-label={isConsoleOpen ? 'Ocultar consola webview' : 'Mostrar consola webview'}
          title={isConsoleOpen ? 'Ocultar consola' : 'Abrir consola webview'}
          className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl relative transition-all flex items-center justify-center ${
            isConsoleOpen
              ? 'bg-white/15 text-white border border-white/20'
              : errorCount > 0
              ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          } active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {(errorCount > 0 || warnCount > 0) && (
            <span
              className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                errorCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
          )}
        </button>

        {/* Botão Abrir no SO Padrão */}
        <button
          type="button"
          onClick={onOpenExternal}
          aria-label="Abrir no navegador externo do SO"
          title="Abrir no navegador nativo (Safari / Chrome)"
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
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

        {/* Botão Fechar Live Preview */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel Live Preview"
          title="Fechar Live Preview"
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default BrowserToolbar;
