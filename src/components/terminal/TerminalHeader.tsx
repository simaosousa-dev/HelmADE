import React, { useState, useRef, useEffect } from 'react';
import type {
  TerminalStatus,
  TerminalPanelColor,
  AgentRoleType,
} from '../../types/terminal';
import { AGENT_ROLE_MAP } from '../../types/terminal';
import {
  TerminalStatusBadge,
  TerminalColorBadge,
  COLOR_CONFIGS,
} from './TerminalStatusBadge';
import { A2AExchangeIndicator } from '../a2a/A2AExchangeIndicator';
import { ModelSelectorDropdown } from './ModelSelectorDropdown';
import { agentConfigStore } from '../../stores/useAgentConfigStore';
import { gridLayoutStore } from '../../stores/useGridLayoutStore';

export interface TerminalHeaderProps {
  id: string;
  title: string;
  sessionId: string;
  agentId?: string;
  agentRole?: AgentRoleType | string;
  color?: TerminalPanelColor;
  status?: TerminalStatus;
  modelId?: string;
  onModelChange?: (modelId: string) => void;
  isA2AActive?: boolean;
  isActive?: boolean;
  isMaximized?: boolean;
  onTitleChange?: (newTitle: string) => void;
  onColorChange?: (newColor: TerminalPanelColor) => void;
  onStatusChange?: (newStatus: TerminalStatus) => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  className?: string;
}

const AVAILABLE_COLORS: TerminalPanelColor[] = ['gold', 'blue', 'green', 'purple', 'red'];

/**
 * Renderiza o ícone SVG correspondente ao papel especializado do agente.
 */
function renderAgentRoleIcon(role?: string): React.ReactNode {
  switch (role) {
    case 'architect':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          />
        </svg>
      );
    case 'fullstack':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      );
    case 'frontend':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
    case 'apple-hig':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    case 'database':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      );
    case 'qa-security':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
    case 'devops':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );
    case 'system':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14M12 5l7 7-7 7"
          />
        </svg>
      );
  }
}

/**
 * Cabeçalho Semântico do Painel de Terminal (Apple HIG)
 * 
 * Funcionalidades:
 * - Altura h-11 (44px) com transparência e vibração nativa macOS.
 * - Título editável em linha com atalhos de teclado (Enter para guardar, Escape para cancelar).
 * - Ícone semântico do papel do agente.
 * - Distintivo de cor semântica configurável (Dourado, Azul, Verde, Roxo, Vermelho).
 * - Seletor de Modelo de IA por Agente com perfis cognitivos.
 * - Distintivo de estado reativo com indicador luminoso pulsante para estado ativo.
 * - Alvos táteis ergonómicos com no mínimo 44x44px nos botões de maximizar e fechar.
 * - Suporte a duplo clique para maximizar/restaurar.
 */
