import React, { useState, useEffect } from 'react';
import {
  type SwarmPreset,
  type PresetPanelConfig,
} from '../../config/swarmPresets';
import { useSwarmStore } from '../../stores/useSwarmStore';
import { launchSwarmPreset } from '../../services/swarmLauncher';
import type { TerminalPanelColor, AgentRoleType } from '../../types/terminal';
import { AGENT_ROLE_MAP } from '../../types/terminal';

export interface SwarmPresetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  className?: string;
}

const COLOR_BADGE_STYLES: Record<TerminalPanelColor, string> = {
  gold: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const COLOR_DOT_STYLES: Record<TerminalPanelColor, string> = {
  gold: 'bg-amber-400',
  blue: 'bg-blue-400',
  green: 'bg-emerald-400',
  purple: 'bg-purple-400',
  red: 'bg-red-400',
};

function renderPresetIcon(icon: string) {
  switch (icon) {
    case 'rocket':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.926 14.926 0 01-5.84 2.58m0 0a6 6 0 01-7.38-5.84h4.8m2.58 5.84L9.63 8.41m0 0A14.98 14.98 0 003.47 2.25 14.98 14.98 0 008.41 9.63m1.22-1.22l5.96 5.96"
          />
        </svg>
      );
    case 'sparkles':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      );
    case 'wrench':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    case 'cpu':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m16-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        </svg>
      );
    case 'terminal':
    default:
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
  }
}

function RolePill({ panel }: { panel: PresetPanelConfig }) {
  const roleConfig = AGENT_ROLE_MAP[panel.role as AgentRoleType] || {
    shortLabel: panel.role.slice(0, 4).toUpperCase(),
    label: panel.title,
  };
  const colorStyle = COLOR_BADGE_STYLES[panel.color] || COLOR_BADGE_STYLES.blue;
  const dotStyle = COLOR_DOT_STYLES[panel.color] || COLOR_DOT_STYLES.blue;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium ${colorStyle}`}
      title={`${panel.title} (${roleConfig.label})`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} aria-hidden="true" />
      <span>{roleConfig.shortLabel}</span>
      <span className="hidden sm:inline text-white/50">· {panel.title}</span>
    </span>
  );
}

export const SwarmPresetSelector: React.FC<SwarmPresetSelectorProps> = ({
  isOpen,
  onClose,
  projectPath,
  className = '',
}) => {
  const { presets, isLaunching, lastError, activePresetId } = useSwarmStore();
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    activePresetId || presets[0]?.id || 'trio-fullstack'
  );

  useEffect(() => {
    if (activePresetId) {
      setSelectedPresetId(activePresetId);
    }
  }, [activePresetId]);

  // Fechar com a tecla Escape
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

  if (!isOpen) return null;

  const currentPreset = presets.find((p) => p.id === selectedPresetId) || presets[0];

  const handleLaunch = async (presetToLaunch: SwarmPreset) => {
    try {
      await launchSwarmPreset(presetToLaunch, projectPath);
      onClose();
    } catch {
      // O erro é gravado no useSwarmStore para feedback ao utilizador
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="swarm-preset-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-4xl bg-[#1c1c1e] text-white border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${className}`}
      >
        {/* Cabeçalho macOS com SF Pro Display */}
        <div className="h-14 border-b border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#161618]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div>
              <h2
                id="swarm-preset-title"
                className="text-[20px] font-semibold text-white/95 tracking-tight"
              >
                Modelos de Enxame
              </h2>
              <p className="text-[12px] text-white/60">
                Lançamento coordenado de equipas de agentes com papéis especializados
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de modelos de enxame"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mensagem de Erro, se existir */}
        {lastError && (
          <div className="px-6 py-2.5 bg-red-950/60 border-b border-red-500/30 text-red-200 text-[12px] flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="flex-1 font-medium">{lastError}</span>
          </div>
        )}

        {/* Conteúdo com Grelha de Presets & Detalhes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {presets.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              const isActiveSwarm = preset.id === activePresetId;

              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPresetId(preset.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  className={`min-h-[140px] p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/60 ring-2 ring-blue-500/30 shadow-lg'
                      : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-white/10 text-white/80'
                        }`}
                      >
                        {renderPresetIcon(preset.icon)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-white/95 tracking-tight">
                            {preset.name}
                          </h3>
                          {isActiveSwarm && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Ativo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-white/60">
                            Layout {preset.layout}
                          </span>
                          {preset.badge && (
                            <>
                              <span className="text-white/30 text-[10px]">•</span>
                              <span className="text-[11px] text-white/70 font-medium">
                                {preset.badge}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[12px] text-white/70 mt-2 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>

                  {/* Pré-visualização dos Agentes que compõem o modelo */}
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-1.5 items-center">
                    {preset.panels.map((panel) => (
                      <RolePill key={panel.id} panel={panel} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cartão de Detalhe do Modelo Selecionado */}
          {currentPreset && (
            <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-white/80 tracking-wide uppercase">
                  Composição do Enxame ({currentPreset.panels.length} Agentes Especializados)
                </span>
                <span className="text-[11px] text-white/50 font-mono">
                  Grelha {currentPreset.layout}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {currentPreset.panels.map((panel) => {
                  const roleConfig = AGENT_ROLE_MAP[panel.role as AgentRoleType];
                  const colorBadge = COLOR_BADGE_STYLES[panel.color];
                  return (
                    <div
                      key={panel.id}
                      className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[13px] font-medium text-white/90 truncate">
                          {panel.title}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${colorBadge}`}
                        >
                          {roleConfig?.shortLabel || panel.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 line-clamp-2 leading-tight">
                        {panel.initialPrompt || roleConfig?.description || 'Agente pronto.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botão de Ação Apple HIG (mínimo 44x44px) */}
        <div className="h-16 border-t border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#161618]">
          <div className="text-[12px] text-white/60">
            {currentPreset && (
              <span>
                Lançará <strong className="text-white/90">{currentPreset.name}</strong> em layout{' '}
                <strong className="text-white/90 font-mono">{currentPreset.layout}</strong>.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLaunching}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => currentPreset && handleLaunch(currentPreset)}
              disabled={isLaunching || !currentPreset}
              className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/40 shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              {isLaunching ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>A inicializar enxame...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>Lançar Enxame</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwarmPresetSelector;
