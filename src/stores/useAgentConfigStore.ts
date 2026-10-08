import { useSyncExternalStore } from 'react';
import {
  type AIModelDefinition,
  getModelById,
  getDefaultModelForRole,
} from '../config/modelCatalog';
import type { AgentRoleType } from '../types/terminal';

const STORAGE_KEY = 'helmade_agent_model_configs';

export interface AgentModelConfigState {
  panelModels: Record<string, string>; // panelId -> modelId
  agentModels: Record<string, string>; // agentId -> modelId
}

function loadInitialState(): AgentModelConfigState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { panelModels: {}, agentModels: {} };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        panelModels: typeof parsed.panelModels === 'object' && parsed.panelModels !== null ? parsed.panelModels : {},
        agentModels: typeof parsed.agentModels === 'object' && parsed.agentModels !== null ? parsed.agentModels : {},
      };
    }
  } catch {
    // Falha silenciosa de parsing JSON no localStorage
  }
  return { panelModels: {}, agentModels: {} };
}

function persistState(s: AgentModelConfigState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Falha silenciosa de quota no localStorage
  }
}

let state: AgentModelConfigState = loadInitialState();
const listeners = new Set<() => void>();

function emitChange() {
  persistState(state);
  for (const listener of listeners) {
    listener();
  }
}

export const agentConfigStore = {
  getState(): AgentModelConfigState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Define o modelo de IA associado explicitamente a um painel de grelha.
   */
  setModelForPanel(panelId: string, modelId: string): void {
    if (state.panelModels[panelId] === modelId) return;
    state = {
      ...state,
      panelModels: {
        ...state.panelModels,
        [panelId]: modelId,
      },
    };
    emitChange();
  },

  /**
   * Obtém o modelo de IA associado explicitamente a um painel.
   */
  getModelForPanel(panelId: string): string | undefined {
    return state.panelModels[panelId];
  },

  /**
   * Remove a sobreposição de modelo de um painel específico.
   */
  clearPanelModel(panelId: string): void {
    if (!(panelId in state.panelModels)) return;
    const nextPanelModels = { ...state.panelModels };
    delete nextPanelModels[panelId];
    state = {
      ...state,
      panelModels: nextPanelModels,
    };
    emitChange();
  },

  /**
   * Define o modelo de IA associado globalmente a um tipo ou ID de agente.
   */
  setModelForAgent(agentId: string, modelId: string): void {
    if (state.agentModels[agentId] === modelId) return;
    state = {
      ...state,
      agentModels: {
        ...state.agentModels,
        [agentId]: modelId,
      },
    };
    emitChange();
  },

  /**
   * Obtém o modelo de IA associado globalmente a um agente.
   */
  getModelForAgent(agentId: string): string | undefined {
    return state.agentModels[agentId];
  },

  /**
   * Remove a sobreposição de modelo para um agente.
   */
  clearAgentModel(agentId: string): void {
    if (!(agentId in state.agentModels)) return;
    const nextAgentModels = { ...state.agentModels };
    delete nextAgentModels[agentId];
    state = {
      ...state,
      agentModels: nextAgentModels,
    };
    emitChange();
  },

  /**
   * Resolve hierarquicamente o modelo atribuído a um painel:
   * 1. Sobreposição explícita do painel
   * 2. Configuração do agente (agentId)
   * 3. Modelo padrão recomendado para o papel (role)
   */
  resolveModelForPanel(
    panelId: string,
    agentId?: string,
    role?: AgentRoleType | string,
    fallbackModelId?: string | null
  ): AIModelDefinition {
    // 1. Sobreposição do painel
    const panelModelId = state.panelModels[panelId];
    if (panelModelId) {
      const model = getModelById(panelModelId);
      if (model) return model;
    }

    // 2. Sobreposição do agente
    if (agentId) {
      const agentModelId = state.agentModels[agentId];
      if (agentModelId) {
        const model = getModelById(agentModelId);
        if (model) return model;
      }
    }

    // 3. Fallback opcional (e.g. metadata.default_model do AGENT.md)
    if (fallbackModelId) {
      const model = getModelById(fallbackModelId);
      if (model) return model;
    }

    // 4. Padrão para o papel
    return getDefaultModelForRole(role);
  },

  /**
   * Limpa todas as configurações e repõe os padrões recomendados de fábrica.
   */
  resetToDefaults(): void {
    state = {
      panelModels: {},
      agentModels: {},
    };
    emitChange();
  },
};

/**
 * Hook React reativo para aceder e manipular o estado de configurações de modelo por agente.
 */
export function useAgentConfigStore() {
  const storeState = useSyncExternalStore(agentConfigStore.subscribe, agentConfigStore.getState);

  return {
    ...storeState,
    setModelForPanel: agentConfigStore.setModelForPanel,
    getModelForPanel: agentConfigStore.getModelForPanel,
    clearPanelModel: agentConfigStore.clearPanelModel,
    setModelForAgent: agentConfigStore.setModelForAgent,
    getModelForAgent: agentConfigStore.getModelForAgent,
    clearAgentModel: agentConfigStore.clearAgentModel,
    resolveModelForPanel: agentConfigStore.resolveModelForPanel,
    resetToDefaults: agentConfigStore.resetToDefaults,
  };
}
