import React, { useState, useMemo, useCallback } from 'react';
import type { ConsoleLogEntry, ConsoleLogLevel } from '../../types/preview';
import { formatLogsForOrchestrator } from '../../utils/sanitizeLog.ts';

export interface WebviewConsoleLogsProps {
  logs: ConsoleLogEntry[];
  isOpen: boolean;
  filter: 'all' | ConsoleLogLevel;
  onFilterChange: (filter: 'all' | ConsoleLogLevel) => void;
  onClearLogs: () => void;
  onClose: () => void;
  className?: string;
}

export const WebviewConsoleLogs: React.FC<WebviewConsoleLogsProps> = ({
  logs,
  isOpen,
  filter,
  onFilterChange,
  onClearLogs,
  onClose,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const errorCount = useMemo(() => logs.filter((l) => l.level === 'error').length, [logs]);
  const warnCount = useMemo(() => logs.filter((l) => l.level === 'warn').length, [logs]);

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((l) => l.level === filter);
  }, [logs, filter]);

  const handleCopy = useCallback(async () => {
    const text = formatLogsForOrchestrator(filteredLogs);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Falha ao copiar logs:', err);
    }
  }, [filteredLogs]);

  if (!isOpen) return null;

  return (
    <div
      role="region"
      aria-label="Consola de Erros e Logs da Webview"
      className={`flex flex-col bg-[#18181b]/95 backdrop-blur-xl border-t border-white/10 select-none transition-all ${className}`}
    >
      {/* ── Barra Superior da Consola ────────────────────────────────────── */}
      <div className="h-11 px-3 sm:px-4 flex items-center justify-between border-b border-white/10 bg-[#1f1f23]/90 shrink-0">
        <div className="flex items-center gap-2">
          {/* Ícone Terminal / Bug */}
          <div className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[12px] font-semibold text-white/90 tracking-tight">
            Consola Webview
          </span>

          {/* Badges de Contagem de Erros e Avisos */}
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              {errorCount} {errorCount === 1 ? 'erro' : 'erros'}
            </span>
          )}

          {warnCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {warnCount} {warnCount === 1 ? 'aviso' : 'avisos'}
            </span>
          )}
        </div>

        {/* Filtros e Ações Rápidas */}
        <div className="flex items-center gap-1">
          {/* Filtros de Severidade */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5 text-[10px]">
            <button
              type="button"
              onClick={() => onFilterChange('all')}
              className={`px-2 py-1 rounded-md transition-all ${
                filter === 'all'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Todos ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => onFilterChange('error')}
              className={`px-2 py-1 rounded-md transition-all ${
                filter === 'error'
                  ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Erros ({errorCount})
            </button>
            <button
              type="button"
              onClick={() => onFilterChange('warn')}
              className={`px-2 py-1 rounded-md transition-all ${
                filter === 'warn'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Avisos ({warnCount})
            </button>
          </div>

          {/* Botão de Cópia com 1 Clique (Apple HIG: hit-target mínimo de 44x44px) */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={filteredLogs.length === 0}
            aria-label="Copiar relatório formatado de logs da consola para a área de transferência"
            title="Copiar relatório formatado para o prompt do Orquestrador"
            className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl flex items-center justify-center transition-all ${
              filteredLogs.length > 0
                ? 'text-white/70 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
                : 'text-white/20 cursor-not-allowed'
            } focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none`}
          >
            {copied ? (
              <span className="text-[10px] font-semibold text-emerald-400 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                Copiado!
              </span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>

          {/* Botão Limpar Logs */}
          <button
            type="button"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            aria-label="Limpar histórico de logs da consola"
            title="Limpar logs"
            className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl flex items-center justify-center transition-all ${
              logs.length > 0
                ? 'text-white/70 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
                : 'text-white/20 cursor-not-allowed'
            } focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          {/* Botão Fechar Gaveta */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gaveta da consola"
            title="Fechar consola"
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Lista de Registos de Log ──────────────────────────────────────── */}
      <div className="h-48 sm:h-56 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed flex flex-col gap-1 select-text">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/40">
            <svg className="w-6 h-6 mb-1 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-[12px] font-medium text-white/60">Nenhum log intercetado</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              Erros ou avisos emitidos pela aplicação aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const isError = entry.level === 'error';
            const isWarn = entry.level === 'warn';
            const isInfo = entry.level === 'info';
            const isExpanded = expandedLogId === entry.id;

            return (
              <div
                key={entry.id}
                className={`p-2 rounded-lg border transition-all ${
                  isError
                    ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                    : isWarn
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                    : isInfo
                    ? 'bg-sky-500/10 border-sky-500/25 text-sky-200'
                    : 'bg-white/[0.03] border-white/5 text-white/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Timestamp */}
                    <span className="text-[10px] text-white/40 shrink-0 font-sans">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>

                    {/* Level Badge */}
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase shrink-0 ${
                        isError
                          ? 'bg-rose-500/30 text-rose-200'
                          : isWarn
                          ? 'bg-amber-500/30 text-amber-200'
                          : isInfo
                          ? 'bg-sky-500/30 text-sky-200'
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {entry.level}
                    </span>

                    {/* Origem opcional */}
                    {entry.source && (
                      <span className="text-[10px] text-white/40 truncate">
                        [{entry.source}]
                      </span>
                    )}

                    {/* Mensagem Sanitizada */}
                    <span className="break-all font-mono select-text font-medium text-[11px]">
                      {entry.message}
                    </span>
                  </div>

                  {/* Agrupamento por repetição */}
                  {entry.count && entry.count > 1 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/10 shrink-0">
                      ×{entry.count}
                    </span>
                  )}
                </div>

                {/* Stack Trace Opcional / Expansível */}
                {entry.stack && (
                  <div className="mt-1.5 pt-1.5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setExpandedLogId(isExpanded ? null : entry.id)}
                      className="text-[10px] text-white/50 hover:text-white/90 flex items-center gap-1 focus:outline-none"
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {isExpanded ? 'Ocultar Stack Trace' : 'Ver Stack Trace'}
                    </button>
                    {isExpanded && (
                      <pre className="mt-1 p-2 rounded bg-black/60 border border-white/5 text-[10px] text-white/70 overflow-x-auto whitespace-pre-wrap">
                        {entry.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WebviewConsoleLogs;
