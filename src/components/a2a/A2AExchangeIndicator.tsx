import React from 'react';

export interface A2AExchangeIndicatorProps {
  isExchanging?: boolean;
  agentName?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Indicador visual e sensorial de troca ativa de mensagens A2A (Apple HIG).
 * Apresenta uma micro-animação pulsante suave que indica que o agente está a transacionar
 * mensagens com outros membros do enxame.
 */
export const A2AExchangeIndicator: React.FC<A2AExchangeIndicatorProps> = ({
  isExchanging = false,
  agentName,
  className = '',
  size = 'sm',
}) => {
  if (!isExchanging) return null;

  const dotSizeClass = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Comunicação inter-agentes ativa${agentName ? ` para ${agentName}` : ''}`}
      title={`Comunicação A2A ativa${agentName ? ` (${agentName})` : ''}`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono select-none transition-all duration-200 ${className}`}
    >
      <span className="relative flex shrink-0">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75`}
        />
        <span
          className={`relative inline-flex rounded-full bg-cyan-400 ${dotSizeClass} shadow-[0_0_8px_rgba(34,211,238,0.8)]`}
        />
      </span>
      <span className="text-[10px] font-semibold tracking-tight uppercase flex items-center gap-1">
        <svg
          className="w-2.5 h-2.5 shrink-0 animate-pulse text-cyan-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        <span>A2A</span>
      </span>
    </div>
  );
};

export default A2AExchangeIndicator;
