/**
 * Dicionário e Motor de Correção Fonética de Código para o HelmVoice.
 * Corrige termos de programação e comandos CLI frequentemente mal interpretados
 * pelo motor nativo de fala (ex: Apple Speech).
 *
 * Segue o princípio Ponytail: substituição regex linear sem dependências pesadas de NLP.
 */

export interface PhoneticRule {
  readonly pattern: RegExp;
  readonly replacement: string;
  readonly category: 'git' | 'language' | 'cli' | 'operator' | 'general';
  readonly description?: string;
}

/**
 * Regras predefinidas de correção fonética otimizadas para desenvolvedores.
 */
export const CODE_PHONETIC_RULES: readonly PhoneticRule[] = [
  // --- Comandos e Termos Git ---
  {
    pattern: /\b(?:get|gitt)\s+commit\b/gi,
    replacement: 'git commit',
    category: 'git',
    description: 'get commit -> git commit',
  },
  {
    pattern: /\b(?:get|gitt)\s+checkout\b/gi,
    replacement: 'git checkout',
    category: 'git',
    description: 'get checkout -> git checkout',
  },
  {
    pattern: /\b(?:get|gitt)\s+branch\b/gi,
    replacement: 'git branch',
    category: 'git',
    description: 'get branch -> git branch',
  },
  {
    pattern: /\b(?:get|gitt)\s+push\b/gi,
    replacement: 'git push',
    category: 'git',
    description: 'get push -> git push',
  },
  {
    pattern: /\b(?:get|gitt)\s+pull\b/gi,
    replacement: 'git pull',
    category: 'git',
    description: 'get pull -> git pull',
  },
  {
    pattern: /\b(?:get|gitt)\s+status\b/gi,
    replacement: 'git status',
    category: 'git',
    description: 'get status -> git status',
  },
  {
    pattern: /\b(?:get|gitt)\s+diff\b/gi,
    replacement: 'git diff',
    category: 'git',
    description: 'get diff -> git diff',
  },
  {
    pattern: /\bwork\s+tree\b/gi,
    replacement: 'worktree',
    category: 'git',
    description: 'work tree -> worktree',
  },
  {
    pattern: /\b(?:get\s+hub|gitt\s*hub)\b/gi,
    replacement: 'GitHub',
    category: 'git',
    description: 'get hub -> GitHub',
  },
  {
    pattern: /\bpull\s+request\b/gi,
    replacement: 'PR',
    category: 'git',
    description: 'pull request -> PR',
  },

  // --- Linguagens e Tecnologias ---
  {
    pattern: /\btype\s*script\b/gi,
    replacement: 'TypeScript',
    category: 'language',
    description: 'type script -> TypeScript',
  },
  {
    pattern: /\bjava\s*script\b/gi,
    replacement: 'JavaScript',
    category: 'language',
    description: 'java script -> JavaScript',
  },
  {
    pattern: /\b(?:coober\s*netties|k\s*eight\s*s|k8\s*s)\b/gi,
    replacement: 'Kubernetes',
    category: 'general',
    description: 'coober netties / k eight s -> Kubernetes',
  },
  {
    pattern: /\b(?:tori|taury)\b/gi,
    replacement: 'Tauri',
    category: 'language',
    description: 'tori -> Tauri',
  },
  {
    pattern: /\bsequel\s*light\b/gi,
    replacement: 'SQLite',
    category: 'language',
    description: 'sequel light -> SQLite',
  },
  {
    pattern: /\b(?:sequel|ess\s*que\s*el)\b/gi,
    replacement: 'SQL',
    category: 'language',
    description: 'sequel -> SQL',
  },
  {
    pattern: /\b(?:darker|docker)\s+compost\b/gi,
    replacement: 'docker compose',
    category: 'cli',
    description: 'docker compost -> docker compose',
  },
  {
    pattern: /\bpost\s*gress\b/gi,
    replacement: 'PostgreSQL',
    category: 'language',
    description: 'post gress -> PostgreSQL',
  },

  // --- Gerenciadores de Pacotes & Ferramentas CLI ---
  {
    pattern: /\b(?:en\s*pee\s*em|n\s*p\s*m)\b/gi,
    replacement: 'npm',
    category: 'cli',
    description: 'en pee em / n p m -> npm',
  },
  {
    pattern: /\b(?:pee\s*en\s*pee\s*em|p\s*n\s*p\s*m)\b/gi,
    replacement: 'pnpm',
    category: 'cli',
    description: 'pee en pee em -> pnpm',
  },
  {
    pattern: /\b(?:kargo|car\s*go)\b/gi,
    replacement: 'cargo',
    category: 'cli',
    description: 'kargo -> cargo',
  },
  {
    pattern: /\b(?:sue\s*doe|soo\s*doo)\b/gi,
    replacement: 'sudo',
    category: 'cli',
    description: 'sue doe -> sudo',
  },
  {
    pattern: /\b(?:ch\s*mod|c\s*h\s*mod)\b/gi,
    replacement: 'chmod',
    category: 'cli',
    description: 'ch mod -> chmod',
  },
  {
    pattern: /\b(?:j\s*son|jason)\b/gi,
    replacement: 'JSON',
    category: 'general',
    description: 'jason / j son -> JSON',
  },

  // --- Estruturas de Código & Sintaxe ---
  {
    pattern: /\b(?:a\s*sync|ay\s*sync)\s*(?:a\s*wait|ay\s*wait)?\b/gi,
    replacement: 'async await',
    category: 'operator',
    description: 'a sync a wait -> async await',
  },
  {
    pattern: /\b(?:bowling|boo\s*lean)\b/gi,
    replacement: 'boolean',
    category: 'language',
    description: 'bowling / boo lean -> boolean',
  },
  {
    pattern: /\bcost\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gi,
    replacement: 'const $1 =',
    category: 'language',
    description: 'cost [var] = -> const [var] =',
  },
  {
    pattern: /\blet\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gi,
    replacement: 'let $1 =',
    category: 'language',
    description: 'garante formatação let [var] =',
  },
  {
    pattern: /\b(?:triple\s+equals|equals\s+equals\s+equals)\b/gi,
    replacement: '===',
    category: 'operator',
    description: 'triple equals -> ===',
  },
  {
    pattern: /\b(?:double\s+equals|equals\s+equals)\b/gi,
    replacement: '==',
    category: 'operator',
    description: 'double equals -> ==',
  },
  {
    pattern: /\b(?:not\s+equals|bang\s+equals)\b/gi,
    replacement: '!==',
    category: 'operator',
    description: 'not equals -> !==',
  },
  {
    pattern: /\b(?:arrow\s+function|fat\s+arrow)\b/gi,
    replacement: '=>',
    category: 'operator',
    description: 'arrow function -> =>',
  },
  {
    pattern: /\b(?:pipe\s+pipe|or\s+or)\b/gi,
    replacement: '||',
    category: 'operator',
    description: 'pipe pipe -> ||',
  },
  {
    pattern: /\b(?:and\s+and|ampersand\s+ampersand)\b/gi,
    replacement: '&&',
    category: 'operator',
    description: 'and and -> &&',
  },
];

