import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBinding, type ShortcutBinding } from '../../config/shortcuts';

export interface PaletteCommand {
  id: string;
  title: string;
  section: string;
  binding?: ShortcutBinding;
  run: () => void;
}

export interface CommandPaletteProps {
  commands: PaletteCommand[];
  onClose: () => void;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Every word of the query must appear in the title or section (accents ignored). */
export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return commands;
  return commands.filter((command) => {
    const haystack = normalise(`${command.section} ${command.title}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** ⌘K launcher: type to filter, ↑↓ to move, ↩ to run, Esc to close. */
export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  const active = Math.min(selected, Math.max(0, results.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (command: PaletteCommand | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(Math.min(active + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(Math.max(active - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-start justify-center bg-scrim px-6 pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        data-testid="command-palette"
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-macos-lg border border-separator bg-raised shadow-popover"
      >
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          placeholder="Escreve um comando…"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
          data-testid="command-palette-input"
          className="h-12 w-full border-b border-separator bg-transparent px-4 text-headline text-fg placeholder:text-fg-subtle focus:outline-none"
        />
        <ul id="palette-results" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-body text-fg-muted">Nenhum comando encontrado.</li>
          )}
          {results.map((command, index) => (
            <li
              key={command.id}
              id={`palette-${command.id}`}
              role="option"
              aria-selected={index === active}
              data-index={index}
              data-testid={`palette-command-${command.id}`}
              onMouseMove={() => setSelected(index)}
              onClick={() => run(command)}
              className={`flex min-h-[44px] cursor-default items-center justify-between gap-3 rounded-macos px-3 ${
                index === active ? 'bg-accent-solid text-on-solid' : 'text-fg'
              }`}
            >
              <span className="min-w-0 truncate text-body">
                <span className={index === active ? 'opacity-80' : 'text-fg-subtle'}>{command.section} · </span>
                {command.title}
              </span>
              {command.binding && (
                <kbd className="shrink-0 font-sf text-caption tracking-widest opacity-90">
                  {formatBinding(command.binding)}
                </kbd>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
