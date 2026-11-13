import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeamWire } from './components/a2a';
import { GridLayoutControls, TiledTerminalGrid } from './components/grid';
import { LiveBrowserDock } from './components/preview';
import { SwarmPresetSelector } from './components/swarm';
import { SwarmTabs } from './components/swarm/SwarmTabs';
import { PromptInput } from './components/teamwire';
import { CommandPalette, type PaletteCommand } from './components/ui/CommandPalette';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ToastHost } from './components/ui/ToastHost';
import { SHORTCUTS, findShortcut, formatBinding } from './config/shortcuts';
import { useAutoPortDetection } from './hooks/useAutoPortDetection';
import { errorMessage } from './lib/ipc';
import { gitDiffService } from './services/gitDiffService';
import {
  closePanel,
  closeSwarm,
  restoreProjectSwarms,
  startSwarmSync,
} from './services/swarmLauncher';
import { swarmService } from './services/swarmService';
import { a2aStore, useA2AStore } from './stores/useA2AStore';
import { gridLayoutStore, useGridLayoutStore, type GridLayoutType } from './stores/useGridLayoutStore';
import { shieldStore, useShieldStore } from './stores/useShieldStore';
import { swarmStore, useSwarmStore } from './stores/useSwarmStore';
import { terminalStore, useTerminalStore } from './stores/useTerminalStore';
import { toastStore } from './stores/useToastStore';
import type { Project } from './types/project';
import type { Swarm, SwarmPanel } from './types/swarm';
import { MergeReviewView } from './views/MergeReviewView';
import { WelcomeView } from './views/WelcomeView';

type CloseRequest =
  | { kind: 'swarm'; swarm: Swarm }
  | { kind: 'panel'; swarm: Swarm; panel: SwarmPanel }
  | { kind: 'orphans'; worktreeIds: string[] };

function shortcutLabel(id: string): string {
  const binding = SHORTCUTS.find((shortcut) => shortcut.id === id)?.binding;
  return binding ? ` (${formatBinding(binding)})` : '';
}

interface HeaderButtonProps {
  label: string;
  title: string;
  onClick: () => void;
  pressed?: boolean;
  primary?: boolean;
  testId?: string;
  badge?: number;
  children: React.ReactNode;
}

