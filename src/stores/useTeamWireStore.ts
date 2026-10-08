import { useSyncExternalStore } from 'react';
import type { A2AMessageType } from '../types/a2a';
import { terminalService } from '../services/terminalService';
import { a2aStore } from './useA2AStore';
import { gridLayoutStore } from './useGridLayoutStore';

export interface DispatchResult {
  success: boolean;
  recipientCount: number;
  message: string;
}

export interface TeamWireStoreState {
  isBroadcastMode: boolean;
  selectedRecipientId: string;
  selectedMessageType: A2AMessageType;
  draftPrompt: string;
  isDispatching: boolean;
  lastDispatchedTimestamp: number | null;
  lastDispatchResult: DispatchResult | null;
}

let state: TeamWireStoreState = {
  isBroadcastMode: false,
  selectedRecipientId: 'orchestrator',
  selectedMessageType: 'task',
  draftPrompt: '',
  isDispatching: false,
  lastDispatchedTimestamp: null,
  lastDispatchResult: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const teamWireStore = {
  getState(): TeamWireStoreState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setBroadcastMode(enabled: boolean): void {
    if (state.isBroadcastMode === enabled) return;
    state = {
      ...state,
      isBroadcastMode: enabled,
    };
    emitChange();
  },

  toggleBroadcastMode(): void {
    state = {
      ...state,
      isBroadcastMode: !state.isBroadcastMode,
    };
    emitChange();
  },

  setSelectedRecipientId(id: string): void {
    if (state.selectedRecipientId === id) return;
    state = {
      ...state,
      selectedRecipientId: id,
    };
    emitChange();
  },

  setSelectedMessageType(type: A2AMessageType): void {
    if (state.selectedMessageType === type) return;
    state = {
      ...state,
      selectedMessageType: type,
    };
    emitChange();
  },

  setDraftPrompt(prompt: string): void {
    state = {
      ...state,
      draftPrompt: prompt,
    };
    emitChange();
  },

  resetDispatchResult(): void {
    if (!state.lastDispatchResult) return;
    state = {
      ...state,
      lastDispatchResult: null,
    };
    emitChange();
  },

  async dispatchPrompt(overrideContent?: string): Promise<DispatchResult> {
    const rawContent = overrideContent !== undefined ? overrideContent : state.draftPrompt;
    const content = rawContent.trim();

    if (!content) {
      return {
        success: false,
        recipientCount: 0,
        message: 'Prompt vazio',
      };
    }

    state = {
      ...state,
      isDispatching: true,
    };
    emitChange();

    try {
      const gridPanels = gridLayoutStore.getState().panels;
      const peers = a2aStore.getState().peers;

      if (state.isBroadcastMode) {
        // ── Modo Broadcast Ativo: Despacha para TODAS as sessões PTY ativas ──
        const activePanels = gridPanels.filter((p) => Boolean(p.sessionId));

        const ptyWrites = activePanels.map((p) =>
          terminalService.writePty(p.sessionId, `${content}\r\n`).catch((err) => {
            console.warn(`[TeamWire] Falha ao despachar PTY para painel ${p.id} (${p.sessionId}):`, err);
          })
        );
        await Promise.allSettled(ptyWrites);

        // Registo de mensagem de broadcast A2A estruturada
        a2aStore.sendMessage({
          senderId: 'user',
          senderName: 'Utilizador (Orquestrador)',
          recipientId: 'all',
          recipientName: 'Todos os Agentes (Broadcast Global)',
          content,
          messageType: 'broadcast',
          senderRole: 'user',
          metadata: {
            isBroadcast: true,
            broadcastTerminalCount: activePanels.length,
          },
        });

        const result: DispatchResult = {
          success: true,
          recipientCount: activePanels.length,
          message: `Transmitido para ${activePanels.length} terminal(is) ativo(s)`,
        };

        state = {
          ...state,
          draftPrompt: '',
          isDispatching: false,
          lastDispatchedTimestamp: Date.now(),
          lastDispatchResult: result,
        };
        emitChange();
        return result;
      } else {
        // ── Modo Unicast / Orquestrador: Despacha para agente/painel selecionado ──
        const targetId = state.selectedRecipientId || 'orchestrator';
        const activePanelId = gridLayoutStore.getState().activePanelId;

        // Resolução do painel alvo para envio PTY
        let targetPanel = gridPanels.find((p) => p.agentId === targetId || p.id === targetId);

        // Se o alvo for 'orchestrator' e não tiver painel com id 'orchestrator', procurar papel architect
        if (!targetPanel && targetId === 'orchestrator') {
          targetPanel = gridPanels.find(
            (p) => p.agentRole === 'architect' || p.title.toLowerCase().includes('orchestrat')
          );
        }

        // Se ainda não encontrou e houver painel ativo selecionado na grelha, usar como fallback
        if (!targetPanel && activePanelId) {
          targetPanel = gridPanels.find((p) => p.id === activePanelId);
        }

        // Resolução do peer A2A
        const targetPeer =
          peers.find((p) => p.id === targetId) ||
          (targetPanel ? peers.find((p) => p.id === targetPanel.agentId || p.id === targetPanel.id) : undefined);

        const recipientName =
          targetPeer?.name ||
          (targetId === 'orchestrator' ? 'Principal Architect (Orquestrador)' : targetPanel?.title ?? targetId);
        const recipientId = targetPeer?.id || targetPanel?.agentId || targetPanel?.id || targetId;

        // Despacha PTY para o terminal alvo se tiver sessão ativa
        if (targetPanel?.sessionId) {
          await terminalService.writePty(targetPanel.sessionId, `${content}\r\n`).catch((err) => {
            console.warn(`[TeamWire] Falha ao despachar PTY para ${targetPanel?.id}:`, err);
          });
        }

        // Envia mensagem direta A2A estruturada
        a2aStore.sendMessage({
          senderId: 'user',
          senderName: 'Utilizador (Orquestrador)',
          recipientId,
          recipientName,
          content,
          messageType: state.selectedMessageType,
          senderRole: 'user',
          metadata: {
            sessionId: targetPanel?.sessionId,
            panelId: targetPanel?.id,
          },
        });

        const result: DispatchResult = {
          success: true,
          recipientCount: targetPanel ? 1 : 0,
          message: `Enviado para ${recipientName}`,
        };

        state = {
          ...state,
          draftPrompt: '',
          isDispatching: false,
          lastDispatchedTimestamp: Date.now(),
          lastDispatchResult: result,
        };
        emitChange();
        return result;
      }
    } catch (error) {
      console.error('[TeamWire] Erro ao despachar prompt:', error);
      const result: DispatchResult = {
        success: false,
        recipientCount: 0,
        message: 'Erro ao despachar comando',
      };
      state = {
        ...state,
        isDispatching: false,
        lastDispatchResult: result,
      };
      emitChange();
      return result;
    }
  },
};

export function useTeamWireStore() {
  const storeState = useSyncExternalStore(teamWireStore.subscribe, teamWireStore.getState);

  return {
    ...storeState,
    setBroadcastMode: teamWireStore.setBroadcastMode,
    toggleBroadcastMode: teamWireStore.toggleBroadcastMode,
    setSelectedRecipientId: teamWireStore.setSelectedRecipientId,
    setSelectedMessageType: teamWireStore.setSelectedMessageType,
    setDraftPrompt: teamWireStore.setDraftPrompt,
    resetDispatchResult: teamWireStore.resetDispatchResult,
    dispatchPrompt: teamWireStore.dispatchPrompt,
  };
}
