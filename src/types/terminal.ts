export interface SpawnPtyOptions {
  sessionId: string;
  cwd?: string;
  /** Program and arguments run instead of an interactive shell (agent CLIs). */
  command?: string[];
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export interface PtyExitPayload {
  sessionId: string;
  exitCode: number | null;
}

export interface TerminalDimension {
  cols: number;
  rows: number;
}

/**
 * Estados reativos do terminal no HelmADE:
 * - Ativo: 'running' | 'active' (execução em curso, PTY a emitir dados)
 * - Em Espera: 'idle' | 'waiting' (aguardar input ou comando)
 * - Concluído: 'completed' (processo terminou com sucesso)
 * - Erro: 'error' (processo terminou com falha ou erro de PTY)
 * - Standby: 'standby' (processo ocioso em segundo plano com poupança de CPU)
 * - Bloqueado: 'blocked' (processo interativo bloqueado à espera de input humano)
 */
export type TerminalStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'error'
  | 'active'
  | 'waiting'
  | 'standby'
  | 'blocked';

export type PromptType = 'yes_no' | 'password' | 'input';

export interface BlockedPromptInfo {
  sessionId: string;
  promptText: string;
  promptType: PromptType;
  defaultChoice?: string;
  suggestedOptions: string[];
  timestamp: number;
}

export type SessionIdleState = 'active' | 'idle' | 'standby' | 'blocked';

export interface SessionStatusPayload {
  sessionId: string;
  state: SessionIdleState;
  blockedPrompt?: BlockedPromptInfo | null;
  lastActiveAt: number;
}


/**
 * Paleta de cores semânticas Apple HIG para os painéis de terminal.
 */
export type TerminalPanelColor = 'gold' | 'blue' | 'green' | 'purple' | 'red';

/**
 * Papéis especializados dos agentes no ecossistema Antigravity / HelmADE.
 */
export type AgentRoleType =
  | 'architect'
  | 'fullstack'
  | 'frontend'
  | 'apple-hig'
  | 'database'
  | 'qa-security'
  | 'devops'
  | 'system'
  | 'custom';

export interface AgentRoleConfig {
  role: AgentRoleType;
  label: string;
  shortLabel: string;
  description: string;
  defaultColor: TerminalPanelColor;
}

export const AGENT_ROLE_MAP: Record<AgentRoleType, AgentRoleConfig> = {
  architect: {
    role: 'architect',
    label: 'Principal Architect',
    shortLabel: 'ARCH',
    description: 'Arquitetura, MADR e planeamento técnico de alto nível',
    defaultColor: 'gold',
  },
  fullstack: {
    role: 'fullstack',
    label: 'Fullstack Engineer',
    shortLabel: 'FULL',
    description: 'Implementação end-to-end de sistemas e integrações',
    defaultColor: 'blue',
  },
  frontend: {
    role: 'frontend',
    label: 'Frontend Specialist',
    shortLabel: 'FRONT',
    description: 'Interface de utilizador, componentes React e Tailwind',
    defaultColor: 'blue',
  },
  'apple-hig': {
    role: 'apple-hig',
    label: 'Apple HIG Specialist',
    shortLabel: 'HIG',
    description: 'Ergonomia macOS, materiais táteis e tipografia SF Pro',
    defaultColor: 'purple',
  },
  database: {
    role: 'database',
    label: 'Database Engineer',
    shortLabel: 'DB',
    description: 'Modelagem de dados, migrações seguras e PostgreSQL RLS',
    defaultColor: 'green',
  },
  'qa-security': {
    role: 'qa-security',
    label: 'QA & Security Auditor',
    shortLabel: 'SEC',
    description: 'Segurança, prevenção de exploits e verificação AA',
    defaultColor: 'red',
  },
  devops: {
    role: 'devops',
    label: 'DevOps & Release',
    shortLabel: 'OPS',
    description: 'CI/CD, empacotamento Tauri e automação de builds',
    defaultColor: 'purple',
  },
  system: {
    role: 'system',
    label: 'System & PTY Manager',
    shortLabel: 'SYS',
    description: 'Multiplexador Rust, IPC e gestão de sockets locais',
    defaultColor: 'gold',
  },
  custom: {
    role: 'custom',
    label: 'Agente Personalizado',
    shortLabel: 'AGENT',
    description: 'Agente configurado pelo utilizador',
    defaultColor: 'blue',
  },
};

export interface TerminalSessionInfo {
  id: string;
  title: string;
  status: TerminalStatus;
  dimension: TerminalDimension;
  cwd?: string;
  exitCode?: number | null;
  agentRole?: AgentRoleType | string;
  color?: TerminalPanelColor;
}
