import React, { useEffect, useState, useRef } from 'react';
import { XTermWrapper, TerminalHeader } from '../terminal';
import {
  useGridLayoutStore,
  gridLayoutStore,
  getLayoutDimensions,
  type GridLayoutType,
} from '../../stores/useGridLayoutStore';
import { useA2AStore } from '../../stores/useA2AStore';
import type { TerminalPanelColor } from '../../types/terminal';

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

const PANEL_ACTIVE_BORDER_CLASSES: Record<TerminalPanelColor, string> = {
  gold: 'border-amber-400/70 ring-1 ring-amber-400/40',
  blue: 'border-blue-500/70 ring-1 ring-blue-500/40',
  green: 'border-emerald-400/70 ring-1 ring-emerald-400/40',
  purple: 'border-purple-400/70 ring-1 ring-purple-400/40',
  red: 'border-red-400/70 ring-1 ring-red-400/40',
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
    updatePanelTitle,
    updatePanelColor,
    updatePanelStatus,
    updatePanelModel,
  } = useGridLayoutStore();
  const { activeExchangeAgentIds } = useA2AStore();

  const [highlightedPanelId, setHighlightedPanelId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMaximized = maximizedPanelId !== null && panels.some((p) => p.id === maximizedPanelId);
  const { maxPanels } = getLayoutDimensions(layout);

  // Redimensionamento automático do PTY em transições de layout
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
    return () => clearTimeout(timer);
  }, [layout, maximizedPanelId]);

  // Escuta de eventos para destacar e focar painel emitidos pelo TeamWire
  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const customEvent = e as CustomEvent<{ panelId?: string }>;
      const panelId = customEvent.detail?.panelId;
      if (!panelId) return;

      const currentPanels = gridLayoutStore.getState().panels;
      const found = currentPanels.find(
        (p) => p.agentId === panelId || p.id === panelId
      );

      if (found) {
        setActivePanelId(found.id);
        setHighlightedPanelId(found.id);

        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedPanelId(null);
          highlightTimeoutRef.current = null;
        }, 1500);
      }
    };

    window.addEventListener('helmade:highlightPanel', handleHighlight);
    return () => {
      window.removeEventListener('helmade:highlightPanel', handleHighlight);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [setActivePanelId]);

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
        const isHighlighted = panel.id === highlightedPanelId;
        const isA2AActive =
          (panel.agentId && activeExchangeAgentIds.has(panel.agentId)) ||
          activeExchangeAgentIds.has(panel.id);
        const panelColor = panel.color ?? 'blue';
        const activeBorderClass = PANEL_ACTIVE_BORDER_CLASSES[panelColor] ?? PANEL_ACTIVE_BORDER_CLASSES.blue;

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
              isHighlighted
                ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.35)] duration-300 border-cyan-400/80 z-10'
                : isActive
                ? activeBorderClass
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            {/* Cabeçalho Semântico do Painel Apple HIG */}
            <TerminalHeader
              id={panel.id}
              sessionId={panel.sessionId}
              title={panel.title}
              agentId={panel.agentId}
              agentRole={panel.agentRole}
              color={panel.color}
              status={panel.status}
              modelId={panel.modelId}
              onModelChange={(newModelId) => updatePanelModel(panel.id, newModelId)}
              isA2AActive={isA2AActive}
              isActive={isActive}
              isMaximized={isThisMaximized}
              onTitleChange={(newTitle) => updatePanelTitle(panel.id, newTitle)}
              onColorChange={(newColor) => updatePanelColor(panel.id, newColor)}
              onStatusChange={(newStatus) => updatePanelStatus(panel.id, newStatus)}
              onToggleMaximize={() => toggleMaximizePanel(panel.id)}
              onClose={() => removePanel(panel.id)}
            />

            {/* Contentor do Terminal Vivo (@xterm) com Preservação de DOM */}
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
