import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { SwarmPreset, PresetPanelConfig } from '../../config/swarmPresets';
import {
  type AIModelDefinition,
  type CognitiveProfileId,
  COGNITIVE_PROFILES,
  getAllModels,
  getModelById,
} from '../../config/modelCatalog';
import {
  agentConfigStore,
  useAgentConfigStore,
} from '../../stores/useAgentConfigStore';
import { checkOllamaStatus, type OllamaStatus } from '../../services/agentRegistry';
import type { AgentRoleType } from '../../types/terminal';
import { AGENT_ROLE_MAP } from '../../types/terminal';
import { PROFILE_COLOR_MAP } from '../terminal/ModelSelectorDropdown';

export interface AgentModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: SwarmPreset | null;
  onConfirmLaunch?: (customModelMap: Record<string, string>) => void;
  className?: string;
}

function renderRoleIcon(role: string) {
  switch (role) {
    case 'architect':
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          />
        </svg>
      );
    case 'fullstack':
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      );
    case 'frontend':
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
    case 'apple-hig':
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    case 'database':
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      );
    case 'qa-security':
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
    case 'devops':
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );
    case 'system':
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      );
  }
}

export const AgentModelConfigModal: React.FC<AgentModelConfigModalProps> = ({
  isOpen,
  onClose,
  preset,
  onConfirmLaunch,
  className = '',
}) => {
  const { resolveModelForPanel } = useAgentConfigStore();
  const allModels = useMemo(() => getAllModels(), []);

  // Mapeamento local editável: panelId -> modelId
  const [modelMap, setModelMap] = useState<Record<string, string>>({});

  // Estado do diagnóstico Ollama
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<{
    checked: boolean;
    running: boolean;
    endpoint: string;
    models: string[];
    error: string | null;
  } | null>(null);

  // Inicializar mapeamento quando o preset mudar ou o modal abrir
  useEffect(() => {
    if (!isOpen || !preset) return;

    const initialMap: Record<string, string> = {};
    for (const panel of preset.panels) {
      const stored = agentConfigStore.getModelForPanel(panel.id);
      if (stored) {
        initialMap[panel.id] = stored;
      } else {
        const resolved = resolveModelForPanel(panel.id, panel.agentId, panel.role);
        initialMap[panel.id] = resolved.id;
      }
    }
    setModelMap(initialMap);
  }, [isOpen, preset, resolveModelForPanel]);

  // Tecla Escape para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sonda de estado do Ollama Local
  const handleCheckOllama = useCallback(async () => {
    setOllamaLoading(true);
    try {
      const status: OllamaStatus = await checkOllamaStatus();
      setOllamaResult({
        checked: true,
        running: status.is_running,
        endpoint: status.endpoint || 'http://localhost:11434',
        models: status.models || [],
        error: status.message,
      });
    } catch (err) {
      setOllamaResult({
        checked: true,
        running: false,
        endpoint: 'http://localhost:11434',
        models: [],
        error: err instanceof Error ? err.message : 'Falha ao contactar daemon Ollama',
      });
    } finally {
      setOllamaLoading(false);
    }
  }, []);

  // Mudança de modelo para um painel específico
  const handlePanelModelChange = (panelId: string, newModelId: string) => {
    setModelMap((prev) => ({
      ...prev,
      [panelId]: newModelId,
    }));
  };

  // Ação em massa: aplicar perfil cognitivo ou predefinição a todos os agentes
  const handleApplyProfileToAll = (profileId: CognitiveProfileId) => {
    if (!preset) return;
    const profileModels = allModels.filter((m) => m.profile === profileId);
    if (profileModels.length === 0) return;
    const chosenModel = profileModels[0].id;

    const nextMap: Record<string, string> = {};
    for (const panel of preset.panels) {
      nextMap[panel.id] = chosenModel;
    }
    setModelMap(nextMap);
  };

  // Restaurar padrões recomendados para os papéis de cada agente
  const handleResetToRecommended = () => {
    if (!preset) return;
    const nextMap: Record<string, string> = {};
    for (const panel of preset.panels) {
      const def = resolveModelForPanel(panel.id, panel.agentId, panel.role);
      nextMap[panel.id] = def.id;
    }
    setModelMap(nextMap);
  };

  // Confirmação e lançamento
  const handleConfirm = () => {
    if (!preset) return;

    // Persistir escolhas no store atómico
    Object.entries(modelMap).forEach(([panelId, modelId]) => {
      agentConfigStore.setModelForPanel(panelId, modelId);
    });

    onConfirmLaunch?.(modelMap);
    onClose();
  };

  // Métricas do resumo
  const summaryMetrics = useMemo(() => {
    if (!preset) return { total: 0, local: 0, cloud: 0 };
    const total = preset.panels.length;
    let local = 0;
    for (const p of preset.panels) {
      const modelId = modelMap[p.id];
      const modelDef = modelId ? getModelById(modelId) : null;
      if (modelDef?.isLocal) {
        local += 1;
      }
    }
    return { total, local, cloud: total - local };
  }, [preset, modelMap]);

  if (!isOpen || !preset) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-model-config-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-4xl bg-[#1c1c1e] text-white border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${className}`}
      >
        {/* Cabeçalho macOS com SF Pro Display (>= 20pt) */}
        <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#161618]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center shadow-inner">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="agent-model-config-title"
                  className="text-[20px] font-semibold text-white/95 tracking-tight"
                >
                  Configuração de Modelos de IA
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {preset.name}
                </span>
              </div>
              <p className="text-[12px] text-white/60">
                Atribua modelos específicos e perfis cognitivos para cada agente do enxame antes do lançamento
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configuração de modelos"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Barra de Ações Rápidas & Sonda Ollama */}
        <div className="px-6 py-3 border-b border-white/10 bg-[#141416] flex flex-wrap items-center justify-between gap-3 text-[12px]">
          {/* Ações em massa */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white/40 text-[11px] font-medium mr-1">
              Atalhos rápidos:
            </span>
            <button
              type="button"
              onClick={() => handleApplyProfileToAll('local-zero-cost')}
              className="px-2.5 py-1 rounded-lg bg-[#ffd60a]/15 text-[#ffd60a] border border-[#ffd60a]/30 hover:bg-[#ffd60a]/25 text-[11px] font-medium transition-colors flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffd60a]" />
              Todos 0.00€ Local
            </button>
            <button
              type="button"
              onClick={() => handleApplyProfileToAll('fast-economic')}
              className="px-2.5 py-1 rounded-lg bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 hover:bg-[#30d158]/25 text-[11px] font-medium transition-colors flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
              Todos Fast
            </button>
            <button
              type="button"
              onClick={() => handleApplyProfileToAll('deep-thinking')}
              className="px-2.5 py-1 rounded-lg bg-[#bf5af2]/15 text-[#bf5af2] border border-[#bf5af2]/30 hover:bg-[#bf5af2]/25 text-[11px] font-medium transition-colors flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#bf5af2]" />
              Todos Raciocínio
            </button>
            <button
              type="button"
              onClick={handleResetToRecommended}
              className="px-2.5 py-1 rounded-lg bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 text-[11px] font-medium transition-colors"
            >
              Repor Recomendados
            </button>
          </div>

          {/* Sonda Ollama Local */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckOllama}
              disabled={ollamaLoading}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-[11px] font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {ollamaLoading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>A sondar...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Verificar Ollama Local</span>
                </>
              )}
            </button>

            {/* Diagnóstico da sonda */}
            {ollamaResult && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1.5 ${
                  ollamaResult.running
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
                title={
                  ollamaResult.running
                    ? `${ollamaResult.models.length} modelos locais: ${ollamaResult.models.join(', ') || 'Nenhum modelo baixado'}`
                    : (ollamaResult.error || 'Ollama offline na porta 11434')
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    ollamaResult.running ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {ollamaResult.running
                  ? `Ollama Ativo (${ollamaResult.models.length} modelos)`
                  : 'Ollama Inativo / Não Detetado'}
              </span>
            )}
          </div>
        </div>

        {/* Lista de Agentes do Preset e Seletor de Modelo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {preset.panels.map((panel: PresetPanelConfig) => {
            const currentSelectedModelId = modelMap[panel.id];
            const currentModel = currentSelectedModelId
              ? getModelById(currentSelectedModelId)
              : resolveModelForPanel(panel.id, panel.agentId, panel.role);

            const roleMeta = AGENT_ROLE_MAP[panel.role as AgentRoleType] || {
              label: panel.role,
              shortLabel: panel.role.slice(0, 4).toUpperCase(),
              description: 'Papel do agente',
            };

            const profileDef = currentModel
              ? COGNITIVE_PROFILES[currentModel.profile]
              : null;
            const profileColor = currentModel
              ? PROFILE_COLOR_MAP[currentModel.profile]
              : null;

            return (
              <div
                key={panel.id}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Informação do Agente */}
                <div className="flex items-start gap-3 min-w-[240px]">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/80 shrink-0 mt-0.5">
                    {renderRoleIcon(panel.role)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[14px] font-semibold text-white/95 tracking-tight">
                        {panel.title}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                        {roleMeta.shortLabel}
                      </span>
                      {panel.agentId && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          {panel.agentId}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 mt-0.5 line-clamp-1 max-w-sm">
                      {panel.initialPrompt || roleMeta.description}
                    </p>
                  </div>
                </div>

                {/* Seleção de Modelo & Indicadores de Perfil */}
                <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                  {/* Dropdown HTML5 nativo perfeitamente estilizado Apple HIG */}
                  <div className="relative min-w-[220px]">
                    <select
                      value={currentModel?.id || ''}
                      onChange={(e) => handlePanelModelChange(panel.id, e.target.value)}
                      aria-label={`Modelo para ${panel.title}`}
                      className="w-full bg-[#121214] text-white text-[12px] font-medium tracking-tight px-3 py-2 pr-8 rounded-lg border border-white/15 focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none cursor-pointer"
                    >
                      {/* Grupo 1: Deep Thinking */}
                      <optgroup label="Deep Thinking / Raciocínio Profundo">
                        {allModels
                          .filter((m) => m.profile === 'deep-thinking')
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.contextWindow})
                            </option>
                          ))}
                      </optgroup>

                      {/* Grupo 2: Fast / Económico */}
                      <optgroup label="Fast / Económico">
                        {allModels
                          .filter((m) => m.profile === 'fast-economic')
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.contextWindow})
                            </option>
                          ))}
                      </optgroup>

                      {/* Grupo 3: Research / Amplo Contexto */}
                      <optgroup label="Research / Amplo Contexto">
                        {allModels
                          .filter((m) => m.profile === 'research-context')
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.contextWindow})
                            </option>
                          ))}
                      </optgroup>

                      {/* Grupo 4: Local 0.00€ / Ollama */}
                      <optgroup label="Local 0.00€ / Ollama (Offline)">
                        {allModels
                          .filter((m) => m.profile === 'local-zero-cost')
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} — 0.00€
                            </option>
                          ))}
                      </optgroup>
                    </select>

                    {/* Seta do select */}
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Tag do Perfil Cognitivo */}
                  {profileDef && profileColor && (
                    <div
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium tracking-tight flex items-center gap-1.5 shrink-0 ${profileColor.badgeBg} ${profileColor.badgeText} ${profileColor.badgeBorder}`}
                      title={profileDef.description}
                    >
                      <span className={`w-2 h-2 rounded-full ${profileColor.dotBg}`} />
                      <span>{profileDef.shortLabel}</span>
                    </div>
                  )}

                  {/* Badge 0.00€ ou Custo */}
                  {currentModel?.isLocal ? (
                    <span className="px-2 py-1 rounded-lg bg-[#ffd60a]/20 text-[#ffd60a] border border-[#ffd60a]/40 font-mono text-[10px] font-bold shrink-0">
                      0.00€ Local
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-lg bg-white/5 text-white/50 border border-white/10 font-mono text-[10px] shrink-0">
                      {currentModel?.costDescription || 'Nuvem'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé macOS com Resumo e Ações Apple HIG (mínimo 44x44px) */}
        <div className="h-16 border-t border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#161618]">
          {/* Resumo do Enxame */}
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-white/70">
              Total: <strong className="text-white">{summaryMetrics.total} Agentes</strong>
            </span>
            <span className="text-white/20">•</span>
            <span className="text-white/70">
              <strong className="text-white">{summaryMetrics.cloud}</strong> Nuvem
            </span>
            <span className="text-white/20">•</span>
            <span className="text-[#ffd60a] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffd60a]" />
              <strong>{summaryMetrics.local}</strong> Local (0.00€)
            </span>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 border border-blue-400/40 shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Lançar Enxame com esta Configuração</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentModelConfigModal;
