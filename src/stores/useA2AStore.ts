import { useMemo, useSyncExternalStore } from 'react';
import { errorMessage } from '../lib/ipc';
import { a2aService } from '../services/a2aService';
import {
  BROADCAST_RECIPIENT_ID,
  HUMAN_SENDER_ID,
  type A2AMessage,
  type A2AMessageType,
  type A2APeer,
} from '../types/a2a';
import { useGridLayoutStore } from './useGridLayoutStore';
import { swarmStore } from './useSwarmStore';

export interface A2AFilter {
  senderId?: string;
  recipientId?: string;
  /** Messages where the peer is sender or recipient. */
  peerId?: string;
  searchQuery?: string;
}

export interface A2AStoreState {
  messagesBySwarm: Record<string, A2AMessage[]>;
  activeFilter: A2AFilter;
  isWireOpen: boolean;
  highlightedMessageId: string | null;
  /** Session ids of panels with recent A2A activity (drives the pulse on the grid). */
  activeExchangeAgentIds: Set<string>;
  lastError: string | null;
}

/** How long a panel keeps pulsing after exchanging a message. */
const ACTIVITY_PULSE_MS = 3500;
const MAX_MESSAGES_PER_SWARM = 500;

let state: A2AStoreState = {
  messagesBySwarm: {},
  activeFilter: {},
  isWireOpen: false,
  highlightedMessageId: null,
  activeExchangeAgentIds: new Set(),
  lastError: null,
};

const listeners = new Set<() => void>();
const activityTimers = new Map<string, ReturnType<typeof setTimeout>>();

function setState(next: A2AStoreState): void {
  state = next;
  for (const listener of listeners) listener();
}

function pulse(sessionId: string): void {
  const existing = activityTimers.get(sessionId);
  if (existing) clearTimeout(existing);

  setState({ ...state, activeExchangeAgentIds: new Set(state.activeExchangeAgentIds).add(sessionId) });
  activityTimers.set(
    sessionId,
    setTimeout(() => {
      const remaining = new Set(state.activeExchangeAgentIds);
      remaining.delete(sessionId);
      activityTimers.delete(sessionId);
      setState({ ...state, activeExchangeAgentIds: remaining });
    }, ACTIVITY_PULSE_MS)
  );
}

/** Session ids of the panels a message touches (sender and recipients). */
function participants(message: A2AMessage): string[] {
  const swarm = swarmStore.getState().swarms.find((s) => s.id === message.swarmId);
  if (!swarm) return [];
  return swarm.panels
    .filter(
      (panel) =>
        panel.key === message.senderId ||
        panel.key === message.recipientId ||
        (message.recipientId === BROADCAST_RECIPIENT_ID && panel.key !== message.senderId)
    )
    .map((panel) => panel.worktreeId);
}

export interface SendPromptOptions {
  /** Panel key, `orchestrator` or `all`. */
  recipient: string;
  content: string;
  messageType?: A2AMessageType;
}

export const a2aStore = {
  getState(): A2AStoreState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Subscribes to messages routed by the backend (from the human or from agent CLIs). */
  async init(): Promise<() => void> {
    return a2aService.onMessage((message) => a2aStore.receive(message));
  },

  receive(message: A2AMessage): void {
    const existing = state.messagesBySwarm[message.swarmId] ?? [];
    if (existing.some((m) => m.id === message.id)) return;
    setState({
      ...state,
      messagesBySwarm: {
        ...state.messagesBySwarm,
        [message.swarmId]: [...existing, message].slice(-MAX_MESSAGES_PER_SWARM),
      },
    });
    for (const sessionId of participants(message)) pulse(sessionId);
  },

  /** Loads the persisted history of a swarm (after a restore). */
  async loadHistory(swarmId: string): Promise<void> {
    try {
      const history = await a2aService.history(swarmId);
      setState({ ...state, messagesBySwarm: { ...state.messagesBySwarm, [swarmId]: history } });
    } catch (error) {
      a2aStore.setError(errorMessage(error));
    }
  },

  /** Sends a prompt from the human to the active swarm. Rejects with the backend error. */
  async sendPrompt(options: SendPromptOptions): Promise<A2AMessage> {
    const swarmId = swarmStore.getState().activeSwarmId;
    if (!swarmId) throw new Error('Não há nenhum enxame ativo.');
    const message = await a2aService.send({
      swarmId,
      senderId: HUMAN_SENDER_ID,
      recipient: options.recipient,
      content: options.content,
      messageType: options.messageType,
    });
    a2aStore.receive(message);
    return message;
  },

  forgetSwarm(swarmId: string): void {
    if (!(swarmId in state.messagesBySwarm)) return;
    const messagesBySwarm = { ...state.messagesBySwarm };
    delete messagesBySwarm[swarmId];
    setState({ ...state, messagesBySwarm });
  },

  toggleWire(isOpen?: boolean): void {
    setState({ ...state, isWireOpen: isOpen ?? !state.isWireOpen });
  },

  setFilter(filter: A2AFilter): void {
    setState({ ...state, activeFilter: filter });
  },

  setHighlightedMessage(id: string | null): void {
    setState({ ...state, highlightedMessageId: id });
  },

  setError(lastError: string | null): void {
    setState({ ...state, lastError });
  },

  reset(): void {
    for (const timer of activityTimers.values()) clearTimeout(timer);
    activityTimers.clear();
    setState({
      messagesBySwarm: {},
      activeFilter: {},
      isWireOpen: false,
      highlightedMessageId: null,
      activeExchangeAgentIds: new Set(),
      lastError: null,
    });
  },
};

const NO_MESSAGES: A2AMessage[] = [];

/** Team Wire state scoped to the active swarm. */
export function useA2AStore() {
  const storeState = useSyncExternalStore(a2aStore.subscribe, a2aStore.getState);
  const { swarmId, panels } = useGridLayoutStore();

  const peers: A2APeer[] = useMemo(
    () =>
      panels.map((panel) => ({
        id: panel.key,
        name: panel.title,
        role: panel.agentRole,
        status: panel.status,
        sessionId: panel.sessionId,
      })),
    [panels]
  );

  return {
    ...storeState,
    messages: (swarmId && storeState.messagesBySwarm[swarmId]) || NO_MESSAGES,
    peers,
    toggleWire: a2aStore.toggleWire,
    setFilter: a2aStore.setFilter,
    setHighlightedMessage: a2aStore.setHighlightedMessage,
    sendPrompt: a2aStore.sendPrompt,
  };
}
