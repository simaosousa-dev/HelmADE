import {
  AGENT_CLIS,
  buildAgentCommand,
  buildTeamProtocolNote,
  cliForProvider,
  type AgentCliId,
} from '../config/agentClis';
import { getModelById } from '../config/modelCatalog';
import type { SwarmPreset } from '../config/swarmPresets';
import { errorMessage, invoke } from '../lib/ipc';
import { a2aStore } from '../stores/useA2AStore';
import { agentConfigStore } from '../stores/useAgentConfigStore';
import { swarmStore } from '../stores/useSwarmStore';
import type { Project } from '../types/project';
import type { Swarm, SwarmPanel } from '../types/swarm';
import { a2aService } from './a2aService';
import { agentRegistry } from './agentRegistry';
import { settingsService } from './settingsService';
import { swarmService } from './swarmService';
import { terminalService } from './terminalService';

/** Personas are passed on the command line; keep them far below the OS argument limit. */
const MAX_PERSONA_CHARS = 32_000;
/** A resumed agent that dies this quickly had no conversation to resume. */
const RESUME_GRACE_MS = 8_000;
const SAVE_DEBOUNCE_MS = 250;

export interface LaunchOptions {
  name?: string;
  autoApprove?: boolean;
}

export interface LaunchReport {
  swarm: Swarm;
  /** Non-fatal problems the user should know about (missing CLI, panel that failed to start). */
  warnings: string[];
}

export interface RestoreReport {
  swarms: number;
  panels: number;
  warnings: string[];
}

function activeSwarmKey(projectId: string): string {
  return `active_swarm:${projectId}`;
}

/** Short id that is valid in a branch name and a directory name. */
export function generateSwarmId(random: () => number = Math.random): string {
  const suffix = Array.from({ length: 6 }, () => Math.floor(random() * 36).toString(36)).join('');
  return `s${suffix}`;
}

/** Sessions being closed on purpose: their exit must never be mistaken for a failed resume. */
const closingSessions = new Set<string>();
/** Restores in flight, so two callers for the same project share one (React StrictMode mounts twice). */
const restoresInFlight = new Map<string, Promise<RestoreReport>>();

let installedClis: Promise<Record<string, boolean>> | null = null;

/** Which agent CLIs exist on the user's login-shell PATH (cached for the session). */
export function detectInstalledClis(refresh = false): Promise<Record<string, boolean>> {
  if (!installedClis || refresh) {
    const binaries = Object.values(AGENT_CLIS).map((cli) => cli.binary);
    installedClis = invoke<Record<string, boolean>>('detect_agent_clis', { binaries }).catch(
      (error: unknown) => {
        installedClis = null;
        throw error;
      }
    );
  }
  return installedClis;
}

async function loadPersona(panel: SwarmPanel, projectPath: string, fallback: string): Promise<string> {
  try {
    const agent = await agentRegistry.getAgent(panel.agentId, projectPath);
    return (agent.system_prompt || fallback).slice(0, MAX_PERSONA_CHARS);
  } catch {
    // No persona file for this agent: the preset's short brief is used instead.
    return fallback;
  }
}

function panelEnv(project: Project, swarm: Swarm, panel: SwarmPanel): Record<string, string> {
  const port = String(panel.port);
  return {
    HELM_SWARM_ID: swarm.id,
    HELM_AGENT_KEY: panel.key,
    HELM_AGENT_ID: panel.agentId,
    HELM_AGENT_ROLE: panel.role,
    HELM_AGENT_TITLE: panel.title,
    HELM_PROJECT_PATH: project.path,
    HELM_BASE_BRANCH: swarm.baseBranch,
    HELM_SWARM_PORT: port,
    PORT: port,
    VITE_PORT: port,
    SERVER_PORT: port,
    DEV_SERVER_PORT: port,
  };
}

