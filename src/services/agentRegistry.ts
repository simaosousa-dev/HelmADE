import { invoke } from '../lib/ipc';
import type { AgentDefinition } from '../types/agent';

class AgentRegistryService {
  private cache: Map<string, AgentDefinition[]> = new Map();

  /**
   * Discovers and lists all agent personas from global and project-specific directories.
   * Caches results per projectPath for responsive UI interactions.
   */
  async listAgents(projectPath?: string): Promise<AgentDefinition[]> {
    const cacheKey = projectPath || '__global__';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const agents = await invoke<AgentDefinition[]>('list_discovered_agents', {
      projectPath: projectPath || null,
    });

    this.cache.set(cacheKey, agents);
    return agents;
  }

  /**
   * Retrieves full details and system prompt for a single agent by ID or name.
   */
  async getAgent(agentId: string, projectPath?: string): Promise<AgentDefinition> {
    return invoke<AgentDefinition>('get_agent_details', {
      agentId,
      projectPath: projectPath || null,
    });
  }

  /**
   * Invalidates internal memory cache to force a fresh disk scan on next request.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const agentRegistry = new AgentRegistryService();
export const listAgents = (projectPath?: string) => agentRegistry.listAgents(projectPath);
export const getAgent = (agentId: string, projectPath?: string) => agentRegistry.getAgent(agentId, projectPath);
export const clearCache = () => agentRegistry.clearCache();

export interface OllamaStatus {
  is_running: boolean;
  endpoint: string;
  models: string[];
  message: string | null;
}

/**
 * Verifica se a instância local do Ollama está ativa e descobre os modelos instalados.
 */
export async function checkOllamaStatus(endpoint?: string): Promise<OllamaStatus> {
  return invoke<OllamaStatus>('check_ollama_status', {
    endpoint: endpoint || null,
  });
}

