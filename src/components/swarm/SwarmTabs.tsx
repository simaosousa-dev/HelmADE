import { useState } from 'react';
import { swarmStore, useSwarmStore } from '../../stores/useSwarmStore';
import { useTerminalStore } from '../../stores/useTerminalStore';

export interface SwarmTabsProps {
  onNewSwarm: () => void;
  onCloseSwarm: (swarmId: string) => void;
}

/** One tab per swarm of the project, with a badge when an agent is waiting for the human. */
export function SwarmTabs({ onNewSwarm, onCloseSwarm }: SwarmTabsProps) {
  const { swarms, activeSwarmId } = useSwarmStore();
  const { blockedPrompts } = useTerminalStore();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const commitRename = () => {
    const name = draftName.trim();
    if (renamingId && name) swarmStore.updateSwarm(renamingId, { name });
    setRenamingId(null);
  };

  return (
    <div className="flex h-11 shrink-0 items-stretch border-b border-separator bg-sunken/60" data-testid="swarm-tabs">
      <div role="tablist" aria-label="Enxames do projeto" className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {swarms.map((swarm, index) => {
          const isActive = swarm.id === activeSwarmId;
          const blocked = swarm.panels.filter((panel) => blockedPrompts[panel.worktreeId]).length;
          return (
            <div
              key={swarm.id}
              className={`group flex min-w-[150px] max-w-[260px] items-stretch border-r border-separator ${
                isActive ? 'bg-surface text-fg' : 'text-fg-muted hover:bg-fill'
              }`}
            >
              {renamingId === swarm.id ? (
                <input
                  autoFocus
                  value={draftName}
                  maxLength={60}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  aria-label="Nome do enxame"
                  className="min-w-0 flex-1 bg-transparent px-3 text-body text-fg"
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => swarmStore.setActiveSwarm(swarm.id)}
                  onDoubleClick={() => {
                    setDraftName(swarm.name);
                    setRenamingId(swarm.id);
                  }}
                  title={`${swarm.name} · ${swarm.panels.length} painéis · ⌘${index + 1} (duplo clique para renomear)`}
                  data-testid={`swarm-tab-${swarm.id}`}
                  className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 px-3 text-left text-body font-medium"
                >
                  <span className="truncate">{swarm.name}</span>
                  <span className="shrink-0 text-caption2 text-fg-subtle">{swarm.panels.length}</span>
                  {blocked > 0 && (
                    <span
                      aria-label={`${blocked} agente(s) à espera de resposta`}
                      data-testid={`swarm-tab-attention-${swarm.id}`}
                      className="shrink-0 animate-pulse rounded-full bg-warning px-1.5 text-caption2 font-bold text-window"
                    >
                      {blocked}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => onCloseSwarm(swarm.id)}
                aria-label={`Fechar o enxame ${swarm.name}`}
                data-testid={`swarm-tab-close-${swarm.id}`}
                className="flex min-h-[44px] w-9 shrink-0 items-center justify-center text-fg-subtle hover:bg-fill-strong hover:text-fg"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onNewSwarm}
        title="Novo enxame (⌘T)"
        aria-label="Novo enxame"
        data-testid="swarm-tab-new"
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border-l border-separator text-fg-muted hover:bg-fill hover:text-fg"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
