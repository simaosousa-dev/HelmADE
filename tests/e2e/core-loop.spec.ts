import { expect, test, type Page } from '@playwright/test';
import { existsSync, lstatSync, readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { AppUnderTest, createFixtureProject, eventually, git, runningAgentStubs } from './harness';

interface PanelRecord {
  key: string;
  title: string;
  cli: string | null;
  worktreeId: string;
  worktreePath: string;
  branch: string;
  port: number;
}

interface SwarmRecord {
  id: string;
  name: string;
  baseBranch: string;
  panels: PanelRecord[];
}

const app = new AppUnderTest();
let projectPath = '';
let projectId = '';

test.beforeAll(async () => {
  projectPath = createFixtureProject();
  await app.start();
  const project = await app.invoke<{ id: string }>('upsert_project', {
    id: 'proj_e2e',
    name: basename(projectPath),
    path: projectPath,
  });
  projectId = project.id;
});

test.afterAll(async () => {
  await app.stop();
  app.cleanup();
  rmSync(projectPath, { recursive: true, force: true });
});

async function openProject(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId(`project-card-${basename(projectPath)}`).click();
  await expect(page.getByTestId('project-name')).toHaveText(basename(projectPath));
}

async function typeInPanel(page: Page, sessionId: string, text: string): Promise<void> {
  await page.getByTestId(`terminal-container-${sessionId}`).click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

function swarms(): Promise<SwarmRecord[]> {
  return app.invoke<SwarmRecord[]>('list_swarms', { projectId });
}

test('core loop: launch → isolate → talk → unblock → preview → review → merge → restore → clean up', async ({
  page,
}) => {
  let swarm!: SwarmRecord;
  const panel = (key: string) => {
    const found = swarm.panels.find((p) => p.key === key);
    if (!found) throw new Error(`panel ${key} not found`);
    return found;
  };

  await test.step('open the project and launch a 4-agent swarm preset', async () => {
    await openProject(page);
    await page.getByTestId('new-swarm-button').click();
    await page.getByRole('button', { name: /Quarteto Feature/ }).first().click();
    await page.getByTestId('swarm-mission-name').fill('Checkout');
    await page.getByRole('button', { name: /Lançar/ }).last().click();

    swarm = await eventually(async () => (await swarms())[0], 'the swarm to be saved');
    expect(swarm.name).toBe('Checkout');
    expect(swarm.baseBranch).toBe('main');
    expect(swarm.panels.map((p) => p.key)).toEqual(['orchestrator', 'fullstack', 'frontend', 'qa']);
    await expect(page.getByTestId(`swarm-tab-${swarm.id}`)).toContainText('Checkout');
    for (const p of swarm.panels) {
      await expect(page.getByTestId(`grid-panel-${p.worktreeId}`)).toBeVisible();
    }
  });

  await test.step('every agent runs in its own worktree, on its own branch, with shared deps and its own port', async () => {
    const branches = git(projectPath, 'branch', '--list', 'helm/*', '--format=%(refname:short)').split('\n');
    expect(branches.sort()).toEqual(swarm.panels.map((p) => p.branch).sort());
    expect(new Set(swarm.panels.map((p) => p.port)).size).toBe(4);

    for (const p of swarm.panels) {
      expect(p.worktreePath).toBe(join(projectPath, '.helm', 'worktrees', p.worktreeId));
      expect(git(p.worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(p.branch);
      expect(lstatSync(join(p.worktreePath, 'node_modules')).isSymbolicLink()).toBe(true);
      expect(readFileSync(join(p.worktreePath, 'node_modules', 'marker.txt'), 'utf8')).toContain('shared dependency');

      const banner = await eventually(async () => {
        const output = await app.scrollback(p.worktreeId);
        return output.includes('FAKE_AGENT_READY') ? output : null;
      }, `agent ${p.key} to start`);
      expect(banner).toContain(`key=${p.key}`);
      expect(banner).toContain('protocol=yes');
      expect(banner).toContain(`port=${p.port}`);
      expect(banner).toContain(`cwd=${p.worktreePath}`);
    }
    // The main checkout is untouched and stays clean.
    expect(git(projectPath, 'status', '--porcelain')).toBe('');
  });

  await test.step('agents exchange A2A messages that show up in Team Wire', async () => {
    await page.getByTestId('wire-toggle').click();
    await typeInPanel(page, panel('orchestrator').worktreeId, '!helmade send qa "run the suite"');

    const message = page.getByTestId('wire-message').filter({ hasText: 'run the suite' });
    await expect(message).toBeVisible();
    await expect(message).toContainText('Orchestrator');
    await eventually(
      async () => (await app.scrollback(panel('qa').worktreeId)).includes('FAKE_AGENT_GOT: [A2A de @Orchestrator] run the suite'),
      'the QA agent to receive the message as a prompt'
    );

    // The human talks to the orchestrator through the prompt box.
    await page.locator('[data-prompt-input]').fill('ship the checkout');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('wire-message').filter({ hasText: 'ship the checkout' })).toBeVisible();
    await eventually(
      async () => (await app.scrollback(panel('orchestrator').worktreeId)).includes('FAKE_AGENT_GOT: ship the checkout'),
      'the orchestrator to receive the human prompt'
    );
    await page.getByTestId('wire-toggle').click();
  });

  await test.step('a blocked y/N prompt is detected and answered from the cockpit', async () => {
    const fullstack = panel('fullstack').worktreeId;
    await typeInPanel(page, fullstack, `!printf 'Apply migration? [y/N] '; read answer; echo "ANSWERED=$answer"`);

    await expect(page.getByTestId(`blocked-prompt-banner-${fullstack}`)).toBeVisible();
    await expect(page.getByTestId(`swarm-tab-attention-${swarm.id}`)).toHaveText('1');
    await expect(page.getByTestId('attention-button')).toBeVisible();

    await page.getByTestId(`blocked-prompt-yes-${fullstack}`).click();
    await eventually(async () => (await app.scrollback(fullstack)).includes('ANSWERED=y'), 'the prompt to be answered');
    await expect(page.getByTestId(`blocked-prompt-banner-${fullstack}`)).toBeHidden();
  });

  await test.step('the live preview shows the dev server an agent started on its own port', async () => {
    const frontend = panel('frontend');
    await typeInPanel(page, frontend.worktreeId, '!node server.mjs &');

    const frame = page.frameLocator('[data-testid="preview-frame"]');
    await expect(frame.locator('#fixture')).toHaveText('HELM FIXTURE OK', { timeout: 30_000 });
    await expect(page.getByTestId('preview-frame')).toHaveAttribute('src', new RegExp(`localhost:${frontend.port}`));
    await page.getByTestId('preview-toggle').click();
  });

  await test.step('review an agent diff (uncommitted work included) and merge it into main', async () => {
    const fullstack = panel('fullstack');
    await typeInPanel(page, fullstack.worktreeId, '!echo "checkout feature" > feature.txt');
    await eventually(() => existsSync(join(fullstack.worktreePath, 'feature.txt')), 'the agent to write its file');

    await page.getByTestId('review-button').click();
    await page.getByTestId('review-agent-fullstack').click();
    await expect(page.getByTestId('review-branch')).toHaveText(fullstack.branch);
    await expect(page.getByTestId('diff-file-feature.txt')).toBeVisible();
    await page.getByTestId('confirm-merge').click();

    await expect(page.getByTestId('toast-success').filter({ hasText: 'integradas em main' })).toBeVisible();
    expect(readFileSync(join(projectPath, 'feature.txt'), 'utf8')).toBe('checkout feature\n');
    expect(git(projectPath, 'log', '-1', '--format=%s')).toBe('feat(swarm): integrate changes from fullstack');
    expect(git(projectPath, 'status', '--porcelain')).toBe('');

    // The merged agent's workspace is cleaned up; the others are intact.
    await eventually(() => !existsSync(fullstack.worktreePath), 'the merged worktree to be removed');
    expect(git(projectPath, 'branch', '--list', fullstack.branch)).toBe('');
    await expect(page.getByTestId(`grid-panel-${fullstack.worktreeId}`)).toHaveCount(0);
    expect(existsSync(panel('qa').worktreePath)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('merge-review')).toHaveCount(0);
  });

  await test.step('restarting the app restores the swarm in its existing worktrees', async () => {
    await app.stop();
    expect(runningAgentStubs()).toEqual([]);
    await app.start();
    await openProject(page);

    await expect(page.getByTestId(`swarm-tab-${swarm.id}`)).toContainText('Checkout');
    await expect(page.getByTestId('toast-success').filter({ hasText: 'Sessão restaurada' })).toBeVisible();
    const restored = (await swarms())[0];
    expect(restored.panels.map((p) => p.key)).toEqual(['orchestrator', 'frontend', 'qa']);
    for (const p of restored.panels) {
      await expect(page.getByTestId(`grid-panel-${p.worktreeId}`)).toBeVisible();
      const banner = await eventually(async () => {
        const output = await app.scrollback(p.worktreeId);
        return output.includes('FAKE_AGENT_READY') ? output : null;
      }, `agent ${p.key} to be respawned`);
      expect(banner).toContain(`cwd=${p.worktreePath}`);
    }

    // Team Wire history survived the restart.
    await page.getByTestId('wire-toggle').click();
    await expect(page.getByTestId('wire-message').filter({ hasText: 'run the suite' })).toBeVisible();
    await page.getByTestId('wire-toggle').click();
  });

  await test.step('closing the swarm removes every worktree, branch and process', async () => {
    await page.getByTestId(`swarm-tab-close-${swarm.id}`).click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('close-swarm-discard').click();

    await expect(page.getByTestId('swarm-tabs')).toHaveCount(0);
    await eventually(async () => (await swarms()).length === 0, 'the swarm record to be deleted');
    expect(git(projectPath, 'worktree', 'list').split('\n')).toHaveLength(1);
    expect(git(projectPath, 'branch', '--list', 'helm/*')).toBe('');
    await eventually(() => runningAgentStubs().length === 0, 'agent processes to exit').catch((error) => {
      throw new Error(`${error}\n${runningAgentStubs().join('\n')}`);
    });
  });
});
