import assert from 'node:assert/strict';
import { previewStore } from '../src/stores/usePreviewStore.ts';
import { sanitizeLogMessage, formatLogsForOrchestrator } from '../src/utils/sanitizeLog.ts';

// -------------------------------------------------------------
// Test 1: Navigation history & back/forward actions
// -------------------------------------------------------------
previewStore.reset();
const initial = previewStore.getState();
assert.equal(initial.currentUrl, 'http://localhost:5173');
assert.equal(initial.canGoBack, false);
assert.equal(initial.canGoForward, false);
assert.equal(initial.historyIndex, 0);

// Navigate to /docs
previewStore.navigateTo('http://localhost:5173/docs');
const afterNav1 = previewStore.getState();
assert.equal(afterNav1.currentUrl, 'http://localhost:5173/docs');
assert.equal(afterNav1.canGoBack, true, 'Should be able to go back after navigation');
assert.equal(afterNav1.canGoForward, false);
assert.equal(afterNav1.historyIndex, 1);

// Navigate to /settings
previewStore.navigateTo('http://localhost:5173/settings');
const afterNav2 = previewStore.getState();
assert.equal(afterNav2.currentUrl, 'http://localhost:5173/settings');
assert.equal(afterNav2.canGoBack, true);
assert.equal(afterNav2.canGoForward, false);
assert.equal(afterNav2.historyIndex, 2);

// Test Back action
previewStore.goBack();
const afterBack1 = previewStore.getState();
assert.equal(afterBack1.currentUrl, 'http://localhost:5173/docs');
assert.equal(afterBack1.canGoBack, true);
assert.equal(afterBack1.canGoForward, true);
assert.equal(afterBack1.historyIndex, 1);

// Test Back to beginning
previewStore.goBack();
const afterBack2 = previewStore.getState();
assert.equal(afterBack2.currentUrl, 'http://localhost:5173');
assert.equal(afterBack2.canGoBack, false, 'Cannot go back past initial entry');
assert.equal(afterBack2.canGoForward, true);
assert.equal(afterBack2.historyIndex, 0);

// Test Forward action
previewStore.goForward();
const afterForward1 = previewStore.getState();
assert.equal(afterForward1.currentUrl, 'http://localhost:5173/docs');
assert.equal(afterForward1.canGoBack, true);
assert.equal(afterForward1.canGoForward, true);
assert.equal(afterForward1.historyIndex, 1);

// Branching history: navigate from index 1 should discard forward history
previewStore.navigateTo('http://localhost:5173/dashboard');
const afterBranch = previewStore.getState();
assert.equal(afterBranch.currentUrl, 'http://localhost:5173/dashboard');
assert.equal(afterBranch.canGoForward, false, 'Forward history should be truncated on new navigation');
assert.equal(afterBranch.history.length, 3);
assert.equal(afterBranch.history[2], 'http://localhost:5173/dashboard');

// -------------------------------------------------------------
// Test 2: Responsive Viewport Presets
// -------------------------------------------------------------
assert.equal(previewStore.getState().viewportMode, 'desktop');

previewStore.setViewportMode('tablet');
assert.equal(previewStore.getState().viewportMode, 'tablet');

previewStore.setViewportMode('mobile');
assert.equal(previewStore.getState().viewportMode, 'mobile');

previewStore.setViewportMode('desktop');
assert.equal(previewStore.getState().viewportMode, 'desktop');

// -------------------------------------------------------------
// Test 3: Log Sanitization & Path Masking (Ponytail & Apple HIG)
// -------------------------------------------------------------
const rawPathMac = 'Error: Cannot find module at /Users/simaosousa/HelmADE/src/main.tsx';
const sanitizedMac = sanitizeLogMessage(rawPathMac);
assert(!sanitizedMac.includes('/Users/simaosousa'), 'Must not leak user directory');
assert(sanitizedMac.includes('~/HelmADE/src/main.tsx') || sanitizedMac.includes('~/src/main.tsx'));

const rawStack = 'TypeError: fail\n    at /Users/simaosousa/HelmADE/node_modules/foo/bar.js:10:5';
const sanitizedStack = sanitizeLogMessage(rawStack);
assert(!sanitizedStack.includes('at /Users/simaosousa'));

const rawLinux = 'Error at /home/developer/app/server.js:45';
assert(!sanitizeLogMessage(rawLinux).includes('/home/developer'));

// -------------------------------------------------------------
// Test 4: Console Log Interception & Deduplication
// -------------------------------------------------------------
previewStore.clearLogs();
assert.equal(previewStore.getState().logs.length, 0);

previewStore.addLog({
  level: 'error',
  message: 'Failed to load resource in /Users/simaosousa/project/api',
  source: 'network',
});

const logs1 = previewStore.getState().logs;
assert.equal(logs1.length, 1);
assert.equal(logs1[0].level, 'error');
assert(!logs1[0].message.includes('/Users/simaosousa'), 'Log message must be sanitized');
assert.equal(logs1[0].count, 1);

// Add same log consecutively -> should increment count instead of duplicate
previewStore.addLog({
  level: 'error',
  message: 'Failed to load resource in /Users/simaosousa/project/api',
  source: 'network',
});
const logs2 = previewStore.getState().logs;
assert.equal(logs2.length, 1, 'Consecutive identical logs should be grouped');
assert.equal(logs2[0].count, 2);

// Add different log
previewStore.addLog({
  level: 'warn',
  message: 'Deprecated API called',
});
assert.equal(previewStore.getState().logs.length, 2);

// Filter & Drawer state
previewStore.setConsoleFilter('error');
assert.equal(previewStore.getState().consoleFilter, 'error');

previewStore.toggleConsole();
assert.equal(previewStore.getState().isConsoleOpen, true);
previewStore.toggleConsole(false);
assert.equal(previewStore.getState().isConsoleOpen, false);

// Format for Orchestrator
const formatted = formatLogsForOrchestrator(previewStore.getState().logs);
assert(formatted.includes('=== RELATÓRIO DE LOGS DA CONSOLA (LIVE PREVIEW) ==='));
assert(formatted.includes('Total de Entradas: 2'));
assert(!formatted.includes('/Users/simaosousa'));

// Clear logs
previewStore.clearLogs();
assert.equal(previewStore.getState().logs.length, 0);

console.log('✅ All previewNavigation and console tests passed successfully!');
