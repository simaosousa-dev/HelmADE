import React, { useEffect, useState } from 'react';
import { useGitDiff } from '../hooks/useGitDiff';
import { DiffViewer } from '../components/DiffViewer';
import { MergeConflictResolver } from '../components/MergeConflictResolver';
import type { MergeStrategy } from '../types/diff';
import type { Swarm, SwarmPanel } from '../types/swarm';

interface MergeReviewViewProps {
  repoPath: string;
  /** Swarm under review: every agent has its own branch to inspect and merge. */
  swarm: Swarm;
  /** Agent shown first (defaults to the first panel). */
  initialSessionId?: string | null;
  onClose: () => void;
  /** Called after an agent's branch was integrated into the base branch. */
  onMerged?: (panel: SwarmPanel, commitSha: string) => void;
  /** Asks the swarm's orchestrator to resolve the conflicts of an agent's branch. */
  onDelegateConflicts?: (panel: SwarmPanel, conflicts: string[]) => void;
}

/**
 * Review of a swarm: pick an agent, inspect what it changed relative to the base branch
 * (uncommitted work included) and merge it.
 */
export const MergeReviewView: React.FC<MergeReviewViewProps> = ({
  repoPath,
  swarm,
  initialSessionId,
  onClose,
  onMerged,
  onDelegateConflicts,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSessionId ?? swarm.panels[0]?.worktreeId ?? null
  );
  const panel = swarm.panels.find((p) => p.worktreeId === selectedId) ?? swarm.panels[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!panel) return null;

  const agentTabs = (
    <div
      role="tablist"
      aria-label="Agentes do enxame"
      className="flex items-center gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10 max-w-[46vw] overflow-x-auto"
    >
      {swarm.panels.map((p) => (
        <button
          key={p.worktreeId}
          type="button"
          role="tab"
          aria-selected={p.worktreeId === panel.worktreeId}
          onClick={() => setSelectedId(p.worktreeId)}
          data-testid={`review-agent-${p.key}`}
          className={`min-h-[44px] px-3 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none ${
            p.worktreeId === panel.worktreeId
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          {p.title}
        </button>
      ))}
    </div>
  );

  return (
    <AgentReview
      key={panel.worktreeId}
      repoPath={repoPath}
      panel={panel}
      baseBranch={swarm.baseBranch}
      agentTabs={agentTabs}
      onClose={onClose}
      onMerged={onMerged}
      onDelegateConflicts={onDelegateConflicts}
    />
  );
};

interface AgentReviewProps {
  repoPath: string;
  panel: SwarmPanel;
  baseBranch: string;
  agentTabs: React.ReactNode;
  onClose: () => void;
  onMerged?: (panel: SwarmPanel, commitSha: string) => void;
  onDelegateConflicts?: (panel: SwarmPanel, conflicts: string[]) => void;
}

const AgentReview: React.FC<AgentReviewProps> = ({
  repoPath,
  panel,
  baseBranch,
  agentTabs,
  onClose,
  onMerged,
  onDelegateConflicts,
}) => {
  const {
    loading,
    error,
    summary,
    selectedFile,
    fileDetail,
    loadingFile,
    merging,
    mergeResult,
    selectFile,
    refresh,
    executeMerge,
    abortMerge,
  } = useGitDiff(repoPath, panel.worktreeId, baseBranch);

  const [strategy, setStrategy] = useState<MergeStrategy>('squash');
  const [commitMessage, setCommitMessage] = useState<string>(
    `feat(swarm): integrate changes from ${panel.key}`
  );
  const [successSha, setSuccessSha] = useState<string | null>(null);

  const handleConfirmMerge = async () => {
    const res = await executeMerge(strategy, commitMessage);
    if (res.success && res.commit_sha) {
      setSuccessSha(res.commit_sha);
      onMerged?.(panel, res.commit_sha);
    }
  };

  const handleDelegateToOrchestrator = () => {
    onDelegateConflicts?.(panel, mergeResult?.conflicts ?? []);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisão e fusão"
      data-testid="merge-review"
      className="fixed inset-0 z-50 flex flex-col bg-[#161618] text-white select-none animate-in fade-in duration-200"
    >
      {/* Barra de Título e Navegação Superior */}
      <div
        data-tauri-drag-region
        className="h-14 border-b border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#1a1a1c]"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 -ml-2 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar (Esc)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div>
            <h1 className="text-[17px] font-semibold text-white tracking-tight flex items-center gap-2">
              Revisão e Fusão Segura
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Git Worktree
              </span>
            </h1>
          </div>
        </div>

        {/* Informações da Branch e Estatísticas */}
        <div className="flex items-center gap-4">
          {agentTabs}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] font-mono">
            <span className="text-white/60">Origem:</span>
            <span className="text-blue-400 font-medium" data-testid="review-branch">{panel.branch}</span>
            <span className="text-white/30">➔</span>
            <span className="text-white/60">Destino:</span>
            <span className="text-emerald-400 font-medium">{baseBranch}</span>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Atualizar Diff"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="flex-1 flex flex-col p-6 min-h-0 overflow-hidden">
        {/* Notificação de Sucesso */}
        {successSha && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-emerald-300">
                  Fusão Concluída com Sucesso!
                </p>
                <p className="text-[12px] text-emerald-400/80 font-mono mt-0.5" data-testid="merge-success">
                  Commit integrado em {baseBranch}: {successSha.substring(0, 10)} · worktree e branch do agente removidos
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[13px] transition-colors"
            >
              Fechar Revisão
            </button>
          </div>
        )}

        {/* Notificação de Conflitos se houver */}
        {mergeResult && !mergeResult.success && (
          <MergeConflictResolver
            conflicts={mergeResult.conflicts}
            errorMessage={mergeResult.message}
            onDelegateToOrchestrator={handleDelegateToOrchestrator}
            onAbort={abortMerge}
          />
        )}

        {/* Erro Geral se houver */}
        {error && !mergeResult && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[13px]">
            {error}
          </div>
        )}

        {/* Visualizador de Diff */}
        <DiffViewer
          summary={summary}
          selectedFile={selectedFile}
          fileDetail={fileDetail}
          loading={loading}
          loadingFile={loadingFile}
          onSelectFile={selectFile}
        />
      </div>

      {/* Barra de Ações e Rodapé */}
      <div className="h-20 border-t border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#1a1a1c]">
        <div className="flex items-center gap-6">
          {/* Seletor de Estratégia de Merge */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
              Estratégia de Fusão
            </span>
            <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setStrategy('squash')}
                className={`px-3 py-1.5 min-h-[36px] rounded-md text-[12px] font-medium transition-colors ${
                  strategy === 'squash'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Squash & Merge
              </button>
              <button
                type="button"
                onClick={() => setStrategy('rebase')}
                className={`px-3 py-1.5 min-h-[36px] rounded-md text-[12px] font-medium transition-colors ${
                  strategy === 'rebase'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Rebase Merge
              </button>
            </div>
          </div>

          {/* Mensagem de Commit Convencional (visível em Squash) */}
          {strategy === 'squash' && (
            <div className="flex flex-col gap-1 w-96">
              <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Mensagem do Commit (Conventional Commit)
              </span>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="feat(swarm): mensagem explicativa"
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white focus:outline-none focus:border-blue-500 font-mono transition-colors"
              />
            </div>
          )}
        </div>

        {/* Botões de Ação Primária */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-white/10 hover:bg-white/15 text-white/80 font-medium text-[13px] transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmMerge}
            data-testid="confirm-merge"
            disabled={merging || loading || !summary || summary.files.length === 0 || !!successSha}
            className={`px-5 py-2 min-h-[44px] rounded-lg font-medium text-[13px] shadow transition-all flex items-center gap-2 ${
              merging || loading || !summary || summary.files.length === 0 || !!successSha
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {merging ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                A fundir alterações...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirmar Fusão Segura
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
