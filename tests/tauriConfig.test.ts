import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const config = read('../src-tauri/tauri.conf.json');
const capability = read('../src-tauri/capabilities/default.json');
const csp: Record<string, string> = config.app.security.csp;

describe('tauri security configuration', () => {
  test('a content security policy is set and scripts only come from the app itself', () => {
    expect(csp).toBeTypeOf('object');
    expect(csp['default-src']).toBe("'self'");
    expect(csp['script-src']).toBe("'self'");
    expect(csp['object-src']).toBe("'none'");
    expect(JSON.stringify(csp)).not.toContain('unsafe-eval');
    expect(csp['script-src']).not.toContain('unsafe-inline');
  });

  test('the app can reach its own IPC and nothing remote', () => {
    expect(csp['connect-src']).toContain('ipc:');
    expect(csp['connect-src']).not.toMatch(/https?:\/\/(?!ipc\.localhost)/);
  });

  test('only local dev servers can be framed by the live preview', () => {
    for (const source of csp['frame-src'].split(' ')) {
      expect(source).toMatch(/^https?:\/\/(localhost|127\.0\.0\.1):\*$/);
    }
    expect(csp['frame-ancestors']).toBe("'none'");
  });

  test('the window capability grants only what the frontend uses', () => {
    expect(capability.permissions).toEqual(['core:default', 'dialog:allow-open']);
  });
});
