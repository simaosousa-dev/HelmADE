import React from 'react';
import type { TerminalStatus, TerminalPanelColor } from '../../types/terminal';

export interface TerminalStatusBadgeProps {
  status?: TerminalStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
  onClick?: () => void;
}

export interface StatusConfig {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  glowColor: string;
  isPulsing: boolean;
}

export const STATUS_CONFIGS: Record<TerminalStatus, StatusConfig> = {
  running: {
    label: 'Ativo',
    textColor: 'text-emerald-300',
    bgColor: 'bg-emerald-500/12',
    borderColor: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    glowColor: 'shadow-[0_0_8px_rgba(52,211,153,0.7)]',
    isPulsing: true,
  },
  active: {
    label: 'Ativo',
    textColor: 'text-emerald-300',
    bgColor: 'bg-emerald-500/12',
    borderColor: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    glowColor: 'shadow-[0_0_8px_rgba(52,211,153,0.7)]',
    isPulsing: true,
  },
  idle: {
    label: 'Em Espera',
    textColor: 'text-amber-200',
    bgColor: 'bg-amber-500/12',
    borderColor: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
    glowColor: 'shadow-[0_0_6px_rgba(251,191,36,0.5)]',
    isPulsing: false,
  },
  waiting: {
    label: 'Em Espera',
    textColor: 'text-amber-200',
    bgColor: 'bg-amber-500/12',
    borderColor: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
    glowColor: 'shadow-[0_0_6px_rgba(251,191,36,0.5)]',
    isPulsing: false,
  },
  completed: {
    label: 'Concluído',
    textColor: 'text-blue-200',
    bgColor: 'bg-blue-500/12',
    borderColor: 'border-blue-500/30',
    dotColor: 'bg-blue-400',
    glowColor: 'shadow-[0_0_6px_rgba(96,165,250,0.5)]',
    isPulsing: false,
  },
  error: {
    label: 'Erro',
    textColor: 'text-red-300',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/35',
    dotColor: 'bg-red-400',
    glowColor: 'shadow-[0_0_8px_rgba(248,113,113,0.7)]',
    isPulsing: false,
  },
};

export interface ColorBadgeConfig {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  glowColor: string;
}

export const COLOR_CONFIGS: Record<TerminalPanelColor, ColorBadgeConfig> = {
  gold: {
    label: 'Dourado',
    textColor: 'text-amber-200',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-400/40',
    dotColor: 'bg-amber-300',
    glowColor: 'shadow-[0_0_8px_rgba(255,214,10,0.6)]',
  },
  blue: {
    label: 'Azul',
    textColor: 'text-blue-200',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-400/40',
    dotColor: 'bg-blue-400',
    glowColor: 'shadow-[0_0_8px_rgba(10,132,255,0.6)]',
  },
  green: {
    label: 'Verde',
    textColor: 'text-emerald-200',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-400/40',
    dotColor: 'bg-emerald-400',
    glowColor: 'shadow-[0_0_8px_rgba(48,209,88,0.6)]',
  },
  purple: {
    label: 'Roxo',
    textColor: 'text-purple-200',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-400/40',
    dotColor: 'bg-purple-400',
    glowColor: 'shadow-[0_0_8px_rgba(191,90,242,0.6)]',
  },
  red: {
    label: 'Vermelho',
    textColor: 'text-red-200',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-400/40',
    dotColor: 'bg-red-400',
    glowColor: 'shadow-[0_0_8px_rgba(255,69,58,0.6)]',
  },
};

/**
 * Distintivo de Estado Reativo (Apple HIG)
 * Renderiza o estado (Ativo, Em Espera, Concluído, Erro) com halo pulsante de alta visibilidade
 * e contraste WCAG 2.1 AA (> 4.5:1).
 */
export const TerminalStatusBadge: React.FC<TerminalStatusBadgeProps> = ({
  status = 'idle',
  showLabel = true,
  size = 'md',
  className = '',
  title,
  onClick,
}) => {
  const config = STATUS_CONFIGS[status] ?? STATUS_CONFIGS.idle;
  const isSmall = size === 'sm';

  return (
    <div
      role={onClick ? 'button' : 'status'}
      onClick={onClick}
      title={title ?? `Estado do terminal: ${config.label}`}
      aria-label={`Estado: ${config.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border backdrop-blur-xs select-none transition-colors duration-150 ${
        isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      } font-medium tracking-tight ${config.bgColor} ${config.borderColor} ${config.textColor} ${
        onClick ? 'cursor-pointer hover:brightness-110' : ''
      } ${className}`}
    >
      {/* Indicador luminoso com halo pulsante quando ativo */}
      <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
        {config.isPulsing && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor}`}
            aria-hidden="true"
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor} ${config.glowColor}`}
          aria-hidden="true"
        />
      </span>

      {showLabel && (
        <span className="leading-none whitespace-nowrap">
          {config.label}
        </span>
      )}
    </div>
  );
};

export interface TerminalColorBadgeProps {
  color: TerminalPanelColor;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  title?: string;
}

/**
 * Distintivo de Cor Semântica (Dourado, Azul, Verde, Roxo, Vermelho)
 * Conforme as diretrizes Apple HIG com materiais semânticos translúcidos.
 */
export const TerminalColorBadge: React.FC<TerminalColorBadgeProps> = ({
  color,
  showLabel = false,
  size = 'md',
  interactive = false,
  onClick,
  className = '',
  title,
}) => {
  const config = COLOR_CONFIGS[color] ?? COLOR_CONFIGS.blue;
  const isSmall = size === 'sm';

  return (
    <div
      role={interactive || onClick ? 'button' : undefined}
      tabIndex={interactive || onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      title={title ?? `Cor semântica: ${config.label}`}
      aria-label={`Cor do painel: ${config.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border backdrop-blur-xs select-none transition-all duration-150 ${
        isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } font-medium tracking-tight ${config.bgColor} ${config.borderColor} ${config.textColor} ${
        interactive || onClick
          ? 'cursor-pointer hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none'
          : ''
      } ${className}`}
    >
      <span
        className={`inline-block rounded-full shrink-0 ${isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${config.dotColor} ${config.glowColor}`}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="leading-none whitespace-nowrap">
          {config.label}
        </span>
      )}
    </div>
  );
};

export default TerminalStatusBadge;
