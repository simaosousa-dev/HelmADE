import React from 'react';
import { useGridLayoutStore, type GridLayoutType } from '../../stores/useGridLayoutStore';

export interface GridLayoutControlsProps {
  className?: string;
}

interface LayoutItem {
  type: GridLayoutType;
  label: string;
  tooltip: string;
  renderIcon: () => React.ReactNode;
}

const LAYOUT_OPTIONS: LayoutItem[] = [
  {
    type: '1x1',
    label: '1×1',
    tooltip: 'Grelha 1×1 (Painel único)',
    renderIcon: () => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <rect x="2" y="2" width="12" height="12" rx="2" strokeWidth="1.4" fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
  },
  {
    type: '1x2',
    label: '1×2',
    tooltip: 'Grelha 1×2 (2 colunas)',
    renderIcon: () => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <rect x="2" y="2" width="5.3" height="12" rx="1.5" strokeWidth="1.3" fill="currentColor" fillOpacity="0.2" />
        <rect x="8.7" y="2" width="5.3" height="12" rx="1.5" strokeWidth="1.3" fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
  },
  {
    type: '2x2',
    label: '2×2',
    tooltip: 'Grelha 2×2 (4 quadrantes)',
    renderIcon: () => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <rect x="2" y="2" width="5.3" height="5.3" rx="1.2" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2" />
        <rect x="8.7" y="2" width="5.3" height="5.3" rx="1.2" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2" />
        <rect x="2" y="8.7" width="5.3" height="5.3" rx="1.2" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2" />
        <rect x="8.7" y="8.7" width="5.3" height="5.3" rx="1.2" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
  },
  {
    type: '2x3',
    label: '2×3',
    tooltip: 'Grelha 2×3 (6 painéis: 3 colunas, 2 linhas)',
    renderIcon: () => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <rect x="1.5" y="2" width="3.6" height="5.3" rx="1" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="6.2" y="2" width="3.6" height="5.3" rx="1" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="10.9" y="2" width="3.6" height="5.3" rx="1" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="1.5" y="8.7" width="3.6" height="5.3" rx="1" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="6.2" y="8.7" width="3.6" height="5.3" rx="1" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="10.9" y="8.7" width="3.6" height="5.3" rx="1" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
  },
  {
    type: '3x3',
    label: '3×3',
    tooltip: 'Grelha 3×3 (9 painéis)',
    renderIcon: () => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <rect x="1.5" y="1.5" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="6.2" y="1.5" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="10.9" y="1.5" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="1.5" y="6.2" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="6.2" y="6.2" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="10.9" y="6.2" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="1.5" y="10.9" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="6.2" y="10.9" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
        <rect x="10.9" y="10.9" width="3.6" height="3.6" rx="0.8" strokeWidth="1.1" fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
  },
  {
    type: '4x4',
    label: '4×4',
    tooltip: 'Grelha 4×4 (16 painéis)',
    renderIcon: () => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1.5" y="1.5" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="5.0" y="1.5" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="8.5" y="1.5" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="12.0" y="1.5" width="2.4" height="2.4" rx="0.6" opacity="0.8" />

        <rect x="1.5" y="5.0" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="5.0" y="5.0" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="8.5" y="5.0" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="12.0" y="5.0" width="2.4" height="2.4" rx="0.6" opacity="0.8" />

        <rect x="1.5" y="8.5" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="5.0" y="8.5" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="8.5" y="8.5" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="12.0" y="8.5" width="2.4" height="2.4" rx="0.6" opacity="0.8" />

        <rect x="1.5" y="12.0" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="5.0" y="12.0" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="8.5" y="12.0" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
        <rect x="12.0" y="12.0" width="2.4" height="2.4" rx="0.6" opacity="0.8" />
      </svg>
    ),
  },
];

export const GridLayoutControls: React.FC<GridLayoutControlsProps> = ({ className = '' }) => {
  const {
    layout,
    setLayout,
    activePanelId,
    maximizedPanelId,
    toggleMaximizePanel,
    panels,
  } = useGridLayoutStore();

  const isMaximized = maximizedPanelId !== null;
  const canToggleMaximize = activePanelId !== null || isMaximized;

  const handleToggleMaximize = () => {
    if (maximizedPanelId) {
      toggleMaximizePanel(maximizedPanelId);
    } else if (activePanelId) {
      toggleMaximizePanel(activePanelId);
    } else if (panels.length > 0) {
      toggleMaximizePanel(panels[0].id);
    }
  };

  return (
    <nav
      aria-label="Controlos de Layout de Grelha"
      className={`inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#1c1c1e]/80 backdrop-blur-md border border-white/10 shadow-xs select-none ${className}`}
    >
      {/* Botões seletores de layout */}
      <div className="flex items-center gap-1">
        {LAYOUT_OPTIONS.map((item) => {
          const isActive = layout === item.type && !isMaximized;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                if (isMaximized && maximizedPanelId) {
                  toggleMaximizePanel(maximizedPanelId);
                }
                setLayout(item.type);
              }}
              title={item.tooltip}
              aria-label={item.tooltip}
              aria-pressed={isActive}
              className={`min-w-[44px] min-h-[44px] px-2.5 py-1.5 rounded-lg border text-[12px] font-medium tracking-tight flex items-center justify-center gap-1.5 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none ${
                isActive
                  ? 'bg-blue-600/25 text-blue-300 border-blue-500/40 shadow-xs'
                  : 'bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.08] border-white/5 hover:border-white/10'
              }`}
            >
              {item.renderIcon()}
              <span className="hidden sm:inline font-mono text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Separador vertical Apple HIG */}
      <div className="h-6 w-px bg-white/15 mx-0.5" aria-hidden="true" />

      {/* Botão de Zoom / Maximizar em 1 Toque */}
      <button
        type="button"
        onClick={handleToggleMaximize}
        disabled={!canToggleMaximize}
        title={
          isMaximized
            ? 'Restaurar layout da grelha (⌘↵)'
            : 'Maximizar painel focado em 1 toque (⌘↵)'
        }
        aria-label={isMaximized ? 'Restaurar layout da grelha' : 'Maximizar painel focado'}
        aria-pressed={isMaximized}
        className={`min-w-[44px] min-h-[44px] px-3 py-1.5 rounded-lg border text-[12px] font-medium tracking-tight flex items-center justify-center gap-1.5 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none ${
          !canToggleMaximize
            ? 'opacity-40 cursor-not-allowed bg-transparent text-white/40 border-transparent'
            : isMaximized
            ? 'bg-accent-blue/30 text-blue-200 border-accent-blue/50 shadow-xs'
            : 'bg-white/[0.03] text-white/80 hover:text-white hover:bg-white/[0.08] border-white/10 hover:border-white/20'
        }`}
      >
        {isMaximized ? (
          // Ícone Restaurar (setas para dentro)
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 9L4 4m0 0h4m-4 0v4m6 6l5 5m0 0h-4m4 0v-4M9 15l-5 5m0 0h4m-4 0v-4m11-6l5-5m0 0h-4m4 0v4"
            />
          </svg>
        ) : (
          // Ícone Maximizar (setas para fora)
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        )}
        <span className="hidden md:inline">
          {isMaximized ? 'Restaurar' : 'Maximizar'}
        </span>
        <span className="hidden xl:inline text-[10px] text-white/40 font-mono">⌘↵</span>
      </button>
    </nav>
  );
};

export default GridLayoutControls;
