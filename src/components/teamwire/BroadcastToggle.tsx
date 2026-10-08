import React from 'react';

export interface BroadcastToggleProps {
  isBroadcast: boolean;
  onToggle: (enabled: boolean) => void;
  activeCount?: number;
  className?: string;
  compact?: boolean;
}

export const BroadcastToggle: React.FC<BroadcastToggleProps> = ({
  isBroadcast,
  onToggle,
  activeCount = 0,
  className = '',
  compact = false,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isBroadcast}
      aria-label={
        isBroadcast
          ? `Modo Broadcast Ativo: difusão de comandos para todos os ${activeCount} terminais. Clique para alternar para modo Unicast.`
          : 'Modo Unicast Ativo: comandos enviados para o agente ou terminal selecionado. Clique para alternar para modo Broadcast.'
      }
      onClick={() => onToggle(!isBroadcast)}
      title={
        isBroadcast
          ? `Modo Broadcast ATIVO: envia comandos para todos os ${activeCount} terminais em simultâneo (clique para Unicast)`
          : 'Modo Unicast: envia comandos apenas para o Orquestrador / agente selecionado (clique para Broadcast)'
      }
      className={`min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-[12px] font-semibold border flex items-center justify-center gap-2.5 transition-all duration-200 select-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[#161618] ${
        isBroadcast
          ? 'bg-amber-500/20 hover:bg-amber-500/25 border-amber-400/60 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.25)] focus-visible:ring-amber-400'
          : 'bg-white/[0.05] hover:bg-white/10 border-white/10 hover:border-white/20 text-white/80 hover:text-white focus-visible:ring-blue-500'
      } ${className}`}
    >
      {/* Indicador de Status Visual / Pulsar */}
      {isBroadcast ? (
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
        </span>
      ) : (
        <span
          className="h-2 w-2 rounded-full bg-white/35 shrink-0"
          aria-hidden="true"
        />
      )}

      {/* Ícone de Ondas de Broadcast vs Alvo Direto */}
      <span className="shrink-0" aria-hidden="true">
        {isBroadcast ? (
          <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        )}
      </span>

      {/* Rótulo de Texto */}
      <span className="tracking-tight whitespace-nowrap">
        {compact ? (isBroadcast ? 'Broadcast' : 'Unicast') : (isBroadcast ? 'Broadcast Global' : 'Unicast')}
      </span>

      {/* Badge Contador de Terminais quando em Broadcast */}
      {isBroadcast && (
        <span
          className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/25 text-amber-100 border border-amber-400/40"
          title={`${activeCount} terminais ativos receberão o comando`}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
};

export default BroadcastToggle;
