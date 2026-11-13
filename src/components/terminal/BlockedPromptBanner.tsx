import React, { useState, useEffect, useRef } from 'react';
import type { BlockedPromptInfo } from '../../types/terminal';
import { terminalStore } from '../../stores/useTerminalStore';

export interface BlockedPromptBannerProps {
  sessionId: string;
  blockedPrompt: BlockedPromptInfo;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Banner de Alerta e Confirmação de Prompts Bloqueados (Apple HIG)
 * 
 * Fornece interface não-obstrutiva com atalhos de resposta rápida (y/N, password, texto)
 * com materiais translúcidos semânticos macOS, tipografia SF Pro Text e contraste WCAG 2.1 AA (> 4.5:1).
 */
export const BlockedPromptBanner: React.FC<BlockedPromptBannerProps> = ({
  sessionId,
  blockedPrompt,
  onDismiss,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { promptText, promptType, defaultChoice } = blockedPrompt;

  // Foco automático se for prompt de password ou texto
  useEffect(() => {
    if (promptType === 'password' || promptType === 'input') {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [promptType]);

  // Captura de atalhos de teclado diretos (Y/N/Enter) quando o banner está ativo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Não interceta se o utilizador estiver focado num input de texto ou password
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== inputRef.current) {
        return;
      }

      if (promptType === 'yes_no') {
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          e.stopPropagation();
          terminalStore.respondToPrompt(sessionId, 'y');
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          e.stopPropagation();
          terminalStore.respondToPrompt(sessionId, 'n');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          terminalStore.respondToPrompt(sessionId, defaultChoice ?? 'y');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [sessionId, promptType, defaultChoice]);

  const handleQuickChoice = (choice: string) => {
    terminalStore.respondToPrompt(sessionId, choice);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      terminalStore.respondToPrompt(sessionId, inputValue);
      setInputValue('');
    }
  };

  const isYDefault = defaultChoice?.toLowerCase() === 'y';
  const isNDefault = defaultChoice?.toLowerCase() === 'n';

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid={`blocked-prompt-banner-${sessionId}`}
      className={`relative z-30 w-full overflow-hidden rounded-t-lg border-b border-amber-500/40 bg-stone-900/95 backdrop-blur-md text-amber-100 shadow-2xl transition-all duration-200 animate-in slide-in-from-top-2 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3.5 py-2.5">
        {/* Lado Esquerdo: Ícone de Alerta e Pergunta */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Indicador pulsante Apple HIG */}
          <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"
              aria-hidden="true"
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-amber-400/90 font-sans">
                Ação Necessária
              </span>
              <span className="text-amber-500/50 text-[10px]">•</span>
              <span className="text-[11px] text-amber-200/70 truncate font-mono">
                {sessionId}
              </span>
            </div>
            <p
              className="text-xs sm:text-[13px] font-medium text-amber-50 truncate tracking-tight font-sans select-text"
              title={promptText}
            >
              {promptText}
            </p>
          </div>
        </div>

        {/* Lado Direito: Ações Interativas Rápidas */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          {promptType === 'yes_no' && (
            <div className="flex items-center gap-2">
              {/* Botão Sim (y) */}
              <button
                type="button"
                onClick={() => handleQuickChoice('y')}
                data-testid={`blocked-prompt-yes-${sessionId}`}
                title="Responder Sim (Atalho: Tecla Y ou Enter se default)"
                className={`min-h-[44px] min-w-[44px] px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                  isYDefault
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/40 ring-1 ring-emerald-400/50'
                    : 'bg-stone-800 hover:bg-stone-700 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                <span>Sim</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/30 text-emerald-200">
                  Y
                </kbd>
              </button>

              {/* Botão Não (n) */}
              <button
                type="button"
                onClick={() => handleQuickChoice('n')}
                title="Responder Não (Atalho: Tecla N ou Enter se default)"
                className={`min-h-[44px] min-w-[44px] px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                  isNDefault
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40 border border-rose-400/40 ring-1 ring-rose-400/50'
                    : 'bg-stone-800 hover:bg-stone-700 text-rose-300 border border-rose-500/30'
                }`}
              >
                <span>Não</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/30 text-rose-200">
                  N
                </kbd>
              </button>
            </div>
          )}

          {promptType === 'password' && (
            <form onSubmit={handleInputSubmit} className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="password"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Introduza a palavra-passe..."
                aria-label="Palavra-passe requerida"
                className="min-h-[44px] px-3 py-1.5 text-xs bg-stone-950/90 border border-amber-500/40 rounded-md text-white placeholder-amber-400/40 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              <button
                type="submit"
                className="min-h-[44px] px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold cursor-pointer transition-colors active:scale-95"
              >
                Enviar
              </button>
            </form>
          )}

          {promptType === 'input' && (
            <form onSubmit={handleInputSubmit} className="flex items-center gap-1.5">
              {defaultChoice === 'Enter' ? (
                <button
                  type="button"
                  onClick={() => handleQuickChoice('')}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold cursor-pointer transition-colors active:scale-95 flex items-center gap-1.5"
                >
                  <span>Continuar</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-stone-950/20 text-stone-950 font-bold">
                    ↵
                  </kbd>
                </button>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Resposta..."
                    aria-label="Resposta ao prompt"
                    className="min-h-[44px] px-3 py-1.5 text-xs bg-stone-950/90 border border-amber-500/40 rounded-md text-white placeholder-amber-400/40 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold cursor-pointer transition-colors active:scale-95"
                  >
                    Enviar
                  </button>
                </>
              )}
            </form>
          )}

          {/* Botão de Fechar / Ignorar não-obstrutivo */}
          <button
            type="button"
            onClick={() => {
              terminalStore.clearBlockedPrompt(sessionId);
              onDismiss?.();
            }}
            title="Ignorar alerta"
            aria-label="Dispensar alerta"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-amber-300/60 hover:text-amber-100 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockedPromptBanner;
