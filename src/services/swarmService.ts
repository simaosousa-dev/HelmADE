import { invoke } from '../lib/ipc';
import type { AgentWorkspace, OrphanWorktree, ProvisionedSwarm, Swarm } from '../types/swarm';

export const swarmService = {
  /** Creates one worktree + branch + port per panel. All or nothing. */
  provision(repoPath: string, swarmId: string, panelKeys: string[]): Promise<ProvisionedSwarm> {
    return invoke<ProvisionedSwarm>('provision_swarm', { repoPath, swarmId, panelKeys });
  },

  restoreWorkspace(repoPath: string, swarmId: string, panelKey: string): Promise<AgentWorkspace> {
    return invoke<AgentWorkspace>('restore_agent_workspace', { repoPath, swarmId, panelKey });
  },

  /** Kills the panel's terminal, frees its port and removes its worktree. */
  releaseWorkspace(repoPath: string, worktreeId: string, deleteBranch: boolean): Promise<void> {
    return invoke<void>('release_agent_workspace', { repoPath, worktreeId, deleteBranch });
  },

  save(swarm: Swarm): Promise<void> {
    return invoke<void>('save_swarm', { swarm });
  },

  list(projectId: string): Promise<Swarm[]> {
    return invoke<Swarm[]>('list_swarms', { projectId });
  },

  delete(swarmId: string): Promise<boolean> {
    return invoke<boolean>('delete_swarm', { swarmId });
  },

  listOrphanWorktrees(repoPath: string, projectId: string): Promise<OrphanWorktree[]> {
    return invoke<OrphanWorktree[]>('list_orphan_worktrees', { repoPath, projectId });
  },
};
