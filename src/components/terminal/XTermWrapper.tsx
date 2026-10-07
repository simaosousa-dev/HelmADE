import React from 'react';
import { useTerminalSession, type UseTerminalSessionOptions } from './useTerminalSession';
import type { ITerminalOptions } from '@xterm/xterm';

export interface XTermWrapperProps {
  sessionId: string;
  className?: string;
  autoFocus?: boolean;
  onReady?: () => void;
  customOptions?: ITerminalOptions;
}

/**
 * Componente de terminal React de alto desempenho baseado em @xterm/xterm e WebGL.
 * Emoldurado com diretrizes de design Apple HIG, fontes SF Mono e redimensionamento automático.
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

  return (
    <div
      onClick={focus}
      className={`relative w-full h-full min-h-[150px] overflow-hidden bg-[#0d1117] rounded-lg border border-white/10 focus-within:border-accent-blue/50 transition-colors duration-150 ${className}`}
      data-testid={`terminal-container-${sessionId}`}
    >
      {/* Elemento de ancoragem onde o @xterm/xterm é montado */}
      <div
        ref={containerRef}
        className="w-full h-full p-2.5 font-mono select-text"
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
