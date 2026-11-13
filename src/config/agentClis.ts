import type { ProviderId } from './modelCatalog';

export type AgentCliId = 'claude' | 'codex' | 'gemini' | 'ollama';

export interface AgentCliDefinition {
  id: AgentCliId;
  label: string;
  /** Executable looked up on the user's login-shell PATH. */
  binary: string;
}

export const AGENT_CLIS: Record<AgentCliId, AgentCliDefinition> = {
  claude: { id: 'claude', label: 'Claude Code', binary: 'claude' },
  codex: { id: 'codex', label: 'Codex CLI', binary: 'codex' },
  gemini: { id: 'gemini', label: 'Gemini CLI', binary: 'gemini' },
  ollama: { id: 'ollama', label: 'Ollama', binary: 'ollama' },
};

const PROVIDER_CLI: Record<ProviderId, AgentCliId | null> = {
  anthropic: 'claude',
  openai: 'codex',
  google: 'gemini',
  ollama: 'ollama',
  // No first-party CLI: DeepSeek models are reached through Ollama.
  deepseek: 'ollama',
};

export function cliForProvider(provider: ProviderId): AgentCliId | null {
  return PROVIDER_CLI[provider];
}

export interface AgentCommandOptions {
  cli: AgentCliId;
  /** Value for the CLI's model flag; omitted to use the CLI's own default. */
  cliModel?: string;
  /** Persona + team protocol given to the agent at start-up. */
  persona: string;
  /** Run without asking for permission (PRD R8.3). */
  autoApprove: boolean;
  /** Continue the previous conversation of this worktree instead of starting fresh. */
  resume: boolean;
}

/**
 * Argument vector that starts an agent CLI. The backend `exec`s it through a login shell
 * with every argument quoted, so nothing here is ever interpreted by a shell.
 */
export function buildAgentCommand(options: AgentCommandOptions): string[] {
  const { cli, cliModel, persona, autoApprove, resume } = options;
  const model = cliModel?.trim();

  switch (cli) {
    case 'claude':
      return [
        'claude',
        ...(model ? ['--model', model] : []),
        ...(autoApprove ? ['--dangerously-skip-permissions'] : []),
        ...(resume ? ['--continue'] : []),
        ...(persona ? ['--append-system-prompt', persona] : []),
      ];
    case 'codex': {
      const flags = [
        ...(model ? ['-m', model] : []),
        ...(autoApprove ? ['--dangerously-bypass-approvals-and-sandbox'] : []),
      ];
      if (resume) return ['codex', 'resume', '--last', ...flags];
      return ['codex', ...flags, ...(persona ? [persona] : [])];
    }
    case 'gemini':
      return [
        'gemini',
        ...(model ? ['-m', model] : []),
        ...(autoApprove ? ['--approval-mode', 'yolo'] : []),
        ...(resume ? ['--resume', 'latest'] : persona ? ['-i', persona] : []),
      ];
    case 'ollama':
      return ['ollama', 'run', model || 'llama3'];
  }
}

export interface TeamMember {
  key: string;
  title: string;
  role: string;
}

export interface ProtocolNoteOptions {
  self: TeamMember;
  team: TeamMember[];
  branch: string;
  baseBranch: string;
  port: number;
}

/** Paragraph appended to every persona so the agent knows its workspace and how to reach the team. */
export function buildTeamProtocolNote(options: ProtocolNoteOptions): string {
  const { self, team, branch, baseBranch, port } = options;
  const colleagues = team
    .filter((member) => member.key !== self.key)
    .map((member) => `- \`${member.key}\` — ${member.title} (${member.role})`)
    .join('\n');

  return [
    '## Protocolo de equipa HelmADE',
    `És o agente «${self.title}» (chave \`${self.key}\`) de um enxame supervisionado por um humano.`,
    `Trabalhas num git worktree só teu, na branch \`${branch}\` (criada a partir de \`${baseBranch}\`). ` +
      'Os outros agentes não veem os teus ficheiros: faz commit do teu trabalho e, para usares o trabalho de um colega, ' +
      'faz `git merge` da branch dele. Nunca edites ficheiros fora do teu worktree.',
    `Porta reservada para servidores locais: ${port} (variável de ambiente PORT).`,
    'Para falares com a equipa usa a CLI `helmade` (também disponível em "$HELMADE_CLI"):',
    '- `helmade peers` — lista os agentes do enxame',
    '- `helmade send <chave> "<mensagem>"` — mensagem direta',
    '- `helmade broadcast "<mensagem>"` — mensagem para todos',
    '- `helmade inbox` — mensagens recebidas',
    'As mensagens dos colegas chegam ao teu prompt como `[A2A de @Nome] …`; responde-lhes sempre com `helmade send`.',
    colleagues ? `Colegas neste enxame:\n${colleagues}` : 'És o único agente deste enxame.',
  ].join('\n');
}
