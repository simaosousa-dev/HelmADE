import type { AgentRoleType } from '../types/terminal';

export type CognitiveProfileId =
  | 'deep-thinking'
  | 'fast-economic'
  | 'research-context'
  | 'local-zero-cost';

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'ollama';

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
  /** Value passed to the agent CLI's model flag. Omitted → the CLI's own default model. */
  cliModel?: string;
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

/**
 * Catálogo de modelos. O fornecedor de cada modelo determina a CLI de agente que corre no
 * painel (Claude Code, Codex, Gemini CLI ou Ollama). `cliModel` é o valor passado à flag de
 * modelo dessa CLI; quando omitido, a CLI usa o modelo que o utilizador lá tiver configurado.
 */
export const AI_MODELS: AIModelDefinition[] = [
  // --- 1. Deep Thinking / Raciocínio Profundo ---
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    provider: 'anthropic',
    profile: 'deep-thinking',
    contextWindow: '1M',
    description: 'Raciocínio profundo para orquestração, arquitetura e auditoria. Corre no Claude Code.',
    costDescription: '$4 / $20 por MTok',
    cliModel: 'claude-opus-5-5',
  },
  {
    id: 'claude-fable-5-2',
    name: 'Claude Fable 5.2',
    provider: 'anthropic',
    profile: 'deep-thinking',
    contextWindow: '1M',
    description: 'O modelo mais capaz, para tarefas longas e muito exigentes. Corre no Claude Code.',
    costDescription: '$8 / $40 por MTok',
    cliModel: 'claude-fable-5-2',
  },
  {
    id: 'codex-default',
    name: 'Codex (modelo da CLI)',
    provider: 'openai',
    profile: 'deep-thinking',
    contextWindow: 'definido pela CLI',
    description: 'Usa o modelo configurado na tua Codex CLI.',
    costDescription: 'Conforme a tua conta',
  },

  // --- 2. Fast / Económico ---
  {
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    provider: 'anthropic',
    profile: 'fast-economic',
    contextWindow: '1M',
    description: 'Equilíbrio entre velocidade e capacidade para implementação do dia a dia. Corre no Claude Code.',
    costDescription: '$2 / $10 por MTok',
    cliModel: 'claude-sonnet-5-5',
  },
  {
    id: 'claude-haiku-5-5',
    name: 'Claude Haiku 5.5',
    provider: 'anthropic',
    profile: 'fast-economic',
    contextWindow: '1M',
    description: 'Respostas muito rápidas e baratas para tarefas rotineiras. Corre no Claude Code.',
    costDescription: '$0.10 / $0.50 por MTok',
    cliModel: 'claude-haiku-5-5',
  },

  // --- 3. Research / Amplo Contexto ---
  {
    id: 'gemini-default',
    name: 'Gemini (modelo da CLI)',
    provider: 'google',
    profile: 'research-context',
    contextWindow: 'definido pela CLI',
    description: 'Usa o modelo configurado na tua Gemini CLI, indicado para exploração de documentação e especificações.',
    costDescription: 'Conforme a tua conta',
  },

  // --- 4. Local 0.00€ / Ollama ---
  {
    id: 'ollama/llama3.3',
    name: 'Llama 3.3 70B',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: '128k',
    description: 'Modelo de pesos abertos executado localmente sem dependência de nuvem.',
    costDescription: '0.00€ / Local',
    isLocal: true,
    cliModel: 'llama3.3',
  },
  {
    id: 'ollama/qwen2.5-coder:32b',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: '32k',
    description: 'Modelo local especializado em código, para máquinas com bastante memória.',
    costDescription: '0.00€ / Local',
    isLocal: true,
    cliModel: 'qwen2.5-coder:32b',
  },
  {
    id: 'ollama/qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder 7B',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: '32k',
    description: 'Modelo local leve especializado em código.',
    costDescription: '0.00€ / Local',
    isLocal: true,
    cliModel: 'qwen2.5-coder:7b',
  },
  {
    id: 'ollama/deepseek-r1:14b',
    name: 'DeepSeek R1 14B',
    provider: 'ollama',
    profile: 'local-zero-cost',
    contextWindow: '64k',
    description: 'Modelo local com raciocínio explícito.',
    costDescription: '0.00€ / Local',
    isLocal: true,
    cliModel: 'deepseek-r1:14b',
  },
];

/** Modelo recomendado por papel: raciocínio profundo para quem decide e audita, rápido para quem executa. */
export const ROLE_DEFAULT_MODELS: Record<AgentRoleType, string> = {
  architect: 'claude-opus-5-5',
  fullstack: 'claude-sonnet-5-5',
  frontend: 'claude-sonnet-5-5',
  'apple-hig': 'claude-sonnet-5-5',
  database: 'claude-sonnet-5-5',
  'qa-security': 'claude-opus-5-5',
  devops: 'claude-haiku-5-5',
  system: 'claude-sonnet-5-5',
  custom: 'claude-sonnet-5-5',
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
  return AI_MODELS[0];
}

/**
 * Retorna todos os perfis cognitivos suportados em formato de lista.
 */
export function getCognitiveProfiles(): CognitiveProfile[] {
  return Object.values(COGNITIVE_PROFILES);
}
