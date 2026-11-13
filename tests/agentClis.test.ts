import { describe, expect, test } from 'vitest';
import {
  buildAgentCommand,
  buildTeamProtocolNote,
  cliForProvider,
} from '../src/config/agentClis.ts';

describe('agentClis', () => {
  test('claude gets model, persona and permission flags as separate arguments', () => {
    expect(
      buildAgentCommand({
        cli: 'claude',
        cliModel: 'sonnet',
        persona: "it's a persona; rm -rf ~",
        autoApprove: true,
        resume: false,
      })
    ).toEqual([
      'claude',
      '--model',
      'sonnet',
      '--dangerously-skip-permissions',
      '--append-system-prompt',
      "it's a persona; rm -rf ~",
    ]);
  });

  test('the CLI default model is used when none is given', () => {
    expect(
      buildAgentCommand({ cli: 'claude', persona: '', autoApprove: false, resume: false })
    ).toEqual(['claude']);
  });

  test('resume continues the previous conversation of each CLI', () => {
    const base = { persona: 'p', autoApprove: false, resume: true } as const;
    expect(buildAgentCommand({ cli: 'claude', ...base })).toEqual([
      'claude',
      '--continue',
      '--append-system-prompt',
      'p',
    ]);
    expect(buildAgentCommand({ cli: 'codex', cliModel: 'm', ...base })).toEqual([
      'codex',
      'resume',
      '--last',
      '-m',
      'm',
    ]);
    expect(buildAgentCommand({ cli: 'gemini', ...base })).toEqual(['gemini', '--resume', 'latest']);
  });

  test('codex and gemini receive the persona as the opening prompt', () => {
    const base = { persona: 'be brief', autoApprove: true, resume: false } as const;
    expect(buildAgentCommand({ cli: 'codex', ...base })).toEqual([
      'codex',
      '--dangerously-bypass-approvals-and-sandbox',
      'be brief',
    ]);
    expect(buildAgentCommand({ cli: 'gemini', cliModel: 'pro', ...base })).toEqual([
      'gemini',
      '-m',
      'pro',
      '--approval-mode',
      'yolo',
      '-i',
      'be brief',
    ]);
  });

  test('ollama runs the selected local model', () => {
    expect(
      buildAgentCommand({ cli: 'ollama', cliModel: 'qwen2.5-coder', persona: 'x', autoApprove: false, resume: false })
    ).toEqual(['ollama', 'run', 'qwen2.5-coder']);
  });

  test('every provider maps to a CLI', () => {
    expect(cliForProvider('anthropic')).toBe('claude');
    expect(cliForProvider('openai')).toBe('codex');
    expect(cliForProvider('google')).toBe('gemini');
    expect(cliForProvider('ollama')).toBe('ollama');
  });

  test('the protocol note names the workspace and every colleague but not the agent itself', () => {
    const note = buildTeamProtocolNote({
      self: { key: 'frontend', title: 'Frontend UI', role: 'frontend' },
      team: [
        { key: 'orchestrator', title: 'Orchestrator', role: 'architect' },
        { key: 'frontend', title: 'Frontend UI', role: 'frontend' },
      ],
      branch: 'helm/swarm-s1-frontend',
      baseBranch: 'main',
      port: 3002,
    });
    expect(note).toContain('chave `frontend`');
    expect(note).toContain('helm/swarm-s1-frontend');
    expect(note).toContain('3002');
    expect(note).toContain('`orchestrator` — Orchestrator (architect)');
    expect(note).not.toContain('`frontend` — Frontend UI');
    expect(note).toContain('helmade send');
  });
});
