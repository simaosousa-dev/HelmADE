import type { SwarmPreset } from '../config/swarmPresets';
import { gridLayoutStore, type GridPanelConfig } from '../stores/useGridLayoutStore';
import { swarmStore } from '../stores/useSwarmStore';
import { agentConfigStore } from '../stores/useAgentConfigStore';
import { terminalService } from './terminalService';
import { portService } from './portService';
import { agentRegistry } from './agentRegistry';

export interface LaunchSwarmOptions {
  autoSpawnPty?: boolean;
}

/**
 * Lançamento coordenado de um modelo de enxame (Swarm Preset) em menos de 800ms.
 * Atualiza o layout da grelha, instancia os painéis semânticos com sessionId único
 * e inicializa os processos PTY com injeção transparente de variáveis de ambiente e contexto.
 */
export async function launchSwarmPreset(
  preset: SwarmPreset,
  projectPath: string,
  options?: LaunchSwarmOptions
): Promise<void> {
  const shouldSpawnPty = options?.autoSpawnPty !== false;
  swarmStore.setLaunching(true);
  swarmStore.setError(null);

  try {
    const timestamp = Date.now();

    // 1. Atualizar o layout no gridLayoutStore
    gridLayoutStore.setLayout(preset.layout);

    // 2. Mapear cada painel do preset para um GridPanelConfig vivo com resolução de modelo
    const panelsWithSessions: Array<{
      panel: (typeof preset.panels)[number];
      gridConfig: GridPanelConfig;
    }> = preset.panels.map((p) => {
      const sessionId = `${preset.id}-${p.id}-${timestamp}`;
      const assignedModel = agentConfigStore.resolveModelForPanel(p.id, p.agentId, p.role);
      return {
        panel: p,
        gridConfig: {
          id: p.id,
          sessionId,
          title: p.title,
          agentId: p.agentId,
          agentRole: p.role,
          color: p.color,
          status: p.initialStatus,
          modelId: assignedModel.id,
        },
      };
    });

    // 3. Definir painéis na grelha atómica
    gridLayoutStore.setPanels(panelsWithSessions.map((item) => item.gridConfig));

    // 4. Se autoSpawnPty ativo, inicializar PTYs com injeção de contexto transparente
    if (shouldSpawnPty) {
      // Obter ou alocar porta e variáveis de rede para o enxame de forma não bloqueante
      let portEnvVars: Record<string, string> = {};
      try {
        const allocatedPort = await portService.allocatePort(preset.id);
        const dynamicEnv = await portService.getEnvVars(preset.id);
        portEnvVars = {
          ...dynamicEnv,
          PORT: String(allocatedPort),
          HELM_SWARM_PORT: String(allocatedPort),
        };
      } catch {
        // Ambiente de teste, browser ou porta previamente alocada — degradação graciosa
      }

      // Disparar o spawn de PTYs em paralelo para manter latência <800ms
      await Promise.allSettled(
        panelsWithSessions.map(async ({ panel, gridConfig }) => {
          // Tentar carregar persona .md do agentRegistry se existir
          let personaPrompt = panel.initialPrompt || '';
          let agentDefaultModel: string | null = null;
          try {
            const agentDef = await agentRegistry.getAgent(panel.agentId, projectPath);
            if (agentDef) {
              if (agentDef.system_prompt) {
                personaPrompt = agentDef.system_prompt;
              }
              if (agentDef.metadata?.default_model) {
                agentDefaultModel = agentDef.metadata.default_model;
              }
            }
          } catch {
            // Se persona não for encontrada no disco, utiliza prompt inicial do preset
          }

          // Resolver modelo cognitivo final do painel/agente
          const resolvedModel = agentConfigStore.resolveModelForPanel(
            panel.id,
            panel.agentId,
            panel.role,
            agentDefaultModel
          );

          const modelEnvVars: Record<string, string> = {
            HELM_AGENT_MODEL: resolvedModel.id,
            HELM_MODEL_PROFILE: resolvedModel.profile,
            HELM_MODEL_CLI_FLAG: `--model ${resolvedModel.id}`,
            ...(resolvedModel.provider === 'ollama' || resolvedModel.isLocal
              ? { HELM_OLLAMA_ENDPOINT: 'http://localhost:11434' }
              : {}),
          };

          const injectedEnv: Record<string, string> = {
            HELM_SWARM_ID: preset.id,
            HELM_AGENT_ID: panel.agentId,
            HELM_AGENT_ROLE: panel.role,
            HELM_PROJECT_PATH: projectPath,
            HELM_AGENT_TITLE: panel.title,
            HELM_AGENT_COLOR: panel.color,
            ...(personaPrompt ? { HELM_SYSTEM_PROMPT: personaPrompt } : {}),
            ...modelEnvVars,
            ...panel.envVars,
            ...portEnvVars,
          };

          try {
            await terminalService.spawnPty({
              sessionId: gridConfig.sessionId,
              cwd: projectPath,
              env: injectedEnv,
            });
            gridLayoutStore.updatePanelStatus(gridConfig.id, 'idle');
          } catch {
            // Em ambiente browser / teste sem backend Tauri, não quebrar a UI
            gridLayoutStore.updatePanelStatus(gridConfig.id, 'idle');
          }
        })
      );
    }

    swarmStore.selectPreset(preset.id);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Falha ao lançar enxame';
    swarmStore.setError(errorMsg);
    throw error;
  } finally {
    swarmStore.setLaunching(false);
  }
}

export const swarmLauncher = {
  launchSwarmPreset,
};
