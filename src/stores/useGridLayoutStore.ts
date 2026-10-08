import { useSyncExternalStore } from 'react';
import type { TerminalPanelColor, TerminalStatus, AgentRoleType } from '../types/terminal';

export type GridLayoutType = '1x1' | '1x2' | '2x2' | '2x3' | '3x3' | '4x4';

export interface GridPanelConfig {
  id: string;
  sessionId: string;
  title: string;
  agentId?: string;
  agentRole?: AgentRoleType | string;
  color?: TerminalPanelColor;
  status?: TerminalStatus;
  modelId?: string;
}

export interface GridLayoutState {
  layout: GridLayoutType;
  panels: GridPanelConfig[];
  activePanelId: string | null;
  maximizedPanelId: string | null;
}

/**
 * Retorna as dimensões (colunas, linhas e capacidade máxima de painéis) para um dado layout.
 */
export function getLayoutDimensions(layout: GridLayoutType): { cols: number; rows: number; maxPanels: number } {
  switch (layout) {
    case '1x1':
      return { cols: 1, rows: 1, maxPanels: 1 };
    case '1x2':
      return { cols: 2, rows: 1, maxPanels: 2 };
    case '2x2':
      return { cols: 2, rows: 2, maxPanels: 4 };
    case '2x3':
      return { cols: 3, rows: 2, maxPanels: 6 };
    case '3x3':
      return { cols: 3, rows: 3, maxPanels: 9 };
    case '4x4':
      return { cols: 4, rows: 4, maxPanels: 16 };
    default:
      return { cols: 2, rows: 2, maxPanels: 4 };
  }
}

let state: GridLayoutState = {
  layout: '2x2',
  panels: [],
  activePanelId: null,
  maximizedPanelId: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const gridLayoutStore = {
  getState(): GridLayoutState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setLayout(layout: GridLayoutType): void {
    if (state.layout === layout) return;
    state = {
      ...state,
      layout,
    };
    emitChange();
  },

  setActivePanelId(id: string | null): void {
    if (state.activePanelId === id) return;
    state = {
      ...state,
      activePanelId: id,
    };
    emitChange();
  },

  toggleMaximizePanel(id: string): void {
    const isCurrentlyMaximized = state.maximizedPanelId === id;
    state = {
      ...state,
      maximizedPanelId: isCurrentlyMaximized ? null : id,
      activePanelId: id,
    };
    emitChange();
  },

  addPanel(panel: GridPanelConfig): void {
    if (state.panels.some((p) => p.id === panel.id)) return;
    const newPanels = [...state.panels, panel];
    state = {
      ...state,
      panels: newPanels,
      activePanelId: state.activePanelId ?? panel.id,
    };
    emitChange();
  },

  removePanel(id: string): void {
    const panelIndex = state.panels.findIndex((p) => p.id === id);
    if (panelIndex === -1) return;

    const newPanels = state.panels.filter((p) => p.id !== id);
    let newActiveId = state.activePanelId;

    if (state.activePanelId === id) {
      if (newPanels.length === 0) {
        newActiveId = null;
      } else {
        const nextIndex = Math.min(panelIndex, newPanels.length - 1);
        newActiveId = newPanels[nextIndex].id;
      }
    }

    state = {
      ...state,
      panels: newPanels,
      activePanelId: newActiveId,
      maximizedPanelId: state.maximizedPanelId === id ? null : state.maximizedPanelId,
    };
    emitChange();
  },

  updatePanelTitle(id: string, title: string): void {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel || panel.title === title) return;
    state = {
      ...state,
      panels: state.panels.map((p) => (p.id === id ? { ...p, title } : p)),
    };
    emitChange();
  },

  updatePanelColor(id: string, color: TerminalPanelColor): void {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel || panel.color === color) return;
    state = {
      ...state,
      panels: state.panels.map((p) => (p.id === id ? { ...p, color } : p)),
    };
    emitChange();
  },

  updatePanelStatus(id: string, status: TerminalStatus): void {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel || panel.status === status) return;
    state = {
      ...state,
      panels: state.panels.map((p) => (p.id === id ? { ...p, status } : p)),
    };
    emitChange();
  },

  updatePanelModel(id: string, modelId: string): void {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel || panel.modelId === modelId) return;
    state = {
      ...state,
      panels: state.panels.map((p) => (p.id === id ? { ...p, modelId } : p)),
    };
    emitChange();
  },

  updatePanel(id: string, updates: Partial<GridPanelConfig>): void {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel) return;
    state = {
      ...state,
      panels: state.panels.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    };
    emitChange();
  },

  setPanels(panels: GridPanelConfig[]): void {
    const activeExists = state.activePanelId ? panels.some((p) => p.id === state.activePanelId) : false;
    const maxExists = state.maximizedPanelId ? panels.some((p) => p.id === state.maximizedPanelId) : false;

    state = {
      ...state,
      panels,
      activePanelId: activeExists ? state.activePanelId : (panels.length > 0 ? panels[0].id : null),
      maximizedPanelId: maxExists ? state.maximizedPanelId : null,
    };
    emitChange();
  },

  cycleNextPanel(): void {
    if (state.panels.length <= 1) return;
    const currentIndex = state.panels.findIndex((p) => p.id === state.activePanelId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.panels.length;
    const nextId = state.panels[nextIndex].id;

    state = {
      ...state,
      activePanelId: nextId,
      maximizedPanelId: state.maximizedPanelId ? nextId : null,
    };
    emitChange();
  },

  cyclePrevPanel(): void {
    if (state.panels.length <= 1) return;
    const currentIndex = state.panels.findIndex((p) => p.id === state.activePanelId);
    const prevIndex = currentIndex === -1 ? state.panels.length - 1 : (currentIndex - 1 + state.panels.length) % state.panels.length;
    const prevId = state.panels[prevIndex].id;

    state = {
      ...state,
      activePanelId: prevId,
      maximizedPanelId: state.maximizedPanelId ? prevId : null,
    };
    emitChange();
  },

  clearPanels(): void {
    state = {
      ...state,
      panels: [],
      activePanelId: null,
      maximizedPanelId: null,
    };
    emitChange();
  },
};

export function useGridLayoutStore() {
  const storeState = useSyncExternalStore(gridLayoutStore.subscribe, gridLayoutStore.getState);

  return {
    ...storeState,
    setLayout: gridLayoutStore.setLayout,
    setActivePanelId: gridLayoutStore.setActivePanelId,
    toggleMaximizePanel: gridLayoutStore.toggleMaximizePanel,
    addPanel: gridLayoutStore.addPanel,
    removePanel: gridLayoutStore.removePanel,
    updatePanelTitle: gridLayoutStore.updatePanelTitle,
    updatePanelColor: gridLayoutStore.updatePanelColor,
    updatePanelStatus: gridLayoutStore.updatePanelStatus,
    updatePanelModel: gridLayoutStore.updatePanelModel,
    updatePanel: gridLayoutStore.updatePanel,
    setPanels: gridLayoutStore.setPanels,
    cycleNextPanel: gridLayoutStore.cycleNextPanel,
    cyclePrevPanel: gridLayoutStore.cyclePrevPanel,
    clearPanels: gridLayoutStore.clearPanels,
  };
}
