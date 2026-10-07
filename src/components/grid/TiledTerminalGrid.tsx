import React, { useEffect } from 'react';
import { XTermWrapper } from '../terminal/XTermWrapper';
import {
  useGridLayoutStore,
  gridLayoutStore,
  getLayoutDimensions,
  type GridLayoutType,
} from '../../stores/useGridLayoutStore';

export interface TiledTerminalGridProps {
  className?: string;
  onAddPanel?: () => void;
}

const GRID_LAYOUT_CLASSES: Record<GridLayoutType, string> = {
  '1x1': 'grid-cols-1 grid-rows-1',
  '1x2': 'grid-cols-2 grid-rows-1',
  '2x2': 'grid-cols-2 grid-rows-2',
  '2x3': 'grid-cols-3 grid-rows-2',
  '3x3': 'grid-cols-3 grid-rows-3',
  '4x4': 'grid-cols-4 grid-rows-4',
};

/**
 * Contentor CSS Grid de alto desempenho para múltiplos terminais @xterm/xterm.
 * 
 * INVARIANTE ABSOLUTO DE PRESERVAÇÃO DE DOM:
 * Os terminais XTermWrapper NUNCA são desmontados durante trocas de layout ou maximização.
 * Painéis fora da capacidade visível ou ocultos na maximização recebem `display: none`
 * garantindo retenção perpétua de buffers, WebGL e processos PTY ativos.
 */
export const TiledTerminalGrid: React.FC<TiledTerminalGridProps> = ({
  className = '',
  onAddPanel,
}) => {
  const {
    layout,
    panels,
    activePanelId,
    maximizedPanelId,
    setActivePanelId,
    toggleMaximizePanel,
    removePanel,
  } = useGridLayoutStore();

  const isMaximized = maximizedPanelId !== null && panels.some((p) => p.id === maximizedPanelId);
  const { maxPanels } = getLayoutDimensions(layout);

  // Redimensionamento automático do PTY em transições de layout
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
    return () => clearTimeout(timer);
  }, [layout, maximizedPanelId]);

  // Gestor global de atalhos de teclado Apple HIG com fase de captura
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter (macOS) ou Ctrl+Enter: Zoom / Maximizar painel ativo
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const state = gridLayoutStore.getState();
        const targetId = state.maximizedPanelId ?? state.activePanelId;
        if (targetId) {
          e.preventDefault();
          e.stopPropagation();
          gridLayoutStore.toggleMaximizePanel(targetId);
        }
        return;
      }

      // Escape: Restaurar grelha se maximizado
      if (e.key === 'Escape') {
        const state = gridLayoutStore.getState();
        if (state.maximizedPanelId) {
          e.preventDefault();
          e.stopPropagation();
          gridLayoutStore.toggleMaximizePanel(state.maximizedPanelId);
        }
        return;
      }

      // Cmd+Option+ArrowRight ou Ctrl+Option+ArrowRight: Próximo painel
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        gridLayoutStore.cycleNextPanel();
        return;
      }

      // Cmd+Option+ArrowLeft ou Ctrl+Option+ArrowLeft: Painel anterior
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        gridLayoutStore.cyclePrevPanel();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  // Estado vazio quando não existem painéis criados
  if (panels.length === 0) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-[#161618] rounded-xl border border-white/10 ${className}`}
        data-testid="tiled-grid-empty"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-white/40 shadow-inner">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </div>
        <h3 className="text-[14px] font-semibold text-white/90 tracking-tight">Grelha de Terminais Vazia</h3>
        <p className="text-[12px] text-white/50 max-w-sm mt-1 mb-5 leading-relaxed">
          Nenhum painel ativo na grelha. Adicione terminais para monitorizar múltiplos agentes em tempo real.
        </p>
        {onAddPanel && (
          <button
            type="button"
            onClick={onAddPanel}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium tracking-tight border border-blue-400/30 shadow-md transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Criar Novo Terminal
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full p-2 relative ${
        isMaximized
          ? 'flex flex-col'
          : `grid gap-2 ${GRID_LAYOUT_CLASSES[layout]}`
      } ${className}`}
      data-testid="tiled-terminal-grid"
    >
      {panels.map((panel, index) => {
        const isThisMaximized = isMaximized && panel.id === maximizedPanelId;
        const isVisibleInGrid = !isMaximized && index < maxPanels;
        const isVisible = isThisMaximized || isVisibleInGrid;
        const isActive = activePanelId === panel.id;

        return (
          <div
            key={panel.id}
            style={{ display: isVisible ? undefined : 'none' }}
            onClick={() => setActivePanelId(panel.id)}
            data-testid={`grid-panel-${panel.id}`}
            className={`flex flex-col min-h-0 min-w-0 rounded-xl overflow-hidden border transition-all duration-150 bg-[#0d1117] ${
              isThisMaximized
                ? 'absolute inset-2 z-20 shadow-2xl'
                : 'w-full h-full'
            } ${
              isActive
                ? 'border-blue-500/70 ring-1 ring-blue-500/40'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            {/* Cabeçalho do Painel Apple HIG */}
            <header
              onDoubleClick={() => toggleMaximizePanel(panel.id)}
              className={`h-11 px-3 flex items-center justify-between border-b select-none transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'bg-[#1e222b] border-blue-500/40 text-white'
                  : 'bg-[#161618] border-white/10 text-white/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Indicador de estado ativo */}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                    isActive
                      ? 'bg-accent-green shadow-[0_0_6px_rgba(48,209,88,0.7)]'
                      : 'bg-white/20'
                  }`}
                  aria-hidden="true"
                />

                {/* Título do Terminal */}
                <span className="text-[12px] font-medium tracking-tight truncate">
                  {panel.title}
                </span>

                {/* Badge do Agente */}
                {panel.agentId && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 font-mono shrink-0">
                    {panel.agentId}
                  </span>
                )}
              </div>

              {/* Ações do Cabeçalho */}
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                {/* Botão de Maximizar / Restaurar (alvo tátil >= 44x44px) */}
                <button
                  type="button"
                  onClick={() => toggleMaximizePanel(panel.id)}
                  title={
                    isThisMaximized
                      ? 'Restaurar tamanho (⌘↵)'
                      : 'Maximizar painel (⌘↵)'
                  }
                  aria-label={
                    isThisMaximized
                      ? 'Restaurar tamanho do painel'
                      : 'Maximizar painel'
                  }
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/60 hover:text-white rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
                >
                  {isThisMaximized ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 9L4 4m0 0h4m-4 0v4m6 6l5 5m0 0h-4m4 0v-4M9 15l-5 5m0 0h4m-4 0v-4m11-6l5-5m0 0h-4m4 0v4"
                      />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                  )}
                </button>

                {/* Botão de Fechar Painel (alvo tátil >= 44x44px) */}
                <button
                  type="button"
                  onClick={() => removePanel(panel.id)}
                  title="Fechar painel"
                  aria-label="Fechar painel"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/60 hover:text-red-400 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Contentor do Terminal Vivo (@xterm) */}
            <div className="flex-1 min-h-0 w-full relative">
              <XTermWrapper
                sessionId={panel.sessionId}
                className="w-full h-full rounded-none border-0"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TiledTerminalGrid;
