import {
  getAllModels,
  getModelsByProfile,
  getModelById,
  getDefaultModelForRole,
  getCognitiveProfiles,
} from './modelCatalog';
import { agentConfigStore } from '../stores/useAgentConfigStore';

/**
 * Verificação e asserções executáveis de integridade do Catálogo de Modelos e Store
 * em conformidade com o princípio Ponytail (Safety Invariant #4: Runnable Check).
 */
export function verifyModelCatalogAndConfigIntegrity(): boolean {
  // 1. Verificação do número total de modelos registados
  const models = getAllModels();
  if (models.length < 14) {
    throw new Error(`Catalog expected at least 14 models, found ${models.length}`);
  }

  // 2. Verificação de perfis cognitivos
  const profiles = getCognitiveProfiles();
  if (profiles.length !== 4) {
    throw new Error(`Expected 4 cognitive profiles, found ${profiles.length}`);
  }

  const deepThinking = getModelsByProfile('deep-thinking');
  if (deepThinking.length !== 4) {
    throw new Error(`Expected 4 deep-thinking models, found ${deepThinking.length}`);
  }

  const fastEconomic = getModelsByProfile('fast-economic');
  if (fastEconomic.length !== 3) {
    throw new Error(`Expected 3 fast-economic models, found ${fastEconomic.length}`);
  }

  const researchContext = getModelsByProfile('research-context');
  if (researchContext.length !== 2) {
    throw new Error(`Expected 2 research-context models, found ${researchContext.length}`);
  }

  const localZeroCost = getModelsByProfile('local-zero-cost');
  if (localZeroCost.length !== 5) {
    throw new Error(`Expected 5 local-zero-cost models, found ${localZeroCost.length}`);
  }

  // 3. Verificação de resolução de papéis recomendados
  const archModel = getDefaultModelForRole('architect');
  if (archModel.id !== 'claude-3-7-sonnet-thinking') {
    throw new Error(`Architect expected claude-3-7-sonnet-thinking, got ${archModel.id}`);
  }

  const qaModel = getDefaultModelForRole('qa-security');
  if (qaModel.id !== 'deepseek-r1') {
    throw new Error(`QA expected deepseek-r1, got ${qaModel.id}`);
  }

  const devopsModel = getDefaultModelForRole('devops');
  if (devopsModel.id !== 'claude-3-5-haiku') {
    throw new Error(`DevOps expected claude-3-5-haiku, got ${devopsModel.id}`);
  }

  // 4. Verificação de modelos locais Ollama
  const ollamaLlama = getModelById('ollama/llama3.3');
  if (!ollamaLlama || !ollamaLlama.isLocal || ollamaLlama.provider !== 'ollama') {
    throw new Error('ollama/llama3.3 must be local and provider ollama');
  }

  // 5. Verificação da hierarquia do agentConfigStore
  agentConfigStore.resetToDefaults();
  const defaultResolved = agentConfigStore.resolveModelForPanel('p1', 'qa-security-auditor', 'qa-security');
  if (defaultResolved.id !== 'deepseek-r1') {
    throw new Error(`Default store resolution failed, got ${defaultResolved.id}`);
  }

  // Sobreposição por agente
  agentConfigStore.setModelForAgent('qa-security-auditor', 'o3-mini');
  const agentOverride = agentConfigStore.resolveModelForPanel('p1', 'qa-security-auditor', 'qa-security');
  if (agentOverride.id !== 'o3-mini') {
    throw new Error(`Agent override resolution failed, got ${agentOverride.id}`);
  }

  // Sobreposição por painel tem prioridade máxima
  agentConfigStore.setModelForPanel('p1', 'gemini-2.0-flash-thinking');
  const panelOverride = agentConfigStore.resolveModelForPanel('p1', 'qa-security-auditor', 'qa-security');
  if (panelOverride.id !== 'gemini-2.0-flash-thinking') {
    throw new Error(`Panel override resolution failed, got ${panelOverride.id}`);
  }

  // Reposição limpa
  agentConfigStore.resetToDefaults();
  const restored = agentConfigStore.resolveModelForPanel('p1', 'qa-security-auditor', 'qa-security');
  if (restored.id !== 'deepseek-r1') {
    throw new Error(`Restoration to defaults failed, got ${restored.id}`);
  }

  return true;
}