export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  id,
  title,
  sessionId,
  agentId,
  agentRole,
  color = 'blue',
  status = 'idle',
  modelId,
  onModelChange,
  isA2AActive = false,
  isActive = false,
  isMaximized = false,
  onTitleChange,
  onColorChange,
  onStatusChange,
  onToggleMaximize,
  onClose,
  className = '',
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  // Sincronizar título recebido por props quando não estiver em edição
  useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(title);
    }
  }, [title, isEditingTitle]);

  // Foco automático e seleção do texto quando entra em modo de edição
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  // Fechar menu de cores ao clicar fora ou premir Escape
  useEffect(() => {
    if (!isColorMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) {
        setIsColorMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsColorMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isColorMenuOpen]);

  const commitTitle = () => {
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange?.(trimmed);
    } else {
      setEditedTitle(title);
    }
    setIsEditingTitle(false);
  };

  const cancelTitle = () => {
    setEditedTitle(title);
    setIsEditingTitle(false);
  };

  const handleInternalModelChange = (newModelId: string) => {
    agentConfigStore.setModelForPanel(id, newModelId);
    gridLayoutStore.updatePanelModel(id, newModelId);
    onModelChange?.(newModelId);
  };

  const roleConfig = agentRole && agentRole in AGENT_ROLE_MAP
    ? AGENT_ROLE_MAP[agentRole as AgentRoleType]
    : undefined;

  const roleLabel = roleConfig?.label ?? agentRole ?? 'Terminal';

  return (
    <header
      data-testid={`terminal-header-${id}`}
      data-session-id={sessionId}
      onDoubleClick={() => onToggleMaximize?.()}
      className={`h-11 px-3 flex items-center justify-between border-b select-none transition-colors duration-150 cursor-pointer backdrop-blur-md ${
        isActive
          ? 'bg-[#1e222b]/95 border-blue-500/35 text-white shadow-xs'
          : 'bg-[#161618]/90 border-white/10 text-white/75 hover:text-white'
      } ${className}`}
    >
      {/* Área Esquerda: Papel do Agente, Título Editável, Seletor de Modelo e Badges */}
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        {/* Ícone e Tooltip do Papel do Agente */}
        <div
          title={`Papel: ${roleLabel}${roleConfig?.description ? ` — ${roleConfig.description}` : ''}`}
          aria-label={`Papel do agente: ${roleLabel}`}
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
            isActive
              ? 'bg-white/10 text-white border-white/20'
              : 'bg-white/5 text-white/60 border-white/10'
          }`}
        >
          {renderAgentRoleIcon(agentRole)}
        </div>

        {/* Título Inline Editável */}
        <div
          className="min-w-0 max-w-[160px] sm:max-w-[220px]"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {isEditingTitle ? (
            <input
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTitle();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelTitle();
                }
              }}
              onBlur={commitTitle}
              aria-label="Editar título do terminal"
              className="w-full bg-black/60 text-white text-[12px] font-medium tracking-tight px-1.5 py-0.5 rounded border border-blue-500/70 focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              title="Clique para editar o título"
              aria-label={`Título do terminal: ${title}. Clique para editar`}
              className="group flex items-center gap-1.5 text-left text-[12px] font-medium tracking-tight truncate rounded px-1 -mx-1 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue"
            >
              <span className="truncate">{title}</span>
              <svg
                className="w-3 h-3 opacity-0 group-hover:opacity-60 text-white transition-opacity shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Distintivo de ID do Agente (se configurado) */}
        {agentId && (
          <span
            title={`ID do Agente: ${agentId}`}
            className="hidden lg:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 font-mono shrink-0 select-none"
          >
            {agentId}
          </span>
        )}

        {/* Seletor / Distintivo de Cor Semântica (Apple HIG) */}
        <div
          ref={colorMenuRef}
          className="relative shrink-0"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setIsColorMenuOpen((prev) => !prev)}
            title={`Cor semântica: ${COLOR_CONFIGS[color]?.label ?? color} (clique para alterar)`}
            aria-label="Alterar cor semântica do painel"
            aria-expanded={isColorMenuOpen}
            className="flex items-center justify-center p-1 rounded-md hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue"
          >
            <TerminalColorBadge color={color} size="sm" />
          </button>

          {/* Menu Dropdown de Seleção de Cor */}
          {isColorMenuOpen && (
            <div
              role="menu"
              aria-label="Selecionar cor do painel"
              className="absolute left-0 mt-1.5 z-30 p-1.5 rounded-xl bg-[#1c1c1e] border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col gap-1 min-w-[120px]"
            >
              <div className="text-[10px] font-semibold text-white/50 px-2 py-0.5 uppercase tracking-wider">
                Cor do Painel
              </div>
              {AVAILABLE_COLORS.map((c) => {
                const cfg = COLOR_CONFIGS[c];
                const isSelected = c === color;
                return (
                  <button
                    key={c}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onColorChange?.(c);
                      setIsColorMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] font-medium tracking-tight transition-colors text-left ${
                      isSelected
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor} ${cfg.glowColor}`}
                      aria-hidden="true"
                    />
                    <span>{cfg.label}</span>
                    {isSelected && (
                      <span className="ml-auto text-blue-400 font-bold">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Seletor Interativo de Modelo de IA & Perfil Cognitivo */}
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <ModelSelectorDropdown
            panelId={id}
            agentId={agentId}
            agentRole={agentRole}
            currentModelId={modelId}
            onModelChange={handleInternalModelChange}
          />
        </div>

        {/* Indicador de Troca Inter-Agentes A2A */}
        {isA2AActive && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            <A2AExchangeIndicator isExchanging={true} agentName={title} size="sm" />
          </div>
        )}

        {/* Distintivo de Estado Reativo (Apple HIG) */}
        <div className="shrink-0" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <TerminalStatusBadge
            status={status}
            size="sm"
            onClick={
              onStatusChange
                ? () => {
                    const nextStatus: Record<TerminalStatus, TerminalStatus> = {
                      running: 'completed',
                      active: 'completed',
                      idle: 'running',
                      waiting: 'running',
                      completed: 'idle',
                      error: 'idle',
                      standby: 'running',
                      blocked: 'running',
                    };
                    onStatusChange(nextStatus[status] ?? 'idle');
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* Área Direita: Botões de Ação Ergonómicos (Mínimo 44x44px) */}
      <div
        className="flex items-center gap-0.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Botão Maximizar / Restaurar (Footprint >= 44x44px) */}
        <button
          type="button"
          onClick={() => onToggleMaximize?.()}
          title={
            isMaximized
              ? 'Restaurar tamanho do painel (⌘↵)'
              : 'Maximizar painel (⌘↵)'
          }
          aria-label={
            isMaximized
              ? 'Restaurar tamanho do painel'
              : 'Maximizar painel'
          }
          aria-pressed={isMaximized}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/60 hover:text-white rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
        >
          {isMaximized ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 9L4 4m0 0h4m-4 0v4m6 6l5 5m0 0h-4m4 0v-4M9 15l-5 5m0 0h4m-4 0v-4m11-6l5-5m0 0h-4m4 0v4"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          )}
        </button>

        {/* Botão Fechar Painel (Footprint >= 44x44px) */}
        <button
          type="button"
          onClick={() => onClose?.()}
          title="Fechar painel de terminal"
          aria-label="Fechar painel de terminal"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/60 hover:text-red-400 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default TerminalHeader;