function HeaderButton({ label, title, onClick, pressed, primary, testId, badge, children }: HeaderButtonProps) {
  const tone = primary
    ? 'bg-accent-solid text-on-solid border-transparent hover:brightness-110'
    : pressed
      ? 'bg-accent/15 text-accent border-accent/40'
      : 'bg-fill text-fg border-separator hover:bg-fill-strong';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={pressed}
      data-testid={testId}
      className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-macos border px-3 text-caption font-semibold transition-colors ${tone}`}
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        {children}
      </svg>
      <span className="hidden xl:inline">{label}</span>
      {badge ? (
        <span className="rounded-full bg-success/20 px-1.5 text-caption2 font-bold text-success">{badge}</span>
      ) : null}
    </button>
  );
}

const ICON = { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 } as const;

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [isSelectorOpen, setSelectorOpen] = useState(false);
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [isReviewOpen, setReviewOpen] = useState(false);
  const [closeRequest, setCloseRequest] = useState<CloseRequest | null>(null);
  const [unmergedDetail, setUnmergedDetail] = useState<string | null>(null);

  const { swarms, activeSwarmId, lastError } = useSwarmStore();
  const { panels, activePanelId, maximizedPanelId } = useGridLayoutStore();
  const { isWireOpen, toggleWire, lastError: wireError } = useA2AStore();
  const { blockedPrompts } = useTerminalStore();
  const shield = useShieldStore();
  const { isOpen: isPreviewOpen, toggleOpen: togglePreview, servers: previewServers } = useAutoPortDetection();

  const activeSwarm = swarms.find((swarm) => swarm.id === activeSwarmId) ?? null;

  // Backend event subscriptions that live as long as the window.
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    let disposed = false;
    const keep = (cleanup: () => void) => (disposed ? cleanup() : cleanups.push(cleanup));
    terminalStore.initListeners().then(keep).catch((e: unknown) => toastStore.error(errorMessage(e)));
    a2aStore.init().then(keep).catch((e: unknown) => toastStore.error(errorMessage(e)));
    shieldStore.load();
    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  // Opening a project restores its swarms and keeps them saved while it is open.
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    let stopSync: (() => void) | null = null;

    restoreProjectSwarms(project)
      .then((report) => {
        if (cancelled) return;
        stopSync = startSwarmSync(project);
        for (const warning of report.warnings) toastStore.push('warning', warning);
        if (report.swarms > 0) {
          toastStore.push(
            'success',
            `Sessão restaurada: ${report.swarms} enxame(s), ${report.panels} painel(éis) nos seus worktrees.`
          );
        }
        return swarmService.listOrphanWorktrees(project.path, project.id);
      })
      .then((orphans) => {
        if (cancelled || !orphans || orphans.length === 0) return;
        toastStore.push(
          'info',
          `${orphans.length} worktree(s) sem enxame associado. Usa «Limpar worktrees órfãos» na paleta de comandos.`
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        stopSync ??= startSwarmSync(project);
        toastStore.error(errorMessage(error));
      });

    return () => {
      cancelled = true;
      stopSync?.();
      swarmStore.reset();
      a2aStore.reset();
    };
  }, [project]);

  // Every store-level failure is shown, never dropped.
  useEffect(() => {
    if (!lastError) return;
    toastStore.error(lastError);
    swarmStore.setError(null);
  }, [lastError]);

  useEffect(() => {
    if (!wireError) return;
    toastStore.error(wireError);
    a2aStore.setError(null);
  }, [wireError]);

  // How much unmerged work a close would throw away.
  useEffect(() => {
    setUnmergedDetail(null);
    if (!project || !closeRequest || closeRequest.kind === 'orphans') return;
    let cancelled = false;
    const targets = closeRequest.kind === 'swarm' ? closeRequest.swarm.panels : [closeRequest.panel];
    Promise.all(
      targets.map((panel) =>
        gitDiffService
          .getWorktreeDiff(project.path, panel.worktreeId, closeRequest.swarm.baseBranch)
          .then((diff) => (diff.total_files > 0 ? panel.title : null))
      )
    )
      .then((titles) => {
        const dirty = titles.filter((title): title is string => title !== null);
        if (cancelled || dirty.length === 0) return;
        setUnmergedDetail(`Com alterações por fundir: ${dirty.join(', ')}.`);
      })
      .catch((error: unknown) => {
        if (!cancelled) setUnmergedDetail(`Não foi possível verificar as alterações: ${errorMessage(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [project, closeRequest]);

  const run = useCallback((action: Promise<unknown>, success?: string) => {
    action
      .then(() => success && toastStore.push('success', success))
      .catch((error: unknown) => toastStore.error(errorMessage(error)));
  }, []);

  const requestClosePanel = useCallback(
    (sessionId: string) => {
      const found = swarmStore.findPanel(sessionId);
      if (found) setCloseRequest({ kind: 'panel', ...found });
    },
    []
  );

  const jumpToNextBlocked = useCallback(() => {
    const blocked = swarmStore
      .getState()
      .swarms.flatMap((swarm) => swarm.panels.map((panel) => ({ swarm, panel })))
      .filter(({ panel }) => terminalStore.getState().blockedPrompts[panel.worktreeId]);
    if (blocked.length === 0) {
      toastStore.push('info', 'Nenhum agente está à espera de resposta.');
      return;
    }
    const current = blocked.findIndex(({ panel }) => panel.worktreeId === gridLayoutStore.getState().activePanelId);
    const next = blocked[(current + 1) % blocked.length];
    swarmStore.setActiveSwarm(next.swarm.id);
    swarmStore.setActivePanel(next.swarm.id, next.panel.worktreeId);
  }, []);

  const cleanOrphans = useCallback(() => {
    if (!project) return;
    swarmService
      .listOrphanWorktrees(project.path, project.id)
      .then((orphans) => {
        if (orphans.length === 0) {
          toastStore.push('info', 'Não há worktrees órfãos neste projeto.');
          return;
        }
        setCloseRequest({ kind: 'orphans', worktreeIds: orphans.map((orphan) => orphan.swarm_id) });
      })
      .catch((error: unknown) => toastStore.error(errorMessage(error)));
  }, [project]);

  /** What each shortcut / palette command does. Missing ids are simply unavailable right now. */
  const handlers = useMemo<Record<string, (() => void) | undefined>>(() => {
    if (!project) return {};
    const withSwarm = (action: (swarm: Swarm) => void) => (activeSwarm ? () => action(activeSwarm) : undefined);
    const map: Record<string, (() => void) | undefined> = {
      'palette.open': () => setPaletteOpen(true),
      'swarm.new': () => setSelectorOpen(true),
      'swarm.close': withSwarm((swarm) => setCloseRequest({ kind: 'swarm', swarm })),
      'swarm.next': swarms.length > 1 ? () => swarmStore.cycleSwarm(1) : undefined,
      'swarm.prev': swarms.length > 1 ? () => swarmStore.cycleSwarm(-1) : undefined,
      'review.open': withSwarm(() => setReviewOpen(true)),
      'attention.next': jumpToNextBlocked,
      'prompt.focus': withSwarm(() =>
        document.querySelector<HTMLTextAreaElement>('[data-prompt-input]')?.focus()
      ),
      'wire.toggle': () => toggleWire(),
      'preview.toggle': () => togglePreview(),
      'panel.next': panels.length > 1 ? gridLayoutStore.cycleNextPanel : undefined,
      'panel.prev': panels.length > 1 ? gridLayoutStore.cyclePrevPanel : undefined,
      'panel.maximize': activePanelId
        ? () => gridLayoutStore.toggleMaximizePanel(maximizedPanelId ?? activePanelId)
        : undefined,
      'project.home': () => setProject(null),
      'shield.streamer': () => void shieldStore.toggleStreamerMode(),
      'shield.mask': () => void shieldStore.toggleMaskSecrets(),
      'worktrees.clean': cleanOrphans,
    };
    swarms.slice(0, 9).forEach((swarm, index) => {
      map[`swarm.goto.${index + 1}`] = () => swarmStore.setActiveSwarm(swarm.id);
    });
    if (activeSwarm) {
      for (const layout of ['1x1', '1x2', '2x2', '2x3', '3x3', '4x4'] satisfies GridLayoutType[]) {
        map[`layout.${layout}`] = () => gridLayoutStore.setLayout(layout);
      }
    }
    return map;
  }, [
    project,
    activeSwarm,
    swarms,
    panels.length,
    activePanelId,
    maximizedPanelId,
    jumpToNextBlocked,
    cleanOrphans,
    toggleWire,
    togglePreview,
  ]);

  // Global key handler, in the capture phase so shortcuts work while a terminal has focus.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModalOpen = isSelectorOpen || isPaletteOpen || isReviewOpen || closeRequest !== null;
      if (e.key === 'Escape' && !isModalOpen && maximizedPanelId) {
        e.preventDefault();
        e.stopPropagation();
        gridLayoutStore.toggleMaximizePanel(maximizedPanelId);
        return;
      }
      const shortcut = findShortcut(e);
      const handler = shortcut && handlers[shortcut.id];
      if (!handler || (isModalOpen && shortcut.id !== 'palette.open')) return;
      e.preventDefault();
      e.stopPropagation();
      handler();
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handlers, isSelectorOpen, isPaletteOpen, isReviewOpen, closeRequest, maximizedPanelId]);

  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    const listed = [
      ...SHORTCUTS,
      { id: 'worktrees.clean', title: 'Limpar worktrees órfãos', section: 'Enxames' as const },
    ];
    return listed.flatMap((shortcut) => {
      const handler = handlers[shortcut.id];
      return handler ? [{ ...shortcut, run: handler }] : [];
    });
  }, [handlers]);

  if (!project) {
    return (
      <>
        <WelcomeView onOpenProject={setProject} />
        <ToastHost />
      </>
    );
  }

  const blockedCount = Object.keys(blockedPrompts).length;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-window-material text-fg select-none">
      <header
        data-tauri-drag-region
        className="z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-separator pl-20 pr-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-callout font-semibold text-fg" data-testid="project-name">
            {project.name}
          </span>
          {!shield.streamerMode && (
            <span className="hidden max-w-xs truncate font-mono text-caption2 text-fg-subtle lg:inline">
              {project.path}
            </span>
          )}
          {activeSwarm && !shield.streamerMode && (
            <span className="hidden font-mono text-caption2 text-fg-subtle 2xl:inline" data-testid="base-branch">
              base: {activeSwarm.baseBranch}
            </span>
          )}
        </div>

        {panels.length > 0 && (
          <div className="hidden items-center lg:flex">
            <GridLayoutControls />
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {blockedCount > 0 && (
            <HeaderButton
              label={`${blockedCount} à espera`}
              title={`Ir para o próximo agente bloqueado${shortcutLabel('attention.next')}`}
              onClick={jumpToNextBlocked}
              pressed
              testId="attention-button"
            >
              <path {...ICON} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </HeaderButton>
          )}
          <HeaderButton
            label="Live Preview"
            title={`Mostrar ou ocultar o Live Preview${shortcutLabel('preview.toggle')}`}
            onClick={() => togglePreview()}
            pressed={isPreviewOpen}
            badge={previewServers.length}
            testId="preview-toggle"
          >
            <path {...ICON} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
          </HeaderButton>
          <HeaderButton
            label="Team Wire"
            title={`Mostrar ou ocultar o Team Wire${shortcutLabel('wire.toggle')}`}
            onClick={() => toggleWire()}
            pressed={isWireOpen}
            testId="wire-toggle"
          >
            <path {...ICON} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </HeaderButton>
          <HeaderButton
            label="Rever e fundir"
            title={`Rever as alterações de cada agente e fundi-las${shortcutLabel('review.open')}`}
            onClick={() => (activeSwarm ? setReviewOpen(true) : toastStore.push('info', 'Lança um enxame para haver alterações a rever.'))}
            testId="review-button"
          >
            <path {...ICON} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </HeaderButton>
          <HeaderButton
            label={shield.streamerMode ? 'Apresentação' : 'Shield'}
            title={`Streamer Shield: segredos ${shield.maskSecrets ? 'mascarados' : 'visíveis'}; modo apresentação ${shield.streamerMode ? 'ligado' : 'desligado'}${shortcutLabel('shield.streamer')}`}
            onClick={() => void shieldStore.toggleStreamerMode()}
            pressed={shield.streamerMode}
            testId="shield-toggle"
          >
            <path {...ICON} d="M12 3l8 3v6c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V6l8-3z" />
          </HeaderButton>
          <HeaderButton
            label="Novo enxame"
            title={`Lançar um novo enxame${shortcutLabel('swarm.new')}`}
            onClick={() => setSelectorOpen(true)}
            primary
            testId="new-swarm-button"
          >
            <path {...ICON} d="M12 4v16m8-8H4" />
          </HeaderButton>
          <HeaderButton
            label="Projetos"
            title={`Voltar aos projetos${shortcutLabel('project.home')}`}
            onClick={() => setProject(null)}
            testId="home-button"
          >
            <path {...ICON} d="M3 12l9-9 9 9M5 10v10h14V10" />
          </HeaderButton>
        </div>
      </header>

      {swarms.length > 0 && (
        <SwarmTabs
          onNewSwarm={() => setSelectorOpen(true)}
          onCloseSwarm={(swarmId) => {
            const swarm = swarms.find((s) => s.id === swarmId);
            if (swarm) setCloseRequest({ kind: 'swarm', swarm });
          }}
        />
      )}

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-w-0 flex-1 flex-col gap-2 p-2">
          <div className="min-h-0 flex-1">
            <TiledTerminalGrid
              key={activeSwarmId ?? 'empty'}
              className="h-full w-full"
              onAddPanel={() => setSelectorOpen(true)}
              onClosePanel={requestClosePanel}
            />
          </div>
          {activeSwarm && (
            <div className="z-10 shrink-0">
              <PromptInput variant="global" />
            </div>
          )}
        </div>

        {isPreviewOpen && (
          <div className="z-10 h-full w-96 shrink-0 lg:w-[460px] xl:w-[520px]">
            <LiveBrowserDock className="h-full w-full" />
          </div>
        )}

        {isWireOpen && (
          <div className="z-10 h-full w-80 shrink-0 sm:w-96">
            <TeamWire
              className="h-full w-full"
              onFocusAgent={(panelKey) => {
                const target = panels.find((p) => p.key === panelKey);
                if (target) gridLayoutStore.setActivePanelId(target.id);
              }}
            />
          </div>
        )}
      </main>

      <SwarmPresetSelector
        isOpen={isSelectorOpen}
        onClose={() => setSelectorOpen(false)}
        project={project}
        onLaunched={(report) => {
          for (const warning of report.warnings) toastStore.push('warning', warning);
        }}
      />

      {isReviewOpen && activeSwarm && (
        <MergeReviewView
          repoPath={project.path}
          swarm={activeSwarm}
          initialSessionId={activePanelId}
          onClose={() => setReviewOpen(false)}
          onMerged={(panel, sha) =>
            run(
              closePanel(project, activeSwarm.id, panel.worktreeId, true),
              `${panel.title}: alterações integradas em ${activeSwarm.baseBranch} (${sha.slice(0, 10)}). Worktree e branch removidos.`
            )
          }
          onDelegateConflicts={(panel, conflicts) => {
            setReviewOpen(false);
            run(
              a2aStore.sendPrompt({
                recipient: 'orchestrator',
                content:
                  `Há conflitos ao fundir a branch ${panel.branch} (agente ${panel.key}) em ${activeSwarm.baseBranch}` +
                  `${conflicts.length ? `: ${conflicts.join(', ')}` : ''}. Coordena a resolução: o agente deve fazer merge de ` +
                  `${activeSwarm.baseBranch} no seu worktree, resolver os conflitos e fazer commit.`,
              }),
              'Resolução de conflitos pedida ao orquestrador.'
            );
          }}
        />
      )}

      {isPaletteOpen && <CommandPalette commands={paletteCommands} onClose={() => setPaletteOpen(false)} />}

      {closeRequest?.kind === 'swarm' && (
        <ConfirmDialog
          title={`Fechar o enxame «${closeRequest.swarm.name}»?`}
          message="Os terminais dos agentes são terminados e os worktrees removidos. Podes manter as branches para as fundires mais tarde, ou descartar tudo."
          detail={unmergedDetail}
          onCancel={() => setCloseRequest(null)}
          actions={[
            {
              label: 'Manter branches',
              testId: 'close-swarm-keep',
              onSelect: () => {
                setCloseRequest(null);
                run(closeSwarm(project, closeRequest.swarm.id, false), 'Enxame fechado. As branches helm/swarm-* foram mantidas.');
              },
            },
            {
              label: 'Descartar tudo',
              kind: 'danger',
              testId: 'close-swarm-discard',
              onSelect: () => {
                setCloseRequest(null);
                run(closeSwarm(project, closeRequest.swarm.id, true), 'Enxame fechado. Worktrees e branches removidos.');
              },
            },
          ]}
        />
      )}

      {closeRequest?.kind === 'panel' && (
        <ConfirmDialog
          title={`Fechar o painel «${closeRequest.panel.title}»?`}
          message="O terminal é terminado e o worktree deste agente é removido."
          detail={unmergedDetail}
          onCancel={() => setCloseRequest(null)}
          actions={[
            {
              label: 'Manter branch',
              testId: 'close-panel-keep',
              onSelect: () => {
                setCloseRequest(null);
                run(closePanel(project, closeRequest.swarm.id, closeRequest.panel.worktreeId, false));
              },
            },
            {
              label: 'Descartar',
              kind: 'danger',
              testId: 'close-panel-discard',
              onSelect: () => {
                setCloseRequest(null);
                run(closePanel(project, closeRequest.swarm.id, closeRequest.panel.worktreeId, true));
              },
            },
          ]}
        />
      )}

      {closeRequest?.kind === 'orphans' && (
        <ConfirmDialog
          title={`Remover ${closeRequest.worktreeIds.length} worktree(s) órfão(s)?`}
          message="Estes worktrees em .helm/worktrees não pertencem a nenhum enxame guardado. Os worktrees e as respetivas branches helm/swarm-* serão removidos."
          onCancel={() => setCloseRequest(null)}
          actions={[
            {
              label: 'Remover',
              kind: 'danger',
              testId: 'clean-orphans-confirm',
              onSelect: () => {
                const ids = closeRequest.worktreeIds;
                setCloseRequest(null);
                run(
                  Promise.all(ids.map((id) => swarmService.releaseWorkspace(project.path, id, true))),
                  'Worktrees órfãos removidos.'
                );
              },
            },
          ]}
        />
      )}

      <ToastHost />
    </div>
  );
}
