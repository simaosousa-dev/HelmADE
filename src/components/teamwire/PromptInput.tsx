import React, { useRef, useEffect } from 'react';
import { useTeamWireStore } from '../../stores/useTeamWireStore';
import { useGridLayoutStore } from '../../stores/useGridLayoutStore';
import { useA2AStore } from '../../stores/useA2AStore';
import { BroadcastToggle } from './BroadcastToggle';
import { VoiceWaveIndicator } from '../voice/VoiceWaveIndicator';
import { useGlobalPushToTalk } from '../../hooks/useGlobalPushToTalk';
import type { A2AMessageType } from '../../types/a2a';

export interface PromptInputProps {
  variant?: 'global' | 'panel';
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  variant = 'global',
  className = '',
  placeholder,
  autoFocus = false,
}) => {
  const {
    isBroadcastMode,
    selectedRecipientId,
    selectedMessageType,
    draftPrompt,
    isDispatching,
    lastDispatchResult,
    setBroadcastMode,
    setSelectedRecipientId,
    setSelectedMessageType,
    setDraftPrompt,
    dispatchPrompt,
    resetDispatchResult,
  } = useTeamWireStore();

  const { panels, activePanelId } = useGridLayoutStore();
  const { peers } = useA2AStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hook Push-to-Talk com injeção automática no prompt ativo
  const { state: pttState, toggleListening } = useGlobalPushToTalk({
    applyPhonetics: true,
    autoInjectPrompt: true,
  });

  // Terminais ativos com sessão PTY viva
  const activePanels = panels.filter((p) => Boolean(p.sessionId));
  const activeTerminalsCount = activePanels.length;

  // Foco inicial se solicitado
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Limpar toast/badge de feedback de despacho após 3.5 segundos
  useEffect(() => {
    if (lastDispatchResult) {
      const timer = setTimeout(() => {
        resetDispatchResult();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [lastDispatchResult, resetDispatchResult]);

  // Atalhos de teclado: Enter para enviar, Shift+Enter para nova linha
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSend = async () => {
    if (!draftPrompt.trim() || isDispatching) return;
    await dispatchPrompt();
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Identificação do Orquestrador e do Agente Ativo
  const orchestratorPeer = peers.find(
    (p) => p.id === 'orchestrator' || p.role === 'architect' || p.name.toLowerCase().includes('orchestrat')
  );
  const activePanel = panels.find((p) => p.id === activePanelId);
  const currentRecipientPeer = peers.find((p) => p.id === selectedRecipientId);

  const targetDisplayName =
    currentRecipientPeer?.name ||
    activePanel?.title ||
    (selectedRecipientId === 'orchestrator' ? 'Orquestrador' : selectedRecipientId);

  const defaultPlaceholder = isBroadcastMode
    ? `📢 Difundir comando para todos os ${activeTerminalsCount} terminais PTY... (Enter para enviar)`
    : `Instruir ${targetDisplayName}... (Enter para enviar, Shift+Enter para nova linha)`;

  const effectivePlaceholder = placeholder || defaultPlaceholder;

  // ─────────────────────────────────────────────────────────────────────────────
  // VARIANT: Global Cockpit Bar (Aparece no rodapé da área de trabalho / terminais)
  // ─────────────────────────────────────────────────────────────────────────────
  if (variant === 'global') {
    return (
      <div
        className={`w-full bg-[#161618]/95 backdrop-blur-xl border rounded-2xl p-3 shadow-xl flex flex-col gap-2.5 transition-all duration-200 select-none ${
          isBroadcastMode
            ? 'border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.12)]'
            : 'border-white/10 shadow-black/40'
        } ${className}`}
      >
        {/* Barra Superior de Controlos e Contexto */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Alternador de Modo Broadcast */}
          <div className="flex items-center gap-2">
            <BroadcastToggle
              isBroadcast={isBroadcastMode}
              onToggle={setBroadcastMode}
              activeCount={activeTerminalsCount}
            />

            {/* Contexto do Modo Unicast (Destinatário e Tipo de Tarefa) */}
            {!isBroadcastMode && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-1 min-h-[44px]">
                  <label htmlFor="global-recipient-select" className="text-[11px] text-white/50 shrink-0 font-medium">
                    Destino:
                  </label>
                  <select
                    id="global-recipient-select"
                    aria-label="Selecionar agente de destino"
                    value={selectedRecipientId}
                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                    className="bg-transparent text-white text-[12px] font-medium focus:outline-none focus:ring-0 cursor-pointer"
                  >
                    <option value="orchestrator" className="bg-[#1c1c1e] text-white">
                      {orchestratorPeer ? orchestratorPeer.name : 'Principal Architect (Orquestrador)'}
                    </option>
                    {activePanel && activePanel.id !== 'orchestrator' && (
                      <option value={activePanel.id} className="bg-[#1c1c1e] text-white">
                        Painel Ativo: {activePanel.title}
                      </option>
                    )}
                    {peers
                      .filter((p) => p.id !== 'orchestrator' && p.id !== activePanel?.id)
                      .map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#1c1c1e] text-white">
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Seletor de Tipo de Mensagem */}
                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-1 min-h-[44px]">
                  <label htmlFor="global-type-select" className="text-[11px] text-white/50 shrink-0 font-medium">
                    Tipo:
                  </label>
                  <select
                    id="global-type-select"
                    aria-label="Tipo de mensagem A2A"
                    value={selectedMessageType}
                    onChange={(e) => setSelectedMessageType(e.target.value as A2AMessageType)}
                    className="bg-transparent text-white text-[12px] font-medium focus:outline-none focus:ring-0 cursor-pointer"
                  >
                    <option value="task" className="bg-[#1c1c1e] text-white">Tarefa</option>
                    <option value="query" className="bg-[#1c1c1e] text-white">Dúvida</option>
                    <option value="report" className="bg-[#1c1c1e] text-white">Relatório</option>
                  </select>
                </div>
              </div>
            )}

            {/* Aviso Dinâmico quando em Broadcast */}
            {isBroadcastMode && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] font-medium min-h-[44px]">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span>Difusão síncrona para {activeTerminalsCount} terminais PTY ativos</span>
              </div>
            )}
          </div>

          {/* Feedback de Despacho & Dica de Atalho */}
          <div className="flex items-center gap-2.5">
            <VoiceWaveIndicator
              state={pttState}
              onToggle={toggleListening}
              variant="compact"
            />

            {lastDispatchResult && (
              <div
                role="status"
                aria-live="polite"
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                  lastDispatchResult.success
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                    : 'bg-red-500/20 text-red-200 border-red-500/40'
                }`}
              >
                <span>{lastDispatchResult.success ? '✓' : '⚠'}</span>
                <span>{lastDispatchResult.message}</span>
              </div>
            )}

            <span className="text-[11px] text-white/40 hidden md:inline font-mono">
              Enter ↵ enviar · Shift+Enter quebra
            </span>
          </div>
        </div>

        {/* Campo de Texto Multilinha + Botão de Envio */}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={effectivePlaceholder}
              disabled={isDispatching}
              aria-label="Caixa de prompt primário do Orquestrador"
              className={`w-full resize-none bg-black/60 border rounded-xl px-3.5 py-3 text-[13px] text-white placeholder-white/40 leading-relaxed focus:outline-none transition-all min-h-[44px] max-h-36 ${
                isBroadcastMode
                  ? 'border-amber-500/40 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                  : 'border-white/15 focus:border-blue-500/80 focus:ring-2 focus:ring-accent-blue/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
              }`}
            />
          </div>

          {/* Botão de Envio Primário */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!draftPrompt.trim() || isDispatching}
            aria-label={isBroadcastMode ? 'Difundir comando para todos os terminais' : 'Enviar comando para agente'}
            className={`min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150 flex items-center justify-center gap-2 select-none active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 ${
              isBroadcastMode
                ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black shadow-[0_0_14px_rgba(245,158,11,0.35)] focus-visible:ring-amber-400'
                : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm focus-visible:ring-blue-400'
            }`}
          >
            {isDispatching ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isBroadcastMode ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="hidden sm:inline">Difundir</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="hidden sm:inline">Enviar</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VARIANT: Panel Mode (Dockado dentro da barra lateral do Team Wire)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className={`p-3 border-t bg-[#141416] shrink-0 flex flex-col gap-2.5 transition-colors ${
        isBroadcastMode ? 'border-amber-500/30 bg-[#171512]' : 'border-white/10'
      } ${className}`}
    >
      {/* Linha de Configuração do Envio */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <BroadcastToggle
          isBroadcast={isBroadcastMode}
          onToggle={setBroadcastMode}
          activeCount={activeTerminalsCount}
          compact={true}
        />

        {!isBroadcastMode ? (
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <select
              aria-label="Selecionar destinatário"
              value={selectedRecipientId}
              onChange={(e) => setSelectedRecipientId(e.target.value)}
              className="bg-black/40 border border-white/15 text-white text-[11px] font-medium rounded-lg px-2 py-1.5 min-h-[44px] max-w-[140px] truncate focus:outline-none focus:border-blue-500/70"
            >
              <option value="orchestrator">
                {orchestratorPeer ? orchestratorPeer.name : 'Orquestrador'}
              </option>
              {activePanel && activePanel.id !== 'orchestrator' && (
                <option value={activePanel.id}>Ativo: {activePanel.title}</option>
              )}
              {peers
                .filter((p) => p.id !== 'orchestrator' && p.id !== activePanel?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>

            <select
              aria-label="Selecionar tipo de mensagem"
              value={selectedMessageType}
              onChange={(e) => setSelectedMessageType(e.target.value as A2AMessageType)}
              className="bg-black/40 border border-white/15 text-white text-[11px] font-medium rounded-lg px-2 py-1.5 min-h-[44px] focus:outline-none focus:border-blue-500/70"
            >
              <option value="task">Tarefa</option>
              <option value="query">Dúvida</option>
              <option value="report">Relatório</option>
            </select>
          </div>
        ) : (
          <div className="text-[10px] text-amber-300/90 font-medium px-2 py-1 rounded bg-amber-500/10 border border-amber-500/25">
            Difusão para {activeTerminalsCount} terminais
          </div>
        )}
      </div>

      {/* Input Multilinha + Botão Enviar */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={draftPrompt}
          onChange={(e) => setDraftPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          disabled={isDispatching}
          aria-label="Prompt do Orquestrador no Team Wire"
          className={`flex-1 resize-none bg-black/50 border rounded-xl px-3 py-2.5 text-[12px] text-white placeholder-white/40 leading-relaxed focus:outline-none transition-all min-h-[44px] max-h-28 ${
            isBroadcastMode
              ? 'border-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40'
              : 'border-white/15 focus:border-blue-500/80 focus:ring-1 focus:ring-accent-blue/40'
          }`}
        />

        <VoiceWaveIndicator
          state={pttState}
          onToggle={toggleListening}
          variant="compact"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!draftPrompt.trim() || isDispatching}
          aria-label={isBroadcastMode ? 'Difundir comando' : 'Enviar mensagem'}
          className={`min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150 flex items-center justify-center shrink-0 shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 ${
            isBroadcastMode
              ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)] focus-visible:ring-amber-400'
              : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white focus-visible:ring-blue-400'
          }`}
        >
          {isDispatching ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isBroadcastMode ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {lastDispatchResult && (
        <div
          role="status"
          aria-live="polite"
          className={`text-[10px] font-medium px-2 py-0.5 rounded border flex items-center justify-between ${
            lastDispatchResult.success
              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
              : 'bg-red-500/15 text-red-200 border-red-500/30'
          }`}
        >
          <span>{lastDispatchResult.message}</span>
          <span>{lastDispatchResult.success ? '✓' : '⚠'}</span>
        </div>
      )}
    </div>
  );
};

export default PromptInput;
