import React from 'react';
import { useTerminalSession, type UseTerminalSessionOptions } from './useTerminalSession';
import type { ITerminalOptions } from '@xterm/xterm';
import { useTerminalStore } from '../../stores/useTerminalStore';
import { BlockedPromptBanner } from './BlockedPromptBanner';

export interface XTermWrapperProps {
  sessionId: string;
  className?: string;
  autoFocus?: boolean;
  onReady?: () => void;
  customOptions?: ITerminalOptions;
}

/**
 * Componente de terminal React de alto desempenho baseado em @xterm/xterm e WebGL.
 * Emoldurado com diretrizes de design Apple HIG, fontes SF Mono, standby dinâmico
 * e banners de prompts bloqueados (y/N, password, confirmação).
 */
export const XTermWrapper: React.FC<XTermWrapperProps> = ({
  sessionId,
  className = '',
  autoFocus = true,
  onReady,
  customOptions,
}) => {
  const sessionOptions: UseTerminalSessionOptions = {
    autoFocus,
    onReady,
    customOptions,
  };

  const { containerRef, focus, isReady } = useTerminalSession(sessionId, sessionOptions);
  const { blockedPrompts, standbySessions, toggleStandby } = useTerminalStore();

  const blockedPrompt = blockedPrompts[sessionId];
  const isStandby = standbySessions[sessionId] ?? false;

  const handleContainerClick = () => {
    if (isStandby) {
      toggleStandby(sessionId);
    }
    focus();
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`relative w-full h-full min-h-[150px] overflow-hidden bg-[#0d1117] rounded-lg border transition-colors duration-150 ${
        blockedPrompt
          ? 'border-amber-400/80 ring-1 ring-amber-400/50'
          : isStandby
          ? 'border-indigo-400/30'
          : 'border-white/10 focus-within:border-accent-blue/50'
      } ${className}`}
      data-testid={`terminal-container-${sessionId}`}
    >
      {/* Banner de Prompt Interativo Bloqueado (se ativo) */}
      {blockedPrompt && (
        <BlockedPromptBanner
          sessionId={sessionId}
          blockedPrompt={blockedPrompt}
          className="absolute top-0 inset-x-0"
        />
      )}

      {/* Indicador sutil de standby no canto superior direito quando ocioso */}
      {isStandby && !blockedPrompt && (
        <div
          title="Terminal em hibernação/standby (poupança de CPU). Clique para reativar."
          className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-400/30 text-[10px] text-indigo-300 font-mono flex items-center gap-1 select-none pointer-events-none"
        >
          <span>💤</span>
          <span>Standby</span>
        </div>
      )}

      {/* Elemento de ancoragem onde o @xterm/xterm é montado */}
      <div
        ref={containerRef}
        className={`w-full h-full p-2.5 font-mono select-text transition-all duration-150 ${
          blockedPrompt ? 'pt-14' : ''
        }`}
        style={{
          outline: 'none',
        }}
      />

      {/* Indicador sutil de carregamento inicial */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-xs text-xs text-white/40 font-mono">
          <span className="inline-block w-2 h-2 mr-2 rounded-full bg-accent-blue animate-pulse" />
          A inicializar terminal...
        </div>
      )}
    </div>
  );
};

export default XTermWrapper;
