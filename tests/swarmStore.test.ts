import { beforeEach, describe, expect, test } from 'vitest';
import { gridLayoutStore } from '../src/stores/useGridLayoutStore.ts';
import { swarmStore } from '../src/stores/useSwarmStore.ts';
import type { Swarm, SwarmPanel } from '../src/types/swarm.ts';

function panel(swarmId: string, key: string): SwarmPanel {
  return {
    key,
    title: `Panel ${key}`,
    agentId: 'fullstack-engineer',
    role: 'fullstack',
    color: 'blue',
    kind: 'agent',
    cli: 'claude',
    modelId: 'm',
    worktreeId: `${swarmId}-${key}`,
    worktreePath: `/repo/.helm/worktrees/${swarmId}-${key}`,
    branch: `helm/swarm-${swarmId}-${key}`,
    port: 3001,
  };
}

function swarm(id: string, position = 0, keys = ['a', 'b', 'c']): Swarm {
  return {
    id,
    projectId: 'p1',
    name: `Swarm ${id}`,
    presetId: null,
    layout: '2x2',
    baseBranch: 'main',
    autoApprove: false,
    position,
    createdAt: 1,
    panels: keys.map((key) => panel(id, key)),
  };
}

describe('swarmStore', () => {
  beforeEach(() => swarmStore.reset());

  test('a new swarm becomes the active tab with its first panel focused', () => {
    swarmStore.addSwarm(swarm('s1'));
    swarmStore.addSwarm(swarm('s2', 1));
    const state = swarmStore.getState();
    expect(state.swarms.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(state.activeSwarmId).toBe('s2');
    expect(state.ui.s2).toEqual({ activePanelId: 's2-a', maximizedPanelId: null });

    swarmStore.addSwarm(swarm('s2', 1));
    expect(swarmStore.getState().swarms).toHaveLength(2);
  });

  test('tabs cycle and wrap around', () => {
    swarmStore.replaceAll([swarm('s2', 1), swarm('s1', 0), swarm('s3', 2)], 's1');
    expect(swarmStore.getState().swarms.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    swarmStore.cycleSwarm(-1);
    expect(swarmStore.getState().activeSwarmId).toBe('s3');
    swarmStore.cycleSwarm(1);
    expect(swarmStore.getState().activeSwarmId).toBe('s1');
    swarmStore.setActiveSwarm('missing');
    expect(swarmStore.getState().activeSwarmId).toBe('s1');
  });

  test('restoring falls back to the first tab when the remembered one is gone', () => {
    swarmStore.replaceAll([swarm('s1'), swarm('s2', 1)], 'deleted');
    expect(swarmStore.getState().activeSwarmId).toBe('s1');
    swarmStore.replaceAll([]);
    expect(swarmStore.getState().activeSwarmId).toBeNull();
  });

  test('removing the active swarm activates its neighbour and drops its runtime state', () => {
    swarmStore.replaceAll([swarm('s1'), swarm('s2', 1), swarm('s3', 2)], 's2');
    swarmStore.setPanelStatus('s2-a', 'running');
    swarmStore.removeSwarm('s2');
    const state = swarmStore.getState();
    expect(state.activeSwarmId).toBe('s3');
    expect(state.ui.s2).toBeUndefined();
    expect(state.statuses['s2-a']).toBeUndefined();

    swarmStore.removeSwarm('s3');
    swarmStore.removeSwarm('s1');
    expect(swarmStore.getState().activeSwarmId).toBeNull();
  });

  test('panel edits only touch the targeted panel', () => {
    swarmStore.addSwarm(swarm('s1'));
    const before = swarmStore.getState().swarms[0];
    swarmStore.updatePanel('s1', 's1-b', { title: 'Renamed', color: 'gold' });
    const after = swarmStore.getState().swarms[0];
    expect(after.panels[1]).toMatchObject({ title: 'Renamed', color: 'gold', key: 'b' });
    expect(after.panels[0]).toBe(before.panels[0]);
    expect(after).not.toBe(before);
  });

  test('removing the focused, maximized panel moves focus and leaves maximize', () => {
    swarmStore.addSwarm(swarm('s1'));
    swarmStore.toggleMaximize('s1', 's1-b');
    swarmStore.removePanel('s1', 's1-b');
    const state = swarmStore.getState();
    expect(state.swarms[0].panels.map((p) => p.key)).toEqual(['a', 'c']);
    expect(state.ui.s1).toEqual({ activePanelId: 's1-c', maximizedPanelId: null });
  });

  test('cycling panels follows the maximized panel', () => {
    swarmStore.addSwarm(swarm('s1'));
    swarmStore.cyclePanel(1);
    expect(swarmStore.getState().ui.s1.activePanelId).toBe('s1-b');
    swarmStore.toggleMaximize('s1', 's1-b');
    swarmStore.cyclePanel(1);
    expect(swarmStore.getState().ui.s1).toEqual({ activePanelId: 's1-c', maximizedPanelId: 's1-c' });
    swarmStore.cyclePanel(1);
    expect(swarmStore.getState().ui.s1.activePanelId).toBe('s1-a');
  });

  test('findPanel resolves a session id to its swarm and panel', () => {
    swarmStore.replaceAll([swarm('s1'), swarm('s2', 1)]);
    expect(swarmStore.findPanel('s2-c')?.swarm.id).toBe('s2');
    expect(swarmStore.findPanel('s2-c')?.panel.key).toBe('c');
    expect(swarmStore.findPanel('nope')).toBeNull();
  });
});

describe('gridLayoutStore (view of the active swarm)', () => {
  beforeEach(() => swarmStore.reset());

  test('is empty without swarms and returns a stable snapshot', () => {
    const first = gridLayoutStore.getState();
    expect(first.panels).toEqual([]);
    expect(first.swarmId).toBeNull();
    expect(gridLayoutStore.getState()).toBe(first);
  });

  test('exposes the active swarm panels with their runtime status', () => {
    swarmStore.replaceAll([swarm('s1'), swarm('s2', 1, ['x'])], 's1');
    swarmStore.setPanelStatus('s1-b', 'blocked');
    const view = gridLayoutStore.getState();
    expect(view.swarmId).toBe('s1');
    expect(view.panels.map((p) => [p.id, p.key, p.status])).toEqual([
      ['s1-a', 'a', 'idle'],
      ['s1-b', 'b', 'blocked'],
      ['s1-c', 'c', 'idle'],
    ]);

    swarmStore.setActiveSwarm('s2');
    expect(gridLayoutStore.getState().panels.map((p) => p.id)).toEqual(['s2-x']);
  });

  test('grid actions are applied to the active swarm only', () => {
    swarmStore.replaceAll([swarm('s1'), swarm('s2', 1)], 's2');
    gridLayoutStore.setLayout('1x2');
    gridLayoutStore.updatePanelTitle('s2-a', 'Lead');
    gridLayoutStore.toggleMaximizePanel('s2-b');
    const [s1, s2] = swarmStore.getState().swarms;
    expect(s1.layout).toBe('2x2');
    expect(s2.layout).toBe('1x2');
    expect(s2.panels[0].title).toBe('Lead');
    expect(gridLayoutStore.getState().maximizedPanelId).toBe('s2-b');
    gridLayoutStore.toggleMaximizePanel('s2-b');
    expect(gridLayoutStore.getState().maximizedPanelId).toBeNull();
  });
});
