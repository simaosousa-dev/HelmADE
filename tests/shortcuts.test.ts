import { describe, expect, test } from 'vitest';
import {
  SHORTCUTS,
  findShortcut,
  formatBinding,
  matchesBinding,
  type KeyLike,
} from '../src/config/shortcuts.ts';

function key(code: string, mods: Partial<KeyLike> = {}): KeyLike {
  return { code, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...mods };
}

describe('shortcuts', () => {
  test('ids are unique and no two actions share a binding', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const bindings = SHORTCUTS.filter((s) => s.binding).map((s) => formatBinding(s.binding!));
    expect(new Set(bindings).size).toBe(bindings.length);
  });

  test('every primary action of the core loop has a shortcut', () => {
    for (const id of [
      'swarm.new',
      'swarm.close',
      'swarm.next',
      'review.open',
      'attention.next',
      'panel.maximize',
      'wire.toggle',
      'preview.toggle',
      'shield.streamer',
      'palette.open',
      'voice.ptt',
    ]) {
      expect(SHORTCUTS.find((s) => s.id === id)?.binding, id).toBeDefined();
    }
  });

  test('bindings are formatted in macOS order', () => {
    expect(formatBinding({ code: 'KeyD', meta: true, shift: true })).toBe('⇧⌘D');
    expect(formatBinding({ code: 'ArrowRight', meta: true, alt: true })).toBe('⌥⌘→');
    expect(formatBinding({ code: 'Digit3', meta: true })).toBe('⌘3');
    expect(formatBinding({ code: 'Space', alt: true })).toBe('⌥Espaço');
  });

  test('matching is exact about modifiers', () => {
    const binding = { code: 'KeyT', meta: true };
    expect(matchesBinding(key('KeyT', { metaKey: true }), binding)).toBe(true);
    expect(matchesBinding(key('KeyT', { ctrlKey: true }), binding)).toBe(true);
    expect(matchesBinding(key('KeyT'), binding)).toBe(false);
    expect(matchesBinding(key('KeyT', { metaKey: true, shiftKey: true }), binding)).toBe(false);
    expect(matchesBinding(key('KeyT', { metaKey: true, altKey: true }), binding)).toBe(false);
  });

  test('a key event resolves to its action and plain typing resolves to none', () => {
    expect(findShortcut(key('KeyD', { metaKey: true, shiftKey: true }))?.id).toBe('review.open');
    expect(findShortcut(key('Digit2', { metaKey: true }))?.id).toBe('swarm.goto.2');
    expect(findShortcut(key('Digit2', { metaKey: true, altKey: true }))?.id).toBe('layout.1x2');
    expect(findShortcut(key('KeyD'))).toBeUndefined();
    // The system-wide push-to-talk shortcut is never handled by the window.
    expect(findShortcut(key('Space', { altKey: true }))).toBeUndefined();
  });
});
