import { useState } from 'react';
import { WelcomeView } from './views/WelcomeView';
import { MergeReviewView } from './views/MergeReviewView';
import { TiledTerminalGrid, GridLayoutControls, useGridLayoutStore } from './components/grid';
import { SwarmPresetSelector } from './components/swarm';
import type { Project } from './types/project';

export default function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [reviewingSwarmId, setReviewingSwarmId] = useState<string | null>(null);
  const [isSwarmSelectorOpen, setIsSwarmSelectorOpen] = useState(false);
  const { panels } = useGridLayoutStore();

  if (!activeProject) {
    return <WelcomeView onOpenProject={(proj) => setActiveProject(proj)} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1c1c1e] text-white select-none overflow-hidden">
      {/* Barra de Título Superior Apple HIG com Materiais Translúcidos */}
      <header
        data-tauri-drag-region
        className="h-14 border-b border-white/10 flex items-center justify-between px-4 pl-20 bg-[#161618] shrink-0 z-10"
      >
        {/* Identificação do Projeto */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-[14px] text-white/95 truncate">
            {activeProject.name}
          </span>
          <span className="text-[11px] text-white/50 font-mono truncate max-w-xs hidden md:inline">
            {activeProject.path}
          </span>
        </div>

        {/* Controlos de Layout de Grelha (Centro) */}
        {panels.length > 0 && (
          <div className="hidden lg:flex items-center">
            <GridLayoutControls />
          </div>
        )}

        {/* Ações Rápidas do Cockpit (Direita) */}
        <div className="flex items-center gap-2">
          {/* Botão de Lançamento de Modelos de Enxame (1 Clique) */}
          <button
            type="button"
            onClick={() => setIsSwarmSelectorOpen(true)}
            className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-[12px] font-semibold border border-blue-400/40 shadow-sm transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            title="Abrir catálogo de modelos de enxame pré-configurados"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <span>Modelos de Enxame</span>
          </button>

          {/* Botão de Revisão e Fusão Git Worktree */}
          <button
            type="button"
            onClick={() => setReviewingSwarmId('1')}
            className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/85 border border-white/10 hover:border-white/20 transition-all text-[12px] font-medium flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            title="Rever alterações do enxame atual e fundir para a branch principal"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="hidden sm:inline">Rever & Fundir</span>
          </button>

          {/* Voltar ao Seletor de Projetos */}
          <button
            type="button"
            onClick={() => {
              setActiveProject(null);
              setReviewingSwarmId(null);
            }}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/10 text-white/70 hover:text-white transition-all text-[12px] font-medium border border-white/5 hover:border-white/15 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            title="Voltar ao ecrã inicial"
          >
            Início
          </button>
        </div>
      </header>

      {/* Espaço de Trabalho Principal: Grelha Tiled de Terminais Vivos */}
      <main className="flex-1 min-h-0 relative p-2 bg-[#121214]">
        <TiledTerminalGrid
          className="w-full h-full"
          onAddPanel={() => setIsSwarmSelectorOpen(true)}
        />
      </main>

      {/* Seletor Modal de Modelos de Enxame (Swarm Presets) */}
      <SwarmPresetSelector
        isOpen={isSwarmSelectorOpen}
        onClose={() => setIsSwarmSelectorOpen(false)}
        projectPath={activeProject.path}
      />

      {/* Modal de Revisão & Fusão Git Worktree */}
      {reviewingSwarmId && (
        <MergeReviewView
          repoPath={activeProject.path}
          swarmId={reviewingSwarmId}
          onClose={() => setReviewingSwarmId(null)}
          onMergeSuccess={(sha) => {
            console.log('Merge concluído com sucesso, SHA:', sha);
          }}
        />
      )}
    </div>
  );
}
