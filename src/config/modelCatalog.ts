import type { AgentRoleType } from '../types/terminal';

export type CognitiveProfileId =
  | 'deep-thinking'
  | 'fast-economic'
  | 'research-context'
  | 'local-zero-cost';

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'ollama';

export interface CognitiveProfile {
  id: CognitiveProfileId;
  label: string;
  shortLabel: string;
  description: string;
  badge: string;
  color: 'gold' | 'blue' | 'purple' | 'green';
  icon: string;
}

export interface AIModelDefinition {
  id: string;
  name: string;
  provider: ProviderId;
  profile: CognitiveProfileId;
  contextWindow: string;
  description: string;
  costDescription: string;
  isLocal?: boolean;
}

export const COGNITIVE_PROFILES: Record<CognitiveProfileId, CognitiveProfile> = {
  'deep-thinking': {
    id: 'deep-thinking',
    label: 'Deep Thinking / Raciocínio Profundo',
    shortLabel: 'Deep Think',
    description: 'Raciocínio estendido, planeamento de arquitetura, deduções lógicas e auditoria de segurança crítica.',
    badge: 'Alta Precisão',
    color: 'gold',
    icon: 'brain',
  },
  'fast-economic': {
    id: 'fast-economic',
    label: 'Fast / Económico',
    shortLabel: 'Fast',
    description: 'Respostas ultrarrápidas, triagem de tarefas, transformações utilitárias e baixo consumo de quota.',
    badge: 'Baixa Latência',
    color: 'blue',
    icon: 'zap',
  },
  'research-context': {
    id: 'research-context',
    label: 'Research / Amplo Contexto',
    shortLabel: 'Research',
    description: 'Janela de contexto expansiva para análise integral de repositórios, documentação densa e refatorações amplas.',
    badge: 'Contexto 2M',
    color: 'purple',
    icon: 'book-open',
  },
  'local-zero-cost': {
    id: 'local-zero-cost',
    label: 'Local 0.00€ / Ollama',
    shortLabel: 'Local / Ollama',
    description: 'Execução 100% privada e local via Ollama, sem telemetria externa, sem custos de API e com soberania de dados.',
    badge: '0.00€ · Offline',
    color: 'green',
    icon: 'server',
  },
};

