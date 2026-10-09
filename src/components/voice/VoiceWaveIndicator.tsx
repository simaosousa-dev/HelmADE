import React from 'react';
import type { PushToTalkState } from '../../types/shortcuts';

export interface VoiceWaveIndicatorProps {
  /** Estado atual do push-to-talk */
  state: PushToTalkState;
  /** Ação ao clicar no indicador (alternar gravação) */
  onToggle?: () => void;
  /** Variante visual: 'compact' para cabeçalhos/barras estreitas, 'full' para cockpits */
  variant?: 'compact' | 'full';
  /** Classe CSS adicional */
  className?: string;
}

export const VoiceWaveIndicator: React.FC<VoiceWaveIndicatorProps> = ({
  state,
  onToggle,
  variant = 'compact',
  className = '',
}) => {
  const { isListening, isActive, audioLevel, latencyMs, error } = state;

  // Barras de visualização da forma de onda acústica
  const barCount = variant === 'full' ? 5 : 4;
  const bars = Array.from({ length: barCount }, (_, i) => {
    if (!isListening) return 3; // Altura mínima em repouso (3px)
    // Calcula alturas orgânicas baseadas na amplitude e índice da barra
    const multiplier = 0.5 + 0.5 * Math.sin((i + 1) * 1.3);
    const height = Math.max(4, Math.round(audioLevel * 18 * multiplier + 4));
    return Math.min(22, height);
  });

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        isListening
          ? 'Desativar microfone HelmVoice'
          : 'Ativar microfone HelmVoice (Atalho Option+Space)'
      }
      title={
        isListening
          ? 'HelmVoice a escutar... Solte Option+Space ou clique para pausar'
          : 'Pressione e segure Option+Space para Push-to-Talk'
      }
      className={`group relative flex items-center gap-2 select-none min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80 active:scale-[0.98] ${
        isListening || isActive
          ? 'bg-red-500/10 border-red-500/40 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/70 hover:text-white'
      } ${className}`}
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Indicador de Estado / Ponto Pulsante */}
      <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
        {isListening ? (
          <>
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </>
        ) : (
          <span className="inline-flex rounded-full h-2 w-2 bg-white/40 group-hover:bg-white/70 transition-colors" />
        )}
      </div>

      {/* Ícone de Microfone e Barras de Onda Sonora */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Onda Sonora Minimalista */}
        <div
          className="flex items-center gap-[2.5px] h-5 px-0.5"
          aria-hidden="true"
        >
          {bars.map((barHeight, idx) => (
            <span
              key={idx}
              className={`w-[2.5px] rounded-full transition-all duration-75 ${
                isListening
                  ? 'bg-gradient-to-t from-red-500 to-amber-300'
                  : 'bg-white/30'
              }`}
              style={{
                height: `${barHeight}px`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Rótulo de Texto e Badge do Atalho */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-[11px] font-medium tracking-tight whitespace-nowrap"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
          }}
        >
          {isListening ? (
            <span className="text-red-300 font-semibold">A Escutar...</span>
          ) : (
            <span>Voz</span>
          )}
        </span>

        {/* Badge do Atalho macOS HIG */}
        <kbd
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border leading-none transition-colors ${
            isListening
              ? 'bg-red-950/60 border-red-500/40 text-red-200'
              : 'bg-white/[0.06] border-white/10 text-white/50 group-hover:text-white/80'
          }`}
          title="Atalho Push-to-Talk: Option + Barra de Espaço"
        >
          ⌥ Space
        </kbd>

        {/* Indicador de Latência Instantânea (< 50ms) */}
        {latencyMs > 0 && isListening && (
          <span
            className="hidden sm:inline-block text-[9px] text-white/40 font-mono tracking-tighter"
            title={`Latência de disparo: ${latencyMs}ms`}
          >
            {latencyMs}ms
          </span>
        )}
      </div>

      {/* Alerta de Erro Discreto se houver falha */}
      {error && (
        <span
          role="status"
          className="absolute -top-7 left-0 bg-red-950 text-red-200 text-[10px] px-2 py-0.5 rounded border border-red-800 shadow-md whitespace-nowrap"
        >
          {error}
        </span>
      )}
    </button>
  );
};

export default VoiceWaveIndicator;
