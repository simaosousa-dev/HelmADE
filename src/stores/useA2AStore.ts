import { useSyncExternalStore } from 'react';
import type { A2AMessage, A2APeer } from '../types/a2a';
import { terminalService } from '../services/terminalService';

export interface A2AFilter {
  senderId?: string;
  recipientId?: string;
  peerId?: string; // mensagens onde peerId é remetente OU destinatário
  searchQuery?: string;
}

export interface A2AStoreState {
  messages: A2AMessage[];
  peers: A2APeer[];
  activeFilter: A2AFilter;
  isWireOpen: boolean;
  isMirroringEnabled: boolean;
  highlightedMessageId: string | null;
  activeExchangeAgentIds: Set<string>; // agentes com atividade A2A recente
}

let state: A2AStoreState = {
  messages: [],
  peers: [],
  activeFilter: {},
  isWireOpen: false,
  isMirroringEnabled: true,
  highlightedMessageId: null,
  activeExchangeAgentIds: new Set(),
};

const listeners = new Set<() => void>();
const activityTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Formata e espelha visualmente a mensagem no PTY do terminal com identificadores e cores ANSI
 * conforme requisitos R5.2 do HelmADE:
 * - Emissor: ➔ [DESTINATÁRIO]: conteúdo
 * - Receptor: 🠔 [REMETENTE]: conteúdo
 */
async function mirrorMessageToTerminals(msg: A2AMessage, peers: A2APeer[]) {
  // Cores ANSI compatíveis com macOS / San Francisco Mono
  const ANSI_RESET = '\x1b[0m';
  const ANSI_CYAN = '\x1b[36m';
  const ANSI_PURPLE = '\x1b[35m';
  const ANSI_YELLOW = '\x1b[33m';
  const ANSI_DIM = '\x1b[2m';
  const ANSI_BOLD = '\x1b[1m';

  const senderPeer = peers.find((p) => p.id === msg.senderId);

  // 1. Espelhar no terminal do Remetente (Saída: ➔ [DESTINATÁRIO]: ...)
  if (senderPeer?.sessionId) {
    const targetTag = msg.recipientId === 'all' ? 'BROADCAST' : msg.recipientName;
    const outgoingLog = `\r\n${ANSI_PURPLE}${ANSI_BOLD}➔ [${targetTag}]${ANSI_RESET} ${ANSI_DIM}(A2A ${msg.messageType}):${ANSI_RESET} ${msg.content}\r\n`;
    terminalService.writePty(senderPeer.sessionId, outgoingLog).catch(() => {});
  }

  // 2. Espelhar no(s) terminal(is) do(s) Destinatário(s) (Entrada: 🠔 [REMETENTE]: ...)
  const recipientsToMirror = msg.recipientId === 'all'
    ? peers.filter((p) => p.id !== msg.senderId)
    : peers.filter((p) => p.id === msg.recipientId);

  for (const recipient of recipientsToMirror) {
    if (recipient.sessionId) {
      const incomingLog = `\r\n${ANSI_CYAN}${ANSI_BOLD}🠔 [${msg.senderName}]${ANSI_RESET} ${ANSI_YELLOW}${ANSI_DIM}(A2A ${msg.messageType}):${ANSI_RESET} ${msg.content}\r\n`;
      terminalService.writePty(recipient.sessionId, incomingLog).catch(() => {});
    }
  }
}

function triggerPeerActivity(agentId: string) {
  if (!agentId || agentId === 'all') return;
  const existingTimer = activityTimers.get(agentId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const nextActive = new Set(state.activeExchangeAgentIds);
  nextActive.add(agentId);
  state = {
    ...state,
    activeExchangeAgentIds: nextActive,
  };
  emitChange();

  const timer = setTimeout(() => {
    const updated = new Set(state.activeExchangeAgentIds);
    updated.delete(agentId);
    state = {
      ...state,
      activeExchangeAgentIds: updated,
    };
    activityTimers.delete(agentId);
    emitChange();
  }, 3500);

  activityTimers.set(agentId, timer);
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

  setPeers(peers: A2APeer[]): void {
    state = {
      ...state,
      peers,
    };
    emitChange();
  },

  toggleWire(isOpen?: boolean): void {
    state = {
      ...state,
      isWireOpen: isOpen !== undefined ? isOpen : !state.isWireOpen,
    };
    emitChange();
  },

  setMirroringEnabled(enabled: boolean): void {
    state = {
      ...state,
      isMirroringEnabled: enabled,
    };
    emitChange();
  },

  setFilter(filter: A2AFilter): void {
    state = {
      ...state,
      activeFilter: filter,
    };
    emitChange();
  },

  setHighlightedMessage(id: string | null): void {
    state = {
      ...state,
      highlightedMessageId: id,
    };
    emitChange();
  },

  sendMessage(
    params: Omit<A2AMessage, 'id' | 'timestamp' | 'mirroredToPty'>
  ): A2AMessage {
    const newMessage: A2AMessage = {
      ...params,
      id: `a2a_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      mirroredToPty: state.isMirroringEnabled,
    };

    state = {
      ...state,
      messages: [...state.messages, newMessage],
    };
    emitChange();

    // Ativar pulsação de atividade visual para os agentes envolvidos
    triggerPeerActivity(newMessage.senderId);
    if (newMessage.recipientId !== 'all') {
      triggerPeerActivity(newMessage.recipientId);
    } else {
      for (const p of state.peers) {
        if (p.id !== newMessage.senderId) {
          triggerPeerActivity(p.id);
        }
      }
    }

    // Espelhar nos terminais XTerm se ativado
    if (state.isMirroringEnabled) {
      mirrorMessageToTerminals(newMessage, state.peers).catch((err) => {
        console.warn('[a2aStore] Erro ao espelhar mensagem nos terminais:', err);
      });
    }

    return newMessage;
  },

  clearMessages(): void {
    state = {
      ...state,
      messages: [],
      highlightedMessageId: null,
    };
    emitChange();
  },
};

export function useA2AStore() {
  const storeState = useSyncExternalStore(a2aStore.subscribe, a2aStore.getState);

  return {
    ...storeState,
    setPeers: a2aStore.setPeers,
    toggleWire: a2aStore.toggleWire,
    setMirroringEnabled: a2aStore.setMirroringEnabled,
    setFilter: a2aStore.setFilter,
    setHighlightedMessage: a2aStore.setHighlightedMessage,
    sendMessage: a2aStore.sendMessage,
    clearMessages: a2aStore.clearMessages,
  };
}
