import type { AgentCliId } from '../config/agentClis';
import type { AgentRoleType, TerminalPanelColor } from './terminal';

export type GridLayoutType = '1x1' | '1x2' | '2x2' | '2x3' | '3x3' | '4x4';

export type PanelKind = 'agent' | 'shell';

/** One panel of a swarm and the isolated workspace it owns. */
export interface SwarmPanel {
  /** Unique inside the swarm; how agents address each other. */
  key: string;
  title: string;
  agentId: string;
  role: AgentRoleType;
  color: TerminalPanelColor;
  kind: PanelKind;
  cli: AgentCliId | null;
  modelId: string;
  /** Also the PTY session id. */
  worktreeId: string;
  worktreePath: string;
  branch: string;
  port: number;
}

/** A swarm: one grid tab of a project. Mirrors the backend `SwarmRecord`. */
export interface Swarm {
  id: string;
  projectId: string;
  name: string;
  presetId: string | null;
  layout: GridLayoutType;
  baseBranch: string;
  autoApprove: boolean;
  position: number;
  createdAt: number;
  panels: SwarmPanel[];
}

export interface AgentWorkspace {
  panelKey: string;
  worktreeId: string;
  branch: string;
  path: string;
  port: number;
  env: Record<string, string>;
}

export interface ProvisionedSwarm {
  swarmId: string;
  baseBranch: string;
  agents: AgentWorkspace[];
}

export interface OrphanWorktree {
  swarm_id: string;
  branch: string;
  path: string;
}
