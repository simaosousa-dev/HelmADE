import { useState, useEffect } from 'react';
import { WelcomeView } from './views/WelcomeView';
import { MergeReviewView } from './views/MergeReviewView';
import { TiledTerminalGrid, GridLayoutControls, useGridLayoutStore } from './components/grid';
import { SwarmPresetSelector } from './components/swarm';
import { TeamWire } from './components/a2a';
import { PromptInput } from './components/teamwire';
import { LiveBrowserDock } from './components/preview';
import { useA2AStore } from './stores/useA2AStore';
import { useAutoPortDetection } from './hooks/useAutoPortDetection';
import type { Project } from './types/project';

export default function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [reviewingSwarmId, setReviewingSwarmId] = useState<string | null>(null);
  const [isSwarmSelectorOpen, setIsSwarmSelectorOpen] = useState(false);
  const { panels, setActivePanelId } = useGridLayoutStore();
  const { isWireOpen, toggleWire, setPeers } = useA2AStore();
  const {
    isOpen: isPreviewOpen,
    toggleOpen: togglePreview,
    servers: previewServers,
  } = useAutoPortDetection();

  // Sincronizar pares (peers) do enxame com base nos painéis ativos da grelha
  useEffect(() => {
    const peers = panels.map((p) => ({
      id: p.agentId || p.id,
      name: p.title,
      role: p.agentRole,
      status: p.status,
      sessionId: p.sessionId,
    }));
    setPeers(peers);
  }, [panels, setPeers]);

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
          {/* Botão de Alternância do Live Preview Webview (Issue #50) */}
          <button
            type="button"
            onClick={() => togglePreview()}
            className={`min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-[12px] font-semibold border shadow-sm transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none ${
              isPreviewOpen
                ? 'bg-emerald-600/30 border-emerald-400/50 text-emerald-200'
                : 'bg-white/[0.05] hover:bg-white/10 text-white/85 border-white/10 hover:border-white/20'
            }`}
            title="Alternar painel Live Preview dockado de servidores web"
            aria-pressed={isPreviewOpen}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
            <span>Live Preview</span>
            {previewServers.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/25 border border-emerald-400/30 text-emerald-300">
                {previewServers.length}
              </span>
            )}
          </button>

          {/* Botão de Alternância do Team Wire */}
          <button
            type="button"
            onClick={() => toggleWire()}
            className={`min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-[12px] font-semibold border shadow-sm transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none ${
              isWireOpen
                ? 'bg-cyan-600/30 border-cyan-400/50 text-cyan-200'
                : 'bg-white/[0.05] hover:bg-white/10 text-white/85 border-white/10 hover:border-white/20'
            }`}
            title="Alternar painel Team Wire de comunicação inter-agentes"
            aria-pressed={isWireOpen}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>Team Wire</span>
          </button>

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

      {/* Espaço de Trabalho Principal: Grelha Tiled de Terminais Vivos + Prompt Primário + Live Preview Dockada + Team Wire Dockado */}
      <main className="flex-1 min-h-0 relative flex bg-[#121214] overflow-hidden">
        <div className="flex-1 min-w-0 h-full p-2 flex flex-col gap-2">
          <div className="flex-1 min-h-0">
            <TiledTerminalGrid
              className="w-full h-full"
              onAddPanel={() => setIsSwarmSelectorOpen(true)}
            />
          </div>

          {/* Barra de Prompt Primário do Orquestrador & Modo Broadcast (Issue #48) */}
          <div className="shrink-0 z-10">
            <PromptInput variant="global" />
          </div>
        </div>

        {/* Painel Live Preview Webview Dockado (Issue #50) */}
        {isPreviewOpen && (
          <div className="w-96 lg:w-[460px] xl:w-[520px] h-full shrink-0 z-10 animate-in slide-in-from-right duration-200">
            <LiveBrowserDock className="w-full h-full" />
          </div>
        )}

        {/* Painel Team Wire (R5.3) */}
        {isWireOpen && (
          <div className="w-80 sm:w-96 h-full shrink-0 z-10 animate-in slide-in-from-right duration-200">
            <TeamWire
              className="w-full h-full"
              onFocusAgent={(agentId) => {
                const targetPanel = panels.find(
                  (p) => p.agentId === agentId || p.id === agentId
                );
                if (targetPanel) {
                  setActivePanelId(targetPanel.id);
                }
              }}
            />
          </div>
        )}
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
