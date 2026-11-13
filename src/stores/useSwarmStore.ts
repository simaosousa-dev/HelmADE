import { useSyncExternalStore } from 'react';
import type { GridLayoutType, Swarm, SwarmPanel } from '../types/swarm';
import type { TerminalStatus } from '../types/terminal';

/** Per-swarm view state that is not persisted. */
export interface SwarmUiState {
  activePanelId: string | null;
  maximizedPanelId: string | null;
}

export interface SwarmStoreState {
  swarms: Swarm[];
  activeSwarmId: string | null;
  ui: Record<string, SwarmUiState>;
  /** Runtime status per PTY session id. */
  statuses: Record<string, TerminalStatus>;
  isLaunching: boolean;
  lastError: string | null;
}

export type SwarmPatch = Partial<Pick<Swarm, 'name' | 'layout' | 'position'>>;
export type PanelPatch = Partial<Pick<SwarmPanel, 'title' | 'color' | 'modelId' | 'cli' | 'port'>>;

const EMPTY_UI: SwarmUiState = { activePanelId: null, maximizedPanelId: null };

function initialState(): SwarmStoreState {
  return {
    swarms: [],
    activeSwarmId: null,
    ui: {},
    statuses: {},
    isLaunching: false,
    lastError: null,
  };
}

let state: SwarmStoreState = initialState();
const listeners = new Set<() => void>();

function setState(next: SwarmStoreState): void {
  state = next;
  for (const listener of listeners) listener();
}

function uiFor(swarm: Swarm): SwarmUiState {
  return { activePanelId: swarm.panels[0]?.worktreeId ?? null, maximizedPanelId: null };
}

function mapSwarm(id: string, update: (swarm: Swarm) => Swarm): Swarm[] {
  return state.swarms.map((swarm) => (swarm.id === id ? update(swarm) : swarm));
}

