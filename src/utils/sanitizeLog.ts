/**
 * Utilitário de sanitização de mensagens e stack traces para o Live Preview e Consola.
 * 
 * Regra de Segurança e Apple HIG:
 * Erros e mensagens capturados de aplicações web ou servidores locais NUNCA devem expor
 * caminhos absolutos locais do sistema de ficheiros (ex: /Users/username/..., /home/username/..., C:\Users\...).
 * 
 * Previne também ReDoS utilizando expressões regulares com limites estritos (bounded ranges).
 */

/**
 * Sanitiza uma mensagem ou stack trace de log, mascarando caminhos absolutos e ficheiros locais.
 */
export function sanitizeLogMessage(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  return raw
    // Mascara caminhos absolutos macOS (/Users/<user>/...) com limite de comprimento para prevenir ReDoS
    .replace(/\/Users\/[a-zA-Z0-9._-]{1,64}\b/g, '~')
    // Mascara caminhos absolutos Linux (/home/<user>/... ou /root/...)
    .replace(/\/(?:home\/[a-zA-Z0-9._-]{1,64}|root)\b/g, '~')
    // Mascara caminhos Windows (C:\Users\<user>\...)
    .replace(/[a-zA-Z]:\\(?:Users|Documents and Settings)\\[a-zA-Z0-9._-]{1,64}\b/gi, '~')
    // Mascara prefixos de stack traces do tipo "at /Users/..." ou "at /private/..."
    .replace(/\bat \/(?:[a-zA-Z0-9._-]{1,64}\/){1,16}/g, 'at ~/')
    // Mascara schemas file:// com caminhos de utilizador
    .replace(/file:\/\/\/(?:Users|home|root)\/[a-zA-Z0-9._-]{1,64}\b/g, 'file://~')
    // Mascara caminhos com /private/var/folders/... típicos de compiladores no macOS
    .replace(/\/private\/var\/folders\/[a-zA-Z0-9._-]{1,64}\/[a-zA-Z0-9._-]{1,64}\/[a-zA-Z0-9._-]{1,64}\b/g, '~/[temp]');
}

/**
 * Formata uma lista de entradas de consola num texto limpo e estruturado para cópia
 * direta para a barra de prompt do Orquestrador de Agentes.
 */
export function formatLogsForOrchestrator(
  logs: Array<{
    level: string;
    message: string;
    timestamp: number;
    source?: string;
    stack?: string;
    count?: number;
  }>
): string {
  if (logs.length === 0) {
    return 'Nenhum log ou erro intercetado na consola do Live Preview.';
  }

  const lines: string[] = [
    '=== RELATÓRIO DE LOGS DA CONSOLA (LIVE PREVIEW) ===',
    `Total de Entradas: ${logs.length}`,
    `Gerado em: ${new Date().toISOString()}`,
    '---------------------------------------------------',
  ];

  for (const entry of logs) {
    const timeStr = new Date(entry.timestamp).toLocaleTimeString();
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const countStr = entry.count && entry.count > 1 ? ` (x${entry.count})` : '';
    const srcStr = entry.source ? ` [${entry.source}]` : '';

    lines.push(`[${timeStr}] [${levelStr}]${srcStr}${countStr}: ${entry.message}`);
    if (entry.stack) {
      const sanitizedStack = sanitizeLogMessage(entry.stack);
      lines.push(`  Stack: ${sanitizedStack}`);
    }
  }

  lines.push('---------------------------------------------------');
  return lines.join('\n');
}
