import { beforeEach, describe, expect, test } from 'vitest';
import { AGENT_CLIS, cliForProvider } from '../src/config/agentClis.ts';
import {
  AI_MODELS,
  ROLE_DEFAULT_MODELS,
  getCognitiveProfiles,
  getDefaultModelForRole,
  getModelById,
  getModelsByProfile,
} from '../src/config/modelCatalog.ts';
import { agentConfigStore } from '../src/stores/useAgentConfigStore.ts';

describe('model catalog', () => {
  test('ids are unique and every cognitive profile offers at least one model', () => {
    expect(new Set(AI_MODELS.map((m) => m.id)).size).toBe(AI_MODELS.length);
    for (const profile of getCognitiveProfiles()) {
      expect(getModelsByProfile(profile.id).length, profile.id).toBeGreaterThan(0);
    }
  });

  test('every model maps to an agent CLI and every role default exists', () => {
    for (const model of AI_MODELS) {
      const cli = cliForProvider(model.provider);
      expect(cli && AGENT_CLIS[cli], model.id).toBeTruthy();
    }
    for (const [role, modelId] of Object.entries(ROLE_DEFAULT_MODELS)) {
      expect(getModelById(modelId), role).toBeDefined();
    }
  });

  test('local models are free, run through Ollama and pass a model name to it', () => {
    const local = getModelsByProfile('local-zero-cost');
    for (const model of local) {
      expect(model.isLocal).toBe(true);
      expect(model.provider).toBe('ollama');
      expect(model.cliModel).toBeTruthy();
    }
  });

  test('deciding roles default to deep thinking, executing roles to faster models', () => {
    expect(getDefaultModelForRole('architect').profile).toBe('deep-thinking');
    expect(getDefaultModelForRole('qa-security').profile).toBe('deep-thinking');
    expect(getDefaultModelForRole('devops').profile).toBe('fast-economic');
    expect(getDefaultModelForRole('unknown-role')).toBe(AI_MODELS[0]);
  });
});

describe('agent model resolution', () => {
  beforeEach(() => agentConfigStore.resetToDefaults());

  test('panel override beats agent override beats the role default', () => {
    const resolve = () => agentConfigStore.resolveModelForPanel('p1', 'qa-security-auditor', 'qa-security').id;
    expect(resolve()).toBe(ROLE_DEFAULT_MODELS['qa-security']);

    agentConfigStore.setModelForAgent('qa-security-auditor', 'claude-sonnet-5-5');
    expect(resolve()).toBe('claude-sonnet-5-5');

    agentConfigStore.setModelForPanel('p1', 'gemini-default');
    expect(resolve()).toBe('gemini-default');

    agentConfigStore.clearPanelModel('p1');
    agentConfigStore.clearAgentModel('qa-security-auditor');
    expect(resolve()).toBe(ROLE_DEFAULT_MODELS['qa-security']);
  });

  test('a stored model id that no longer exists falls back to the role default', () => {
    agentConfigStore.setModelForPanel('p1', 'claude-3-7-sonnet-thinking');
    expect(agentConfigStore.resolveModelForPanel('p1', undefined, 'devops').id).toBe(
      ROLE_DEFAULT_MODELS.devops
    );
  });
});