export const AI_MODELS: AIModelDefinition[] = [
  // --- 1. Deep Thinking / Raciocínio Profundo ---
  {
    id: 'claude-3-7-sonnet-thinking',
    name: 'Claude 3.7 Sonnet Thinking',
    provider: 'anthropic',
    profile: 'deep-thinking',
    contextWindow: '200k',
    description: 'Raciocínio híbrido pioneiro com pensamento estendido para arquitetura e problemas complexos.',
    costDescription: 'Premium / Token Raciocínio',
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3-mini',
    provider: 'openai',
    profile: 'deep-thinking',
    contextWindow: '200k',
    description: 'Raciocínio especializado de ponta em matemática, lógica estrita e engenharia de precisão.',
    costDescription: 'Médio / Otimizado',
  },
  {
    id: 'gemini-2.0-flash-thinking',
    name: 'Gemini 2.0 Flash Thinking',
    provider: 'google',
    profile: 'deep-thinking',
    contextWindow: '1M',
    description: 'Processo reflexivo com tokens de pensamento visíveis e contexto multimodal massivo.',
    costDescription: 'Económico / Reflexivo',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek-R1',
    provider: 'deepseek',
    profile: 'deep-thinking',
    contextWindow: '64k',
    description: 'Raciocínio aberto treinado por reforço puro para resoluções algorítmicas rigorosas.',
    costDescription: 'Ultrabaixo Custo',
  },

  // --- 2. Fast / Económico ---
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    profile: 'fast-economic',
    contextWindow: '200k',
    description: 'Velocidade extrema de execução para geração de utilitários, scripts e triagem.',
    costDescription: 'Económico',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o-mini',
    provider: 'openai',
    profile: 'fast-economic',
    contextWindow: '128k',
    description: 'Modelo compacto com resposta rápida e custos diminutos para tarefas de suporte contínuo.',
    costDescription: 'Económico',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    profile: 'fast-economic',
    contextWindow: '1M',
    description: 'Desempenho relâmpago de última geração com throughput elevado para chamadas de rotina.',
    costDescription: 'Ultrabaixo Custo',
  },

  // --- 3. Research / Amplo Contexto ---
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro 2M',
    provider: 'google',
    profile: 'research-context',
    contextWindow: '2M',
    description: 'Janela monumental de 2 milhões de tokens para absorção de projetos inteiros e múltiplos volumes.',
    costDescription: 'Intermédio / Alto Contexto',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    profile: 'research-context',
    contextWindow: '200k',
    description: 'Referência da indústria em compreensão de código, nuances arquiteturais e geração refinada.',
    costDescription: 'Standard Pro',
  },

  // --- 4. Local 0.00€ / Ollama ---
  {
    id: 'ollama/llama3.3',
    name: 'Llama 3.3 70B',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: '128k',
    description: 'Modelo de pesos abertos de última geração executado localmente sem dependência de nuvem.',
    costDescription: '0.00€ / Local',
    isLocal: true,
  },
  {
    id: 'ollama/qwen2.5-coder:32b',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: '32k',
    description: 'Especialista local em programação com desempenho equiparável a modelos de topo na nuvem.',
    costDescription: '0.00€ / Local',
    isLocal: true,
  },
  {
    id: 'ollama/qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder 7B',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: '32k',
    description: 'Versão ágil de 7B ideal para hardware mais leve com suporte a tarefas de código.',
    costDescription: '0.00€ / Local',
    isLocal: true,
  },
  {
    id: 'ollama/deepseek-r1:14b',
    name: 'DeepSeek-R1 Distill 14B',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: '32k',
    description: 'Raciocínio destilado com etapas de reflexão em execução 100% privada e offline.',
    costDescription: '0.00€ / Local',
    isLocal: true,
  },
  {
    id: 'ollama/custom',
    name: 'Custom Local Ollama',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: 'Variável',
    description: 'Qualquer modelo instalado localmente no daemon Ollama (http://localhost:11434).',
    costDescription: '0.00€ / Local',
    isLocal: true,
  },
];

export const ROLE_DEFAULT_MODELS: Record<AgentRoleType, string> = {
  architect: 'claude-3-7-sonnet-thinking',
  fullstack: 'claude-3-7-sonnet-thinking',
  frontend: 'claude-3-5-sonnet',
  'apple-hig': 'claude-3-5-sonnet',
  database: 'gemini-2.0-flash-thinking',
  'qa-security': 'deepseek-r1',
  devops: 'claude-3-5-haiku',
  system: 'gemini-2.0-flash',
  custom: 'claude-3-7-sonnet-thinking',
};

/**
 * Retorna todos os modelos de IA disponíveis no catálogo HelmADE.
 */
export function getAllModels(): AIModelDefinition[] {
  return AI_MODELS;
}

/**
 * Filtra modelos por perfil cognitivo.
 */
export function getModelsByProfile(profileId: CognitiveProfileId): AIModelDefinition[] {
  return AI_MODELS.filter((m) => m.profile === profileId);
}

/**
 * Localiza um modelo específico pelo seu ID único.
 */
export function getModelById(id: string): AIModelDefinition | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

/**
 * Retorna o modelo padrão recomendado para um dado papel de agente.
 */
export function getDefaultModelForRole(role?: AgentRoleType | string): AIModelDefinition {
  if (role && role in ROLE_DEFAULT_MODELS) {
    const defaultModelId = ROLE_DEFAULT_MODELS[role as AgentRoleType];
    const model = getModelById(defaultModelId);
    if (model) return model;
  }
  return AI_MODELS[0]; // Fallback seguro para Claude 3.7 Sonnet Thinking
}

/**
 * Retorna todos os perfis cognitivos suportados em formato de lista.
 */
export function getCognitiveProfiles(): CognitiveProfile[] {
  return Object.values(COGNITIVE_PROFILES);
}
