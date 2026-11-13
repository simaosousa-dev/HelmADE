import { useSyncExternalStore } from 'react';
import type { AgentCliId } from '../config/agentClis';
import type { GridLayoutType, PanelKind } from '../types/swarm';
import type { AgentRoleType, TerminalPanelColor, TerminalStatus } from '../types/terminal';
import { swarmStore, type SwarmStoreState } from './useSwarmStore';

export type { GridLayoutType };

/** A panel as the grid renders it: the persisted swarm panel plus its runtime status. */
export interface GridPanelConfig {
  /** PTY session id (globally unique). */
  id: string;
  sessionId: string;
  /** Panel key inside the swarm, used for A2A addressing. */
  key: string;
  title: string;
  agentId: string;
  agentRole: AgentRoleType;
  color: TerminalPanelColor;
  status: TerminalStatus;
  modelId: string;
  kind: PanelKind;
  cli: AgentCliId | null;
  branch: string;
  port: number;
}

export interface GridLayoutState {
  swarmId: string | null;
  layout: GridLayoutType;
  panels: GridPanelConfig[];
  activePanelId: string | null;
  maximizedPanelId: string | null;
}

export function getLayoutDimensions(layout: GridLayoutType): {
  cols: number;
  rows: number;
  maxPanels: number;
} {
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
  }
}

const EMPTY: GridLayoutState = {
  swarmId: null,
  layout: '2x2',
  panels: [],
  activePanelId: null,
  maximizedPanelId: null,
};

function derive(source: SwarmStoreState): GridLayoutState {
  const swarm = source.swarms.find((s) => s.id === source.activeSwarmId);
  if (!swarm) return EMPTY;
  const ui = source.ui[swarm.id];
  return {
    swarmId: swarm.id,
    layout: swarm.layout,
    panels: swarm.panels.map((panel) => ({
      id: panel.worktreeId,
      sessionId: panel.worktreeId,
      key: panel.key,
      title: panel.title,
      agentId: panel.agentId,
      agentRole: panel.role,
      color: panel.color,
      status: source.statuses[panel.worktreeId] ?? 'idle',
      modelId: panel.modelId,
      kind: panel.kind,
      cli: panel.cli,
      branch: panel.branch,
      port: panel.port,
    })),
    activePanelId: ui?.activePanelId ?? null,
    maximizedPanelId: ui?.maximizedPanelId ?? null,
  };
}

// The grid is a pure view of the active swarm; the snapshot is cached per source state
// so `useSyncExternalStore` sees a stable reference.
let cachedSource: SwarmStoreState | null = null;
let cachedView: GridLayoutState = EMPTY;

function withActiveSwarm(action: (swarmId: string) => void): void {
  const swarmId = swarmStore.getState().activeSwarmId;
  if (swarmId) action(swarmId);
}

export const gridLayoutStore = {
  getState(): GridLayoutState {
    const source = swarmStore.getState();
    if (source !== cachedSource) {
      cachedSource = source;
      cachedView = derive(source);
    }
    return cachedView;
  },

  subscribe: swarmStore.subscribe,

  setLayout(layout: GridLayoutType): void {
    withActiveSwarm((swarmId) => swarmStore.setLayout(swarmId, layout));
  },

  setActivePanelId(id: string | null): void {
    withActiveSwarm((swarmId) => swarmStore.setActivePanel(swarmId, id));
  },

  toggleMaximizePanel(id: string): void {
    withActiveSwarm((swarmId) => swarmStore.toggleMaximize(swarmId, id));
  },

  updatePanelTitle(id: string, title: string): void {
    withActiveSwarm((swarmId) => swarmStore.updatePanel(swarmId, id, { title }));
  },

  updatePanelColor(id: string, color: TerminalPanelColor): void {
    withActiveSwarm((swarmId) => swarmStore.updatePanel(swarmId, id, { color }));
  },

  updatePanelModel(id: string, modelId: string): void {
    withActiveSwarm((swarmId) => swarmStore.updatePanel(swarmId, id, { modelId }));
  },

  updatePanelStatus(id: string, status: TerminalStatus): void {
    swarmStore.setPanelStatus(id, status);
  },

  cycleNextPanel(): void {
    swarmStore.cyclePanel(1);
  },

  cyclePrevPanel(): void {
    swarmStore.cyclePanel(-1);
  },
};

export function useGridLayoutStore() {
  const view = useSyncExternalStore(gridLayoutStore.subscribe, gridLayoutStore.getState);
  return {
    ...view,
    setLayout: gridLayoutStore.setLayout,
    setActivePanelId: gridLayoutStore.setActivePanelId,
    toggleMaximizePanel: gridLayoutStore.toggleMaximizePanel,
    updatePanelTitle: gridLayoutStore.updatePanelTitle,
    updatePanelColor: gridLayoutStore.updatePanelColor,
    updatePanelModel: gridLayoutStore.updatePanelModel,
    updatePanelStatus: gridLayoutStore.updatePanelStatus,
    cycleNextPanel: gridLayoutStore.cycleNextPanel,
    cyclePrevPanel: gridLayoutStore.cyclePrevPanel,
  };
}
