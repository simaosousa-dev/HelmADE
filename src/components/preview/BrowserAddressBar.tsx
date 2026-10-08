import React, { useState, useEffect, useCallback } from 'react';

export interface BrowserAddressBarProps {
  url: string;
  isLoading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  className?: string;
}

export const BrowserAddressBar: React.FC<BrowserAddressBarProps> = ({
  url,
  isLoading = false,
  canGoBack = false,
  canGoForward = false,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState(url);

  useEffect(() => {
    setInputValue(url);
  }, [url]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      onNavigate(trimmed);
    },
    [inputValue, onNavigate]
  );

  return (
    <div
      aria-label="Barra de Navegação do Navegador"
      className={`flex items-center gap-1.5 w-full ${className}`}
    >
      {/* Botões de Histórico (Apple HIG: hit-target mínimo de 44x44px) */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onGoBack}
          disabled={!canGoBack}
          aria-label="Retroceder na navegação"
          title="Retroceder (Cmd+[)"
          className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl flex items-center justify-center transition-all ${
            canGoBack
              ? 'text-white/80 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
              : 'text-white/20 cursor-not-allowed'
          } focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onGoForward}
          disabled={!canGoForward}
          aria-label="Avançar na navegação"
          title="Avançar (Cmd+])"
          className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl flex items-center justify-center transition-all ${
            canGoForward
              ? 'text-white/80 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
              : 'text-white/20 cursor-not-allowed'
          } focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onReload}
          aria-label="Recarregar página atual"
          title="Recarregar (Cmd+R)"
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`}
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

      {/* Caixa de Endereço URL macOS Safari Style */}
      <form onSubmit={handleSubmit} className="flex-1 min-w-0 flex items-center">
        <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 focus-within:border-emerald-500/70 focus-within:ring-1 focus-within:ring-emerald-500/40 backdrop-blur-md transition-all shadow-inner">
          {/* Indicador de Conexão Segura / Local */}
          <div
            className="flex items-center text-emerald-400/80 shrink-0"
            title="Conexão de desenvolvimento local protegida"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="http://localhost:5173"
            aria-label="Endereço URL do Live Preview"
            className="flex-1 min-w-0 bg-transparent text-[11px] sm:text-[12px] font-mono text-white/95 placeholder-white/35 focus:outline-none select-text tracking-tight"
          />

          {/* Botão de Ir / Submeter (visível caso haja edição) */}
          {inputValue.trim() !== url && (
            <button
              type="submit"
              aria-label="Navegar para o URL indicado"
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all shrink-0"
            >
              Ir
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default BrowserAddressBar;
