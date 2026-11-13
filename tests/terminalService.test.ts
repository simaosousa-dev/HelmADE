import { beforeEach, describe, expect, test, vi } from 'vitest';

const calls: string[] = [];
let failOn: string | null = null;

vi.mock('../src/lib/ipc.ts', () => ({
  // Later calls resolve sooner, so unordered sends would arrive reversed.
  invoke: (_command: string, args: { sessionId: string; data: string }) =>
    new Promise<void>((resolve, reject) => {
      const delay = Math.max(0, 20 - calls.length * 5);
      setTimeout(() => {
        if (args.data === failOn) return reject({ code: 'pty', message: 'boom' });
        calls.push(`${args.sessionId}:${args.data}`);
        resolve();
      }, delay);
    }),
  listen: () => Promise.resolve(() => undefined),
}));

const { terminalService } = await import('../src/services/terminalService.ts');

describe('terminalService.writePty', () => {
  beforeEach(() => {
    calls.length = 0;
    failOn = null;
  });

  test('keystrokes of a session reach the PTY in the order they were typed', async () => {
    await Promise.all(['l', 's', ' ', '-', 'l', 'a'].map((key) => terminalService.writePty('s1', key)));
    expect(calls.map((c) => c.split(':')[1]).join('')).toBe('ls -la');
  });

  test('sessions do not wait for each other', async () => {
    await Promise.all([terminalService.writePty('a', '1'), terminalService.writePty('b', '2')]);
    expect(calls.sort()).toEqual(['a:1', 'b:2']);
  });

  test('a failed write rejects for its caller but does not block later input', async () => {
    failOn = 'x';
    const failed = terminalService.writePty('s1', 'x');
    const after = terminalService.writePty('s1', 'y');
    await expect(failed).rejects.toMatchObject({ code: 'pty' });
    await after;
    expect(calls).toEqual(['s1:y']);
  });
});
