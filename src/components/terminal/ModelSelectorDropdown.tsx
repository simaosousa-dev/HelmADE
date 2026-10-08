import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  type AIModelDefinition,
  type CognitiveProfileId,
  COGNITIVE_PROFILES,
  getAllModels,
  getModelById,
} from '../../config/modelCatalog';
import {
  useAgentConfigStore,
  agentConfigStore,
} from '../../stores/useAgentConfigStore';
import { gridLayoutStore } from '../../stores/useGridLayoutStore';
import type { AgentRoleType } from '../../types/terminal';

export interface ModelSelectorDropdownProps {
  panelId: string;
  agentId?: string;
  agentRole?: AgentRoleType | string;
  currentModelId?: string;
  onModelChange?: (modelId: string) => void;
  className?: string;
}

export const PROFILE_COLOR_MAP: Record<
  CognitiveProfileId,
  {
    hex: string;
    dotBg: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    tagLabel: string;
  }
> = {
  'deep-thinking': {
    hex: '#bf5af2',
    dotBg: 'bg-[#bf5af2]',
    badgeBg: 'bg-[#bf5af2]/15',
    badgeText: 'text-[#bf5af2]',
    badgeBorder: 'border-[#bf5af2]/35',
    tagLabel: 'Alta Precisão',
  },
  'fast-economic': {
    hex: '#30d158',
    dotBg: 'bg-[#30d158]',
    badgeBg: 'bg-[#30d158]/15',
    badgeText: 'text-[#30d158]',
    badgeBorder: 'border-[#30d158]/35',
    tagLabel: 'Baixa Latência',
  },
  'research-context': {
    hex: '#0a84ff',
    dotBg: 'bg-[#0a84ff]',
    badgeBg: 'bg-[#0a84ff]/15',
    badgeText: 'text-[#0a84ff]',
    badgeBorder: 'border-[#0a84ff]/35',
    tagLabel: 'Contexto 2M',
  },
  'local-zero-cost': {
    hex: '#ffd60a',
    dotBg: 'bg-[#ffd60a]',
    badgeBg: 'bg-[#ffd60a]/15',
    badgeText: 'text-[#ffd60a]',
    badgeBorder: 'border-[#ffd60a]/35',
    tagLabel: '0.00€ · Offline',
  },
};

