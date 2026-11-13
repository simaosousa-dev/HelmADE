import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import {
  applyCodePhonetics,
  getCodePhoneticRules,
  injectSpeechToPrompt,
} from '../src/config/codePhonetics.ts';

describe('code phonetics for dictation', () => {
  test('Verificação do Dicionário de Correção Fonética de Código', () => {
    const rules = getCodePhoneticRules();
    assert.ok(rules.length >= 20, 'O dicionário deve conter pelo menos 20 regras fonéticas');

    const testCases: Array<[string, string]> = [
      ['get commit -m "feat: voice"', 'git commit -m "feat: voice"'],
      ['get push origin main', 'git push origin main'],
      ['get pull', 'git pull'],
      ['get status', 'git status'],
      ['work tree add ../feature', 'worktree add ../feature'],
      ['run en pee em test', 'run npm test'],
      ['run n p m install', 'run npm install'],
      ['use type script for strictness', 'use TypeScript for strictness'],
      ['use darker compost up -d', 'use docker compose up -d'],
      ['connect to sequel light database', 'connect to SQLite database'],
      ['if x triple equals y', 'if x === y'],
      ['cost counter = 10', 'const counter = 10'],
      ['let active = true', 'let active = true'],
      ['condition one pipe pipe condition two', 'condition one || condition two'],
      ['flag one and and flag two', 'flag one && flag two'],
      ['check get hub pull request', 'check GitHub PR'],
    ];

    for (const [input, expected] of testCases) {
      const corrected = applyCodePhonetics(input);
      assert.equal(
        corrected,
        expected,
        `Falha na correção fonética: esperado "${expected}", obtido "${corrected}"`
      );
    }
  });

  test('Benchmark de Desempenho do Dicionário Fonético (< 2ms por inferência)', () => {
    const startBenchmark = performance.now();
    const sampleText = 'get commit with type script using en pee em and test darker compost on sequel light';
    for (let i = 0; i < 500; i++) {
      applyCodePhonetics(sampleText);
    }
    const elapsedMs = performance.now() - startBenchmark;
    const avgMsPerPass = elapsedMs / 500;
    assert.ok(
      avgMsPerPass < 1.0,
      `O processador fonético deve executar em < 1ms por chamada (média: ${avgMsPerPass.toFixed(3)}ms)`
    );
  });

  test('Injeção em Tempo Real no Prompt com Correção Fonética', () => {
    // Injeção em prompt vazio
    const injectedEmpty = injectSpeechToPrompt('', 'get commit -m "fix: bug" and en pee em test');
    assert.equal(
      injectedEmpty,
      'git commit -m "fix: bug" and npm test',
      'O texto corrigido foneticamente deve ser injetado no prompt vazio'
    );

    // Concatenação com prompt existente
    const currentPrompt = 'Por favor executa o comando:';
    const injectedCombined = injectSpeechToPrompt(currentPrompt, 'get status and run kargo check');
    assert.equal(
      injectedCombined,
      'Por favor executa o comando: git status and run cargo check',
      'O texto deve ser concatenado ao prompt existente preservando espaços e corrigindo fonética'
    );

    // Sem aplicação fonética quando explicitamente desativada
    const rawInjected = injectSpeechToPrompt('', 'get commit', false);
    assert.equal(rawInjected, 'get commit');
  });
});