export const swarmStore = {
  getState(): SwarmStoreState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  activeSwarm(): Swarm | null {
    return state.swarms.find((swarm) => swarm.id === state.activeSwarmId) ?? null;
  },

  /** Finds the swarm and panel that own a PTY session. */
  findPanel(sessionId: string): { swarm: Swarm; panel: SwarmPanel } | null {
    for (const swarm of state.swarms) {
      const panel = swarm.panels.find((p) => p.worktreeId === sessionId);
      if (panel) return { swarm, panel };
    }
    return null;
  },

  /** Adds a swarm as the last tab and makes it the active one. */
  addSwarm(swarm: Swarm): void {
    if (state.swarms.some((existing) => existing.id === swarm.id)) return;
    setState({
      ...state,
      swarms: [...state.swarms, swarm],
      activeSwarmId: swarm.id,
      ui: { ...state.ui, [swarm.id]: uiFor(swarm) },
    });
  },

  /** Replaces every swarm (project opened / restored). */
  replaceAll(swarms: Swarm[], activeSwarmId?: string | null): void {
    const ordered = [...swarms].sort((a, b) => a.position - b.position);
    const active = ordered.find((swarm) => swarm.id === activeSwarmId) ?? ordered[0] ?? null;
    setState({
      ...initialState(),
      swarms: ordered,
      activeSwarmId: active?.id ?? null,
      ui: Object.fromEntries(ordered.map((swarm) => [swarm.id, uiFor(swarm)])),
    });
  },

  removeSwarm(id: string): void {
    const index = state.swarms.findIndex((swarm) => swarm.id === id);
    if (index === -1) return;
    const removed = state.swarms[index];
    const swarms = state.swarms.filter((swarm) => swarm.id !== id);
    const neighbour = swarms[Math.min(index, swarms.length - 1)] ?? null;
    const ui = { ...state.ui };
    delete ui[id];
    const statuses = { ...state.statuses };
    for (const panel of removed.panels) delete statuses[panel.worktreeId];
    setState({
      ...state,
      swarms,
      ui,
      statuses,
      activeSwarmId: state.activeSwarmId === id ? (neighbour?.id ?? null) : state.activeSwarmId,
    });
  },

  setActiveSwarm(id: string): void {
    if (state.activeSwarmId === id || !state.swarms.some((swarm) => swarm.id === id)) return;
    setState({ ...state, activeSwarmId: id });
  },

  /** Moves to the next (+1) or previous (-1) tab, wrapping around. */
  cycleSwarm(delta: 1 | -1): void {
    if (state.swarms.length < 2) return;
    const index = state.swarms.findIndex((swarm) => swarm.id === state.activeSwarmId);
    const next = (index + delta + state.swarms.length) % state.swarms.length;
    setState({ ...state, activeSwarmId: state.swarms[next].id });
  },

  updateSwarm(id: string, patch: SwarmPatch): void {
    setState({ ...state, swarms: mapSwarm(id, (swarm) => ({ ...swarm, ...patch })) });
  },

  setLayout(id: string, layout: GridLayoutType): void {
    swarmStore.updateSwarm(id, { layout });
  },

  updatePanel(swarmId: string, sessionId: string, patch: PanelPatch): void {
    setState({
      ...state,
      swarms: mapSwarm(swarmId, (swarm) => ({
        ...swarm,
        panels: swarm.panels.map((panel) =>
          panel.worktreeId === sessionId ? { ...panel, ...patch } : panel
        ),
      })),
    });
  },

  removePanel(swarmId: string, sessionId: string): void {
    const swarm = state.swarms.find((s) => s.id === swarmId);
    const index = swarm?.panels.findIndex((panel) => panel.worktreeId === sessionId) ?? -1;
    if (!swarm || index === -1) return;
    const panels = swarm.panels.filter((panel) => panel.worktreeId !== sessionId);
    const current = state.ui[swarmId] ?? EMPTY_UI;
    const fallback = panels[Math.min(index, panels.length - 1)]?.worktreeId ?? null;
    const statuses = { ...state.statuses };
    delete statuses[sessionId];
    setState({
      ...state,
      swarms: mapSwarm(swarmId, (s) => ({ ...s, panels })),
      statuses,
      ui: {
        ...state.ui,
        [swarmId]: {
          activePanelId: current.activePanelId === sessionId ? fallback : current.activePanelId,
          maximizedPanelId:
            current.maximizedPanelId === sessionId ? null : current.maximizedPanelId,
        },
      },
    });
  },

  setPanelStatus(sessionId: string, status: TerminalStatus): void {
    if (state.statuses[sessionId] === status) return;
    setState({ ...state, statuses: { ...state.statuses, [sessionId]: status } });
  },

  setActivePanel(swarmId: string, sessionId: string | null): void {
    const current = state.ui[swarmId] ?? EMPTY_UI;
    if (current.activePanelId === sessionId) return;
    setState({ ...state, ui: { ...state.ui, [swarmId]: { ...current, activePanelId: sessionId } } });
  },

  toggleMaximize(swarmId: string, sessionId: string): void {
    const current = state.ui[swarmId] ?? EMPTY_UI;
    setState({
      ...state,
      ui: {
        ...state.ui,
        [swarmId]: {
          activePanelId: sessionId,
          maximizedPanelId: current.maximizedPanelId === sessionId ? null : sessionId,
        },
      },
    });
  },

  /** Moves the active panel of the active swarm forwards (+1) or backwards (-1). */
  cyclePanel(delta: 1 | -1): void {
    const swarm = swarmStore.activeSwarm();
    if (!swarm || swarm.panels.length < 2) return;
    const current = state.ui[swarm.id] ?? EMPTY_UI;
    const index = swarm.panels.findIndex((panel) => panel.worktreeId === current.activePanelId);
    const next = swarm.panels[(index + delta + swarm.panels.length) % swarm.panels.length];
    setState({
      ...state,
      ui: {
        ...state.ui,
        [swarm.id]: {
          activePanelId: next.worktreeId,
          maximizedPanelId: current.maximizedPanelId ? next.worktreeId : null,
        },
      },
    });
  },

  setLaunching(isLaunching: boolean): void {
    if (state.isLaunching === isLaunching) return;
    setState({ ...state, isLaunching });
  },

  setError(lastError: string | null): void {
    if (state.lastError === lastError) return;
    setState({ ...state, lastError });
  },

  reset(): void {
    setState(initialState());
  },
};

export function useSwarmStore(): SwarmStoreState {
  return useSyncExternalStore(swarmStore.subscribe, swarmStore.getState);
}
