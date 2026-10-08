import type { SwarmPreset } from '../config/swarmPresets';
import { gridLayoutStore, type GridPanelConfig } from '../stores/useGridLayoutStore';
import { swarmStore } from '../stores/useSwarmStore';
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

    // 2. Mapear cada painel do preset para um GridPanelConfig vivo
    const panelsWithSessions: Array<{
      panel: (typeof preset.panels)[number];
      gridConfig: GridPanelConfig;
    }> = preset.panels.map((p) => {
      const sessionId = `${preset.id}-${p.id}-${timestamp}`;
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
          try {
            const agentDef = await agentRegistry.getAgent(panel.agentId, projectPath);
            if (agentDef && agentDef.system_prompt) {
              personaPrompt = agentDef.system_prompt;
            }
          } catch {
            // Se persona não for encontrada no disco, utiliza prompt inicial do preset
          }

          const injectedEnv: Record<string, string> = {
            HELM_SWARM_ID: preset.id,
            HELM_AGENT_ID: panel.agentId,
            HELM_AGENT_ROLE: panel.role,
            HELM_PROJECT_PATH: projectPath,
            HELM_AGENT_TITLE: panel.title,
            HELM_AGENT_COLOR: panel.color,
            ...(personaPrompt ? { HELM_SYSTEM_PROMPT: personaPrompt } : {}),
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