async function agentCommand(
  project: Project,
  swarm: Swarm,
  panel: SwarmPanel,
  resume: boolean
): Promise<string[] | undefined> {
  if (panel.kind !== 'agent' || !panel.cli) return undefined;
  const brief = `És o agente «${panel.title}».`;
  const persona = await loadPersona(panel, project.path, brief);
  const note = buildTeamProtocolNote({
    self: panel,
    team: swarm.panels,
    branch: panel.branch,
    baseBranch: swarm.baseBranch,
    port: panel.port,
  });
  return buildAgentCommand({
    cli: panel.cli,
    cliModel: getModelById(panel.modelId)?.cliModel,
    persona: `${persona}\n\n${note}`,
    autoApprove: swarm.autoApprove,
    resume,
  });
}

/** Starts (or restarts) the terminal of one panel inside its worktree. */
export async function spawnPanel(
  project: Project,
  swarm: Swarm,
  panel: SwarmPanel,
  resume = false
): Promise<void> {
  await terminalService.spawnPty({
    sessionId: panel.worktreeId,
    cwd: panel.worktreePath,
    command: await agentCommand(project, swarm, panel, resume),
    env: panelEnv(project, swarm, panel),
  });
  swarmStore.setPanelStatus(panel.worktreeId, 'running');
}

function registerPeers(swarm: Swarm): Promise<void> {
  return a2aService.registerPeers(
    swarm.id,
    swarm.panels.map((panel) => ({
      id: panel.key,
      name: panel.title,
      role: panel.role,
      agentId: panel.agentId,
      sessionId: panel.worktreeId,
      // A panel without an agent CLI is a shell: messages are displayed there, never executed.
      kind: panel.kind === 'agent' && panel.cli ? 'agent' : 'shell',
    }))
  );
}

async function spawnAll(project: Project, swarm: Swarm, resume: boolean): Promise<string[]> {
  const results = await Promise.allSettled(
    swarm.panels.map((panel) => spawnPanel(project, swarm, panel, resume && panel.cli !== null))
  );
  const warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') return;
    const panel = swarm.panels[index];
    swarmStore.setPanelStatus(panel.worktreeId, 'error');
    warnings.push(`${panel.title}: ${errorMessage(result.reason)}`);
  });
  return warnings;
}

/**
 * Launches a preset as a new swarm: one worktree, branch and port per agent, then one
 * terminal per panel running its agent CLI inside that worktree.
 */
export async function launchSwarmPreset(
  preset: SwarmPreset,
  project: Project,
  options: LaunchOptions = {}
): Promise<LaunchReport> {
  swarmStore.setLaunching(true);
  swarmStore.setError(null);
  try {
    const swarmId = generateSwarmId();
    const [provisioned, installed] = await Promise.all([
      swarmService.provision(
        project.path,
        swarmId,
        preset.panels.map((panel) => panel.id)
      ),
      detectInstalledClis().catch((): Record<string, boolean> => ({})),
    ]);

    const warnings: string[] = [];
    const panels: SwarmPanel[] = preset.panels.map((presetPanel, index) => {
      const workspace = provisioned.agents[index];
      const kind = presetPanel.kind ?? 'agent';
      const model = agentConfigStore.resolveModelForPanel(
        presetPanel.id,
        presetPanel.agentId,
        presetPanel.role
      );
      let cli: AgentCliId | null = kind === 'agent' ? cliForProvider(model.provider) : null;
      if (cli && installed[AGENT_CLIS[cli].binary] === false) {
        warnings.push(
          `${AGENT_CLIS[cli].label} não está instalado: o painel «${presetPanel.title}» abriu como shell.`
        );
        cli = null;
      }
      return {
        key: presetPanel.id,
        title: presetPanel.title,
        agentId: presetPanel.agentId,
        role: presetPanel.role,
        color: presetPanel.color,
        kind,
        cli,
        modelId: model.id,
        worktreeId: workspace.worktreeId,
        worktreePath: workspace.path,
        branch: workspace.branch,
        port: workspace.port,
      };
    });

    const swarm: Swarm = {
      id: swarmId,
      projectId: project.id,
      name: options.name?.trim() || preset.name,
      presetId: preset.id,
      layout: preset.layout,
      baseBranch: provisioned.baseBranch,
      autoApprove: options.autoApprove ?? false,
      position: swarmStore.getState().swarms.length,
      createdAt: Math.floor(Date.now() / 1000),
      panels,
    };

    await swarmService.save(swarm);
    swarmStore.addSwarm(swarm);
    await registerPeers(swarm);
    warnings.push(...(await spawnAll(project, swarm, false)));
    return { swarm, warnings };
  } catch (error) {
    swarmStore.setError(errorMessage(error));
    throw error;
  } finally {
    swarmStore.setLaunching(false);
  }
}

