/**
 * Every keyboard shortcut of the cockpit. This list drives the global key handler,
 * the command palette and the shortcut table of the user guide.
 */

export interface ShortcutBinding {
  /** `KeyboardEvent.code`, so the match is independent of what Shift/Option do to the character. */
  code: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type ShortcutSection = 'Enxames' | 'Painéis' | 'Supervisão' | 'Vista' | 'Segurança' | 'Voz';

export interface ShortcutDefinition {
  id: string;
  title: string;
  section: ShortcutSection;
  binding?: ShortcutBinding;
  /** Handled outside the window key handler (system-wide shortcut). Listed for discovery only. */
  global?: boolean;
}

const cmd = (code: string, extra: Omit<ShortcutBinding, 'code' | 'meta'> = {}): ShortcutBinding => ({
  code,
  meta: true,
  ...extra,
});

const LAYOUTS = ['1x1', '1x2', '2x2', '2x3', '3x3', '4x4'] as const;

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: 'palette.open', title: 'Paleta de comandos', section: 'Vista', binding: cmd('KeyK') },
  { id: 'swarm.new', title: 'Novo enxame', section: 'Enxames', binding: cmd('KeyT') },
  { id: 'swarm.close', title: 'Fechar enxame', section: 'Enxames', binding: cmd('KeyW', { shift: true }) },
  { id: 'swarm.next', title: 'Enxame seguinte', section: 'Enxames', binding: cmd('BracketRight', { shift: true }) },
  { id: 'swarm.prev', title: 'Enxame anterior', section: 'Enxames', binding: cmd('BracketLeft', { shift: true }) },
  ...Array.from({ length: 9 }, (_, index): ShortcutDefinition => ({
    id: `swarm.goto.${index + 1}`,
    title: `Ir para o enxame ${index + 1}`,
    section: 'Enxames',
    binding: cmd(`Digit${index + 1}`),
  })),
  { id: 'review.open', title: 'Rever e fundir', section: 'Supervisão', binding: cmd('KeyD', { shift: true }) },
  { id: 'attention.next', title: 'Ir para o próximo agente bloqueado', section: 'Supervisão', binding: cmd('KeyJ', { shift: true }) },
  { id: 'prompt.focus', title: 'Escrever ao orquestrador', section: 'Supervisão', binding: cmd('KeyL') },
  { id: 'wire.toggle', title: 'Mostrar ou ocultar o Team Wire', section: 'Supervisão', binding: cmd('KeyM', { shift: true }) },
  { id: 'preview.toggle', title: 'Mostrar ou ocultar o Live Preview', section: 'Supervisão', binding: cmd('KeyL', { shift: true }) },
  { id: 'usage.open', title: 'Consumo e custos', section: 'Supervisão', binding: cmd('KeyU', { shift: true }) },
  { id: 'panel.next', title: 'Painel seguinte', section: 'Painéis', binding: cmd('ArrowRight', { alt: true }) },
  { id: 'panel.prev', title: 'Painel anterior', section: 'Painéis', binding: cmd('ArrowLeft', { alt: true }) },
  { id: 'panel.maximize', title: 'Maximizar ou restaurar o painel', section: 'Painéis', binding: cmd('Enter') },
  ...LAYOUTS.map((layout, index): ShortcutDefinition => ({
    id: `layout.${layout}`,
    title: `Layout ${layout}`,
    section: 'Vista',
    binding: cmd(`Digit${index + 1}`, { alt: true }),
  })),
  { id: 'project.home', title: 'Voltar aos projetos', section: 'Vista', binding: cmd('KeyO', { shift: true }) },
  { id: 'shield.streamer', title: 'Modo apresentação (Streamer Shield)', section: 'Segurança', binding: cmd('KeyS', { shift: true }) },
  { id: 'shield.mask', title: 'Mascarar segredos nos terminais', section: 'Segurança' },
  { id: 'voice.ptt', title: 'Ditar (premir e manter)', section: 'Voz', binding: { code: 'Space', alt: true }, global: true },
];

const KEY_LABELS: Record<string, string> = {
  Enter: '↩',
  Space: 'Espaço',
  ArrowRight: '→',
  ArrowLeft: '←',
  BracketRight: ']',
  BracketLeft: '[',
};

/** Human-readable form of a binding, in macOS order (⌃⌥⇧⌘ then the key). */
export function formatBinding(binding: ShortcutBinding): string {
  const key =
    KEY_LABELS[binding.code] ?? binding.code.replace(/^Key/, '').replace(/^Digit/, '');
  return `${binding.alt ? '⌥' : ''}${binding.shift ? '⇧' : ''}${binding.meta ? '⌘' : ''}${key}`;
}

export interface KeyLike {
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Exact match: extra modifiers never trigger a shortcut. Ctrl stands in for ⌘ off macOS. */
export function matchesBinding(event: KeyLike, binding: ShortcutBinding): boolean {
  return (
    event.code === binding.code &&
    (event.metaKey || event.ctrlKey) === Boolean(binding.meta) &&
    event.shiftKey === Boolean(binding.shift) &&
    event.altKey === Boolean(binding.alt)
  );
}

export function findShortcut(event: KeyLike): ShortcutDefinition | undefined {
  return SHORTCUTS.find(
    (shortcut) => shortcut.binding && !shortcut.global && matchesBinding(event, shortcut.binding)
  );
}