export const ModelSelectorDropdown: React.FC<ModelSelectorDropdownProps> = ({
  panelId,
  agentId,
  agentRole,
  currentModelId,
  onModelChange,
  className = '',
}) => {
  const { resolveModelForPanel } = useAgentConfigStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<CognitiveProfileId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolução determinística do modelo ativo
  const activeModel: AIModelDefinition = useMemo(() => {
    if (currentModelId) {
      const explicit = getModelById(currentModelId);
      if (explicit) return explicit;
    }
    return resolveModelForPanel(panelId, agentId, agentRole);
  }, [currentModelId, panelId, agentId, agentRole, resolveModelForPanel]);

  // Fechar dropdown ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const allModels = useMemo(() => getAllModels(), []);

  const filteredModels = useMemo(() => {
    return allModels.filter((model) => {
      const matchesTab = selectedTab === 'all' || model.profile === selectedTab;
      const matchesSearch =
        searchQuery.trim() === '' ||
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [allModels, selectedTab, searchQuery]);

  const handleSelectModel = (modelId: string) => {
    agentConfigStore.setModelForPanel(panelId, modelId);
    gridLayoutStore.updatePanelModel(panelId, modelId);
    onModelChange?.(modelId);
    setIsOpen(false);
  };

  const activeColorInfo = PROFILE_COLOR_MAP[activeModel.profile];

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Botão Gatilho no Cabeçalho (Apple HIG Ergonomics) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Modelo de IA selecionado: ${activeModel.name}. Clique para alterar.`}
        title={`Modelo: ${activeModel.name} (${activeModel.contextWindow} contexto)\nPerfil: ${COGNITIVE_PROFILES[activeModel.profile].label}\nCusto: ${activeModel.costDescription}`}
        className={`h-7 px-2 rounded-md flex items-center gap-1.5 border text-[11px] font-medium tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 ${
          isOpen
            ? 'bg-white/15 text-white border-white/30 shadow-xs'
            : 'bg-[#1c1c1e] text-white/80 hover:text-white hover:bg-white/10 border-white/10 hover:border-white/20'
        }`}
      >
        {/* Ponto indicador de cor do perfil cognitivo */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${activeColorInfo.dotBg} shadow-[0_0_6px_rgba(255,255,255,0.2)]`}
          aria-hidden="true"
        />

        {/* Nome do modelo */}
        <span className="font-medium max-w-[110px] sm:max-w-[130px] truncate text-white/90">
          {activeModel.name}
        </span>

        {/* Badge de Custo / Destaque Local */}
        {activeModel.isLocal ? (
          <span
            className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#ffd60a]/20 text-[#ffd60a] border border-[#ffd60a]/40 font-semibold"
            title="Execução Local Ollama com Custo Zero (0.00€)"
          >
            0.00€
          </span>
        ) : (
          <span
            className={`hidden md:inline-flex text-[9px] px-1 py-0.2 rounded font-mono ${activeColorInfo.badgeBg} ${activeColorInfo.badgeText} border ${activeColorInfo.badgeBorder}`}
          >
            {COGNITIVE_PROFILES[activeModel.profile].shortLabel}
          </span>
        )}

        {/* Ícone Chevron */}
        <svg
          className={`w-3 h-3 text-white/50 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Dropdown de Seleção de Modelo */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Catálogo de Modelos de IA"
          className="absolute left-0 mt-1.5 z-40 w-[340px] sm:w-[380px] rounded-xl bg-[#1c1c1e]/98 border border-white/15 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Cabeçalho do Dropdown */}
          <div className="p-2.5 border-b border-white/10 bg-[#161618]/90">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white/90 tracking-tight flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Perfil Cognitivo & Modelo de IA
              </span>
              <span className="text-[10px] text-white/40 font-mono">
                {allModels.length} modelos
              </span>
            </div>

            {/* Campo de Pesquisa Rápida */}
            <div className="relative">
              <input
                type="text"
                placeholder="Pesquisar modelo ou fornecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-black/50 text-white text-[11px] placeholder:text-white/40 px-2.5 py-1.5 pl-7 rounded-lg border border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <svg
                className="w-3.5 h-3.5 text-white/40 absolute left-2 top-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpar pesquisa"
                  className="absolute right-2 top-1.5 text-white/40 hover:text-white text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Separadores dos Perfis Cognitivos */}
            <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedTab('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-tight whitespace-nowrap transition-colors ${
                  selectedTab === 'all'
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                Todos ({allModels.length})
              </button>
              {(
                [
                  'deep-thinking',
                  'fast-economic',
                  'research-context',
                  'local-zero-cost',
                ] as CognitiveProfileId[]
              ).map((profId) => {
                const prof = COGNITIVE_PROFILES[profId];
                const colorInfo = PROFILE_COLOR_MAP[profId];
                const isTabActive = selectedTab === profId;
                return (
                  <button
                    key={profId}
                    type="button"
                    onClick={() => setSelectedTab(profId)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium tracking-tight whitespace-nowrap transition-colors ${
                      isTabActive
                        ? `${colorInfo.badgeBg} ${colorInfo.badgeText} border ${colorInfo.badgeBorder}`
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${colorInfo.dotBg}`} />
                    <span>{prof.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Modelos Filtrados */}
          <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-1">
            {filteredModels.length === 0 ? (
              <div className="py-6 text-center text-white/40 text-[11px]">
                Nenhum modelo encontrado para o critério selecionado.
              </div>
            ) : (
              filteredModels.map((model) => {
                const isSelected = model.id === activeModel.id;
                const colorInfo = PROFILE_COLOR_MAP[model.profile];
                const profileObj = COGNITIVE_PROFILES[model.profile];

                return (
                  <button
                    key={model.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectModel(model.id)}
                    className={`w-full text-left p-2 rounded-lg transition-all duration-100 flex items-start justify-between gap-2 border ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500/50 ring-1 ring-blue-500/30'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] border-transparent hover:border-white/10'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Dot de Perfil */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${colorInfo.dotBg}`}
                          aria-hidden="true"
                        />

                        {/* Nome do Modelo */}
                        <span className="text-[12px] font-semibold text-white/95 tracking-tight truncate">
                          {model.name}
                        </span>

                        {/* Badge de Contexto */}
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-white/70">
                          {model.contextWindow}
                        </span>

                        {/* Badge 0.00€ se Local */}
                        {model.isLocal && (
                          <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-[#ffd60a]/20 text-[#ffd60a] border border-[#ffd60a]/30">
                            0.00€ Local
                          </span>
                        )}
                      </div>

                      {/* Descrição Curta */}
                      <p className="text-[10px] text-white/60 line-clamp-1 mt-0.5 leading-snug">
                        {model.description}
                      </p>

                      {/* Metadados: Provedor + Perfil Cognitivo */}
                      <div className="flex items-center gap-2 mt-1 text-[9px] text-white/40">
                        <span className="uppercase tracking-wider font-mono text-white/50">
                          {model.provider}
                        </span>
                        <span>•</span>
                        <span className={colorInfo.badgeText}>
                          {profileObj.shortLabel}
                        </span>
                        <span>•</span>
                        <span>{model.costDescription}</span>
                      </div>
                    </div>

                    {/* Checkmark Ativo */}
                    {isSelected && (
                      <span className="text-blue-400 font-bold text-sm shrink-0 mt-0.5">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Rodapé Informativo */}
          <div className="p-2 border-t border-white/10 bg-[#161618] flex items-center justify-between text-[10px] text-white/50">
            <span>
              Atribuído a: <strong className="text-white/80">{panelId}</strong>
            </span>
            {activeModel.isLocal ? (
              <span className="text-[#ffd60a] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffd60a]" />
                Privacidade Total & Sem Custos
              </span>
            ) : (
              <span className="text-white/60">
                Nuvem ({activeModel.provider})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelectorDropdown;
