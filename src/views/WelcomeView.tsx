import React, { useState, useCallback } from 'react';
import { useProjects } from '../hooks/useProjects';
import { ProjectList } from '../components/ProjectList';
import type { Project } from '../types/project';

interface WelcomeViewProps {
  onOpenProject?: (project: Project) => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onOpenProject }) => {
  const {
    projects,
    loading,
    selectFolderAndOpen,
    addProjectByPath,
    removeProject,
  } = useProjects();

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleSelectProject = useCallback(
    (project: Project) => {
      if (onOpenProject) {
        onOpenProject(project);
      } else {
        console.log('Projeto selecionado:', project);
      }
    },
    [onOpenProject]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      // Em ambientes desktop (Tauri/Electron), o path completo do ficheiro ou pasta está disponível
      const fullPath = (firstFile as unknown as { path?: string }).path;
      if (fullPath) {
        const proj = await addProjectByPath(fullPath, firstFile.name);
        handleSelectProject(proj);
      }
    }
  };

  const handleOpenFolder = async () => {
    const proj = await selectFolderAndOpen();
    if (proj) {
      handleSelectProject(proj);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#161618] text-white select-none"
    >
      {/* Barra de Título Arrastável (macOS Traffic Lights Area) */}
      <header
        data-tauri-drag-region
        className="h-10 w-full flex items-center justify-between px-5 shrink-0 border-b border-white/[0.08] bg-[#1a1a1c]"
      >
        <div className="flex items-center gap-2 pl-20">
          <span className="text-[11px] font-semibold tracking-wider text-white/50 uppercase">
            HelmADE Cockpit
          </span>
        </div>
        <div className="text-[11px] text-white/40 font-mono">
          HelmADE · v1.0.0
        </div>
      </header>

      {/* Conteúdo Principal Dividido em Duas Colunas */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-6 md:p-8 gap-8 max-w-6xl w-full mx-auto">
        {/* Coluna Esquerda: Identidade & Ações Primárias */}
        <section className="flex flex-col justify-between md:w-1/2 space-y-6">
          <div className="space-y-4">
            {/* Logótipo / Identidade Profissional */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-[12px] bg-[#222226] border border-white/12 shadow-sm text-[#0a84ff] shrink-0">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="5" r="3" />
                  <line x1="12" y1="22" x2="12" y2="8" />
                  <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white font-sf">
                  HelmADE
                </h1>
                <p className="text-[12px] text-white/60 tracking-normal">
                  Ambiente de Desenvolvimento para Enxames de Agentes
                </p>
              </div>
            </div>

            {/* Badges Funcionais de Engenharia */}
            <div className="flex flex-wrap gap-2 pt-1" aria-label="Capacidades da plataforma">
              <span className="px-2.5 py-1 rounded-[6px] text-[11px] font-medium bg-[#0a84ff]/10 text-[#0a84ff] border border-[#0a84ff]/25">
                Git Worktrees Isolados
              </span>
              <span className="px-2.5 py-1 rounded-[6px] text-[11px] font-medium bg-white/[0.06] text-white/80 border border-white/10">
                Terminais Concorrentes
              </span>
              <span className="px-2.5 py-1 rounded-[6px] text-[11px] font-medium bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/25">
                Persistência SQLite Local
              </span>
            </div>

            {/* Texto Descritivo Direto e Funcional */}
            <p className="text-[13px] text-white/70 leading-relaxed max-w-md">
              Ambiente de desenvolvimento para coordenação de agentes com terminais
              concorrentes e isolamento por Git Worktree.
            </p>
          </div>

          {/* Área de Drag & Drop & Botões de Ação */}
          <div className="space-y-3">
            {/* Dropzone com Feedback Visual e Contraste Sólido */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Arrastar pasta de projeto ou clicar para selecionar"
              className={`flex flex-col items-center justify-center p-6 rounded-[12px] border-2 border-dashed transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] ${
                isDraggingOver
                  ? 'border-[#0a84ff] bg-[#0a84ff]/10 scale-[1.01]'
                  : 'border-white/15 bg-[#1c1c1e] hover:border-white/30 hover:bg-[#202024]'
              }`}
              onClick={handleOpenFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleOpenFolder();
                }
              }}
            >
              <svg
                className={`w-8 h-8 mb-2 transition-colors ${
                  isDraggingOver ? 'text-[#0a84ff]' : 'text-white/45'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-[13px] font-medium text-white/90">
                {isDraggingOver
                  ? 'Solte a pasta para abrir'
                  : 'Arrastar pasta do projeto para aqui'}
              </span>
              <span className="text-[11px] text-white/40 mt-1">
                ou clique para selecionar no Explorador
              </span>
            </div>

            {/* Botões de Ação com Touch Target Apple HIG (mínimo 44x44px) */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleOpenFolder}
                className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#0a84ff] hover:bg-[#0071e3] active:bg-[#0062c4] text-white text-[13px] font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <span>Abrir Pasta Local...</span>
              </button>

              <button
                type="button"
                onClick={handleOpenFolder}
                className="min-h-[44px] px-5 py-2.5 flex items-center justify-center gap-2 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] border border-white/10 text-white/90 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:outline-none"
              >
                <svg
                  className="w-4 h-4 shrink-0 text-white/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Novo Projeto</span>
              </button>
            </div>
          </div>
        </section>

        {/* Coluna Direita: Projetos Recentes */}
        <section className="flex flex-col md:w-1/2 p-5 rounded-[14px] bg-[#1c1c1e] border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h2 className="text-[14px] font-semibold text-white/90 tracking-tight">
              Projetos Recentes
            </h2>
            <span className="text-[11px] text-white/40">
              {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'}
            </span>
          </div>

          <ProjectList
            projects={projects}
            loading={loading}
            onSelectProject={handleSelectProject}
            onRemoveProject={(id, e) => {
              e.stopPropagation();
              removeProject(id);
            }}
            onOpenFolderDialog={handleOpenFolder}
          />
        </section>
      </main>
    </div>
  );
};

export default WelcomeView;