/** Re-attaches one saved swarm to its surviving worktrees. Panels whose worktree is gone are dropped. */
async function reattach(project: Project, saved: Swarm, warnings: string[]): Promise<Swarm | null> {
  const panels: SwarmPanel[] = [];
  for (const panel of saved.panels) {
    try {
      const workspace = await swarmService.restoreWorkspace(project.path, saved.id, panel.key);
      panels.push({ ...panel, port: workspace.port, worktreePath: workspace.path });
    } catch (error) {
      warnings.push(`${saved.name} · ${panel.title}: ${errorMessage(error)}`);
    }
  }
  if (panels.length === 0) {
    await swarmService.delete(saved.id);
    return null;
  }
  return { ...saved, panels };
}

/** A resumed agent that exits almost immediately is restarted with a fresh conversation. */
function restartIfResumeFails(project: Project, swarm: Swarm): void {
  const resumed = new Set(swarm.panels.filter((p) => p.cli !== null).map((p) => p.worktreeId));
  if (resumed.size === 0) return;

  let stopListening: (() => void) | null = null;
  const stop = () => {
    stopListening?.();
    stopListening = null;
  };
  terminalService
    .onExit(({ sessionId, exitCode }) => {
      if (!resumed.delete(sessionId) || exitCode === 0 || closingSessions.has(sessionId)) return;
      const panel = swarmStore.findPanel(sessionId)?.panel;
      if (!panel) return;
      spawnPanel(project, swarm, panel, false).catch((error: unknown) => {
        swarmStore.setPanelStatus(sessionId, 'error');
        swarmStore.setError(`${panel.title}: ${errorMessage(error)}`);
      });
    })
    .then((unlisten) => {
      stopListening = unlisten;
      setTimeout(stop, RESUME_GRACE_MS);
    })
    .catch((error: unknown) => swarmStore.setError(errorMessage(error)));
}

/**
 * Restores the project's swarms after an app restart: tabs, layout and panels come back,
 * and every terminal is started again inside its existing worktree.
 */
export function restoreProjectSwarms(project: Project): Promise<RestoreReport> {
  const inFlight = restoresInFlight.get(project.id);
  if (inFlight) return inFlight;
  const restore = restoreSwarms(project).finally(() => restoresInFlight.delete(project.id));
  restoresInFlight.set(project.id, restore);
  return restore;
}

async function restoreSwarms(project: Project): Promise<RestoreReport> {
  const warnings: string[] = [];
  const [saved, activeId] = await Promise.all([
    swarmService.list(project.id),
    settingsService.get(activeSwarmKey(project.id)),
  ]);

  const restored: Swarm[] = [];
  for (const swarm of saved) {
    const reattached = await reattach(project, swarm, warnings);
    if (reattached) restored.push(reattached);
  }
  swarmStore.replaceAll(restored, activeId);

  for (const swarm of restored) {
    await registerPeers(swarm);
    await a2aStore.loadHistory(swarm.id);
    // After a webview reload the backend still owns live terminals: only dead ones are restarted.
    const alive = await Promise.all(swarm.panels.map((p) => terminalService.isAlive(p.worktreeId)));
    const dead = { ...swarm, panels: swarm.panels.filter((_, index) => !alive[index]) };
    swarm.panels
      .filter((_, index) => alive[index])
      .forEach((panel) => swarmStore.setPanelStatus(panel.worktreeId, 'running'));
    restartIfResumeFails(project, dead);
    warnings.push(...(await spawnAll(project, { ...swarm, panels: dead.panels }, true)));
  }

  return {
    swarms: restored.length,
    panels: restored.reduce((total, swarm) => total + swarm.panels.length, 0),
    warnings,
  };
}

