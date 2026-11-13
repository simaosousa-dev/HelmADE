import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useA2AMessages } from '../../hooks/useA2AMessages';
import { A2AExchangeIndicator } from './A2AExchangeIndicator';
import { PromptInput } from '../teamwire/PromptInput';
import type { A2AMessageType } from '../../types/a2a';

export interface TeamWireProps {
  className?: string;
  onFocusAgent?: (agentId: string) => void;
}

const MESSAGE_TYPE_STYLES: Record<
  A2AMessageType,
  { label: string; badgeClass: string; borderClass: string }
> = {
  task: {
    label: 'Tarefa',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    borderClass: 'border-l-blue-500',
  },
  report: {
    label: 'Relatório',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    borderClass: 'border-l-emerald-500',
  },
  query: {
    label: 'Dúvida',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    borderClass: 'border-l-purple-500',
  },
  response: {
    label: 'Resposta',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    borderClass: 'border-l-teal-500',
  },
  error: {
    label: 'Erro',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
    borderClass: 'border-l-red-500',
  },
  broadcast: {
    label: 'Broadcast',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    borderClass: 'border-l-amber-500',
  },
};

// ─── Avatar palette (8 Tailwind-safe bg/text pairs) ──────────────────────────
const AVATAR_PALETTE = [
  'bg-blue-500/80 text-blue-100',
  'bg-emerald-500/80 text-emerald-100',
  'bg-violet-500/80 text-violet-100',
  'bg-amber-500/80 text-amber-100',
  'bg-rose-500/80 text-rose-100',
  'bg-cyan-500/80 text-cyan-100',
  'bg-fuchsia-500/80 text-fuchsia-100',
  'bg-lime-600/80 text-lime-100',
] as const;

