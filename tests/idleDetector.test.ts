import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { terminalStore } from '../src/stores/useTerminalStore.ts';
import type { BlockedPromptInfo } from '../src/types/terminal.ts';

describe('idleDetector', () => {
  test('Initial state', () => {
    terminalStore.reset();
    const initial = terminalStore.getState();
    assert.deepEqual(initial.blockedPrompts, {});
    assert.deepEqual(initial.standbySessions, {});
    assert.deepEqual(initial.sessionStatuses, {});
  });

  test('Set blocked prompt', () => {
    const prompt1: BlockedPromptInfo = {
      sessionId: 'pty-sess-1',
      promptText: 'Do you want to continue? [Y/n]',
      promptType: 'yes_no',
      defaultChoice: 'y',
      suggestedOptions: ['y', 'n'],
      timestamp: Date.now(),
    };

    terminalStore.setBlockedPrompt('pty-sess-1', prompt1);
    const stateAfterBlocked = terminalStore.getState();
    assert.equal(stateAfterBlocked.sessionStatuses['pty-sess-1'], 'blocked');
    assert.deepEqual(stateAfterBlocked.blockedPrompts['pty-sess-1'], prompt1);
  });

  test('Clear blocked prompt', () => {
    terminalStore.clearBlockedPrompt('pty-sess-1');
    const stateAfterCleared = terminalStore.getState();
    assert.equal(stateAfterCleared.blockedPrompts['pty-sess-1'], undefined);
    assert.equal(stateAfterCleared.sessionStatuses['pty-sess-1'], 'running');
  });

  test('Standby toggle and state tracking', () => {
    terminalStore.setStandby('pty-sess-2', true);
    let stateStandby = terminalStore.getState();
    assert.equal(stateStandby.standbySessions['pty-sess-2'], true);
    assert.equal(stateStandby.sessionStatuses['pty-sess-2'], 'standby');

    terminalStore.setStandby('pty-sess-2', false);
    stateStandby = terminalStore.getState();
    assert.equal(stateStandby.standbySessions['pty-sess-2'], false);
    assert.equal(stateStandby.sessionStatuses['pty-sess-2'], 'running');
  });

  test('Blocked prompt on standby session returns to standby when cleared', () => {
    terminalStore.setStandby('pty-sess-3', true);
    terminalStore.setBlockedPrompt('pty-sess-3', {
      sessionId: 'pty-sess-3',
      promptText: 'Password:',
      promptType: 'password',
      suggestedOptions: [],
      timestamp: Date.now(),
    });
    assert.equal(terminalStore.getState().sessionStatuses['pty-sess-3'], 'blocked');

    terminalStore.clearBlockedPrompt('pty-sess-3');
    assert.equal(terminalStore.getState().sessionStatuses['pty-sess-3'], 'standby');
  });

  test('Reset', () => {
    terminalStore.reset();
    assert.deepEqual(terminalStore.getState().blockedPrompts, {});
    assert.deepEqual(terminalStore.getState().standbySessions, {});
  });
});