async function releasePanel(project: Project, sessionId: string, deleteBranch: boolean): Promise<void> {
  closingSessions.add(sessionId);
  try {
    await swarmService.releaseWorkspace(project.path, sessionId, deleteBranch);
  } finally {
    // The exit event of the killed terminal arrives shortly after the command returns.
    setTimeout(() => closingSessions.delete(sessionId), RESUME_GRACE_MS);
  }
}

/** Closes one panel: its terminal, port and worktree go away (and its branch when asked). */
export async function closePanel(
  project: Project,
  swarmId: string,
  sessionId: string,
  deleteBranch: boolean
): Promise<void> {
  await releasePanel(project, sessionId, deleteBranch);
  swarmStore.removePanel(swarmId, sessionId);
  const swarm = swarmStore.getState().swarms.find((s) => s.id === swarmId);
  if (swarm && swarm.panels.length === 0) {
    await swarmService.delete(swarmId);
    swarmStore.removeSwarm(swarmId);
    a2aStore.forgetSwarm(swarmId);
  }
}

/** Closes a whole swarm, releasing every workspace it owns. */
export async function closeSwarm(
  project: Project,
  swarmId: string,
  deleteBranches: boolean
): Promise<void> {
  const swarm = swarmStore.getState().swarms.find((s) => s.id === swarmId);
  if (!swarm) return;
  for (const panel of swarm.panels) {
    await releasePanel(project, panel.worktreeId, deleteBranches);
  }
  await swarmService.delete(swarmId);
  swarmStore.removeSwarm(swarmId);
  a2aStore.forgetSwarm(swarmId);
}

/**
 * Keeps the backend in sync with the store while a project is open: swarms are saved
 * when they change, the roster follows panel edits, terminal exits update panel status.
 * Returns the function that stops the sync.
 */
export function startSwarmSync(project: Project): () => void {
  const saved = new Map<string, Swarm>(swarmStore.getState().swarms.map((s) => [s.id, s]));
  let lastActive = swarmStore.getState().activeSwarmId;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const report = (error: unknown) => swarmStore.setError(errorMessage(error));

  const unsubscribe = swarmStore.subscribe(() => {
    const { swarms, activeSwarmId } = swarmStore.getState();
    for (const swarm of swarms) {
      if (saved.get(swarm.id) === swarm) continue;
      saved.set(swarm.id, swarm);
      clearTimeout(timers.get(swarm.id));
      timers.set(
        swarm.id,
        setTimeout(() => {
          timers.delete(swarm.id);
          // The swarm may have been closed while the save was pending.
          if (!swarmStore.getState().swarms.includes(swarm)) return;
          swarmService.save(swarm).then(() => registerPeers(swarm)).catch(report);
        }, SAVE_DEBOUNCE_MS)
      );
    }
    for (const id of saved.keys()) {
      if (!swarms.some((swarm) => swarm.id === id)) saved.delete(id);
    }
    if (activeSwarmId !== lastActive) {
      lastActive = activeSwarmId;
      settingsService.set(activeSwarmKey(project.id), activeSwarmId ?? '').catch(report);
    }
  });

  let stopExitListener: (() => void) | null = null;
  let stopped = false;
  terminalService
    .onExit(({ sessionId, exitCode }) => {
      if (!swarmStore.findPanel(sessionId)) return;
      swarmStore.setPanelStatus(sessionId, exitCode === 0 ? 'completed' : 'error');
    })
    .then((unlisten) => {
      if (stopped) unlisten();
      else stopExitListener = unlisten;
    })
    .catch(report);

  return () => {
    stopped = true;
    unsubscribe();
    stopExitListener?.();
    for (const timer of timers.values()) clearTimeout(timer);
  };
}