/** Deterministic colour derived from a string id (bounded hash). */
function avatarColour(id: string): string {
  let h = 0;
  // ponytail: simple djb2 variant — bounded by mod, no backtracking risk
  for (let i = 0; i < Math.min(id.length, 32); i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

/** 1-2 char initials from a display name or id. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Inline Markdown parser (XSS-safe, no dangerouslySetInnerHTML) ────────────
// Supports: **bold**, `code`, newlines → <br />.
// ponytail: regex bounded to ≤1000 chars per segment, no catastrophic backtracking.
function renderMarkdown(text: string): React.ReactNode[] {
  const TOKEN_RE = /(\*\*(.{1,500}?)\*\*|`(.{1,200}?)`)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > cursor) {
      pushPlainText(text.slice(cursor, match.index), nodes, keyIdx++);
    }
    if (match[2] !== undefined) {
      nodes.push(<strong key={`b${keyIdx++}`} className="font-semibold text-white">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(
        <code
          key={`c${keyIdx++}`}
          className="bg-white/10 px-1 rounded text-cyan-300 text-[11px] font-mono"
        >
          {match[3]}
        </code>
      );
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    pushPlainText(text.slice(cursor), nodes, keyIdx++);
  }

  return nodes;
}

function pushPlainText(segment: string, nodes: React.ReactNode[], baseKey: number): void {
  const lines = segment.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) nodes.push(<br key={`br${baseKey}-${i}`} />);
    if (line) nodes.push(line);
  });
}

// ─── AgentAvatar ─────────────────────────────────────────────────────────────
interface AgentAvatarProps {
  senderId: string;
  senderName: string;
}

const AgentAvatar: React.FC<AgentAvatarProps> = ({ senderId, senderName }) => (
  <div
    aria-hidden="true"
    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 select-none ${
      avatarColour(senderId)
    }`}
  >
    {initials(senderName)}
  </div>
);

// ─── TeamWire ─────────────────────────────────────────────────────────────────
export const TeamWire: React.FC<TeamWireProps> = ({ className = '', onFocusAgent }) => {
  const {
    messages,
    peers,
    highlightedMessageId,
    activeExchangeAgentIds,
    toggleWire,
    setHighlightedMessage,
  } = useA2AMessages();

  const [filterQuery, setFilterQuery] = useState('');

  // ── Auto-scroll sentinel ref ──────────────────────────────────────────────
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  const visibleMessages = messages.filter((m) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      m.content.toLowerCase().includes(q) ||
      m.senderName.toLowerCase().includes(q) ||
      m.recipientName.toLowerCase().includes(q)
    );
  });

  // ── Auto-scroll when new messages arrive ─────────────────────────────────
  useEffect(() => {
    scrollSentinelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [visibleMessages.length]);

  // ── Focus + highlight terminal event ─────────────────────────────────────
  const handleFocusAgent = useCallback(
    (agentId: string) => {
      onFocusAgent?.(agentId);
      window.dispatchEvent(
        new CustomEvent('helmade:highlightPanel', { detail: { panelId: agentId } })
      );
    },
    [onFocusAgent]
  );

  return (
    <aside
      aria-label="Painel Team Wire de Comunicação Inter-Agentes"
      className={`flex flex-col h-full bg-[#161618] border-l border-white/10 text-white select-none backdrop-blur-xl transition-all duration-200 ${className}`}
    >
      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold tracking-tight text-white/95">
                Team Wire
              </h2>
              {activeExchangeAgentIds.size > 0 && (
                <A2AExchangeIndicator isExchanging={true} size="sm" />
              )}
            </div>
            {/* Active-peers counter */}
            <p className="text-[11px] text-white/40 tracking-tight">
              {peers.length > 0
                ? `${peers.length} peer${peers.length !== 1 ? 's' : ''} · Feed A2A`
                : 'Feed de Diálogo A2A'}
            </p>
          </div>
        </div>

        {/* Controlos Rápidos */}
        <div className="flex items-center gap-1.5">
          {/* Fechar Painel */}
          <button
            type="button"
            onClick={() => toggleWire(false)}
            title="Fechar Team Wire"
            aria-label="Fechar painel Team Wire"
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Filtro de Pesquisa ────────────────────────────────────────────── */}
      <div className="p-3 border-b border-white/5 bg-[#121214]/50">
        <div className="relative">
          <input
            type="text"
            placeholder="Pesquisar mensagens ou agentes..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[12px] text-white placeholder-white/40 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-accent-blue transition-all"
          />
          <svg
            className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ── Lista de Mensagens ────────────────────────────────────────────── */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Histórico de mensagens A2A"
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
      >
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-white/40">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-white/30">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-[13px] font-medium text-white/70">Nenhuma Mensagem A2A</p>
            <p className="text-[11px] text-white/40 mt-1 max-w-[240px] leading-relaxed">
              As trocas de mensagens estruturadas entre agentes do enxame serão registadas aqui e espelhadas nos terminais.
            </p>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isHighlighted = highlightedMessageId === msg.id;
            const typeConfig =
              MESSAGE_TYPE_STYLES[msg.messageType] ?? MESSAGE_TYPE_STYLES.task;
            const timeString = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={msg.id}
                onClick={() => {
                  setHighlightedMessage(isHighlighted ? null : msg.id);
                  if (msg.senderId !== 'user') handleFocusAgent(msg.senderId);
                }}
                className={`p-3 rounded-xl border border-l-4 transition-all duration-150 cursor-pointer ${
                  typeConfig.borderClass
                } ${
                  isHighlighted
                    ? 'bg-blue-500/10 border-blue-500/40 shadow-sm ring-1 ring-blue-500/30'
                    : 'bg-[#1e1e22]/80 border-white/10 hover:border-white/20 hover:bg-[#25252a]/80'
                }`}
              >
                {/* Meta: avatar + sender → recipient + badge + time */}
                <div className="flex items-start gap-2 mb-1.5">
                  <AgentAvatar senderId={msg.senderId} senderName={msg.senderName} />

                  <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[12px] font-semibold text-white truncate">
                        {msg.senderName}
                      </span>
                      <span className="text-white/40 text-[10px]">➔</span>
                      <span className="text-[11px] text-white/80 truncate">
                        {msg.recipientName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${typeConfig.badgeClass}`}
                      >
                        {typeConfig.label}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">
                        {timeString}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conteúdo com Markdown seguro */}
                <div className="text-[12px] text-white/90 leading-relaxed font-mono break-words select-text">
                  {renderMarkdown(msg.content)}
                </div>

                {/* Rodapé interativo */}
                <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Espelhado no PTY</span>
                  </span>

                  {onFocusAgent && msg.senderId !== 'user' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFocusAgent(msg.senderId);
                      }}
                      className="min-h-[44px] min-w-[44px] flex items-center hover:text-blue-400 transition-colors underline underline-offset-2"
                    >
                      Focar Terminal
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Scroll sentinel — always at the bottom of the list */}
        <div ref={scrollSentinelRef} aria-hidden="true" />
      </div>

      {/* ── Caixa de Prompt Primário do Orquestrador & Broadcast ───────────── */}
      <PromptInput variant="panel" />
    </aside>
  );
};

export default TeamWire;