/**
 * Aplica o pipeline de correção fonética de código ao texto transcrito.
 * Executa em tempo linear O(N) com baixa sobrecarga (< 2ms).
 *
 * # ponytail: substituição regex linear; adicionar léxico fonético baseado em trie caso a lista supere 500 regras.
 */
export function applyCodePhonetics(transcript: string): string {
  if (!transcript || typeof transcript !== 'string') {
    return '';
  }

  let result = transcript;

  for (let i = 0; i < CODE_PHONETIC_RULES.length; i++) {
    const rule = CODE_PHONETIC_RULES[i];
    result = result.replace(rule.pattern, rule.replacement);
  }

  return result;
}

/**
 * Retorna as regras de correção fonética registradas.
 */
export function getCodePhoneticRules(): readonly PhoneticRule[] {
  return CODE_PHONETIC_RULES;
}

/**
 * Concatena ou injeta a transcrição de voz no texto do prompt ativo, aplicando
 * opcionalmente as correções do dicionário fonético de código.
 */
export function injectSpeechToPrompt(
  currentPrompt: string,
  newTranscript: string,
  shouldApplyPhonetics = true
): string {
  const processed = shouldApplyPhonetics ? applyCodePhonetics(newTranscript) : newTranscript;
  const trimmedCurrent = currentPrompt.trim();
  return trimmedCurrent ? `${trimmedCurrent} ${processed}` : processed;
}

