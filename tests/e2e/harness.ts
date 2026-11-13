import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

export const BRIDGE_PORT = 47831;
export const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;
const APP_BINARY = join(repoRoot, 'target', 'debug', 'helmade');
const AGENT_STUB = join(here, 'fixtures', 'fake-agent.sh');

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** A throw-away git project with an ignored `node_modules` and a tiny dev server. */
export function createFixtureProject(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'helmade-e2e-project-')));
  git(dir, 'init', '--quiet', '--initial-branch=main');
  git(dir, 'config', 'user.name', 'HelmADE E2E');
  git(dir, 'config', 'user.email', 'e2e@helmade.dev');
  git(dir, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(dir, 'README.md'), '# Fixture\n');
  cpSync(join(here, 'fixtures', 'server.mjs'), join(dir, 'server.mjs'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'marker.txt'), 'shared dependency\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'chore: initial commit');
  return dir;
}

/** The real app process (Rust backend + test bridge) with an isolated data directory. */
export class AppUnderTest {
  readonly home = realpathSync(mkdtempSync(join(tmpdir(), 'helmade-e2e-home-')));
  private child: ChildProcess | null = null;

  async start(): Promise<void> {
    if (!existsSync(APP_BINARY)) {
      throw new Error(`Missing ${APP_BINARY}. Build it with: cargo build --features e2e-bridge`);
    }
    this.child = spawn(APP_BINARY, [], {
      env: {
        ...process.env,
        HELMADE_HOME: this.home,
        HELMADE_E2E_BRIDGE_PORT: String(BRIDGE_PORT),
        HELMADE_E2E_AGENT_STUB: AGENT_STUB,
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        // The bridge answers before the window exists; wait until commands really run.
        await this.invoke('list_recent_projects', { limit: 1 });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw new Error('The app did not become ready in time');
  }

  /** Stops the app and waits for the process to be gone. */
  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.kill('SIGTERM');
    await exited;
  }

  async invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${BRIDGE_URL}/invoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cmd, args }),
    });
    const reply = (await response.json()) as { ok: boolean; data?: T; error?: unknown };
    if (!reply.ok) throw new Error(JSON.stringify(reply.error));
    return reply.data as T;
  }

  scrollback(sessionId: string): Promise<string> {
    return this.invoke<string>('get_pty_scrollback', { sessionId });
  }

  cleanup(): void {
    rmSync(this.home, { recursive: true, force: true });
  }
}

/** Polls until `probe` returns a truthy value. */
export async function eventually<T>(
  probe: () => Promise<T> | T,
  description: string,
  timeoutMs = 15_000
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for: ${description}${lastError ? ` (${String(lastError)})` : ''}`);
}

/** Processes still running the agent stub (there must be none after the app quits). */
export function runningAgentStubs(): string[] {
  try {
    return execFileSync('pgrep', ['-fl', AGENT_STUB], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch {
    // pgrep exits 1 when nothing matches.
    return [];
  }
}
