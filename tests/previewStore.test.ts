import assert from 'node:assert/strict';
import { previewStore } from '../src/stores/usePreviewStore.ts';

// Test 1: Initial state
previewStore.reset();
const initial = previewStore.getState();
assert.equal(initial.isOpen, false);
assert.equal(initial.servers.length, 0);
assert.equal(initial.activeServer, null);

// Test 2: Toggle open
previewStore.toggleOpen();
assert.equal(previewStore.getState().isOpen, true);

previewStore.setOpen(false);
assert.equal(previewStore.getState().isOpen, false);

// Test 3: Add server automatically opens dock and sets activeServer
previewStore.addServer({
  session_id: 'session-vite-1',
  url: 'http://localhost:5173',
  port: 5173,
});

const afterAdd = previewStore.getState();
assert.equal(afterAdd.isOpen, true, 'Adding first server should open dock');
assert.equal(afterAdd.servers.length, 1);
assert.equal(afterAdd.activeServer?.port, 5173);
assert.equal(afterAdd.currentUrl, 'http://localhost:5173');

// Test 4: Deduplication of same server
previewStore.addServer({
  session_id: 'session-vite-1',
  url: 'http://localhost:5173',
  port: 5173,
});
assert.equal(previewStore.getState().servers.length, 1, 'Duplicate server should not create duplicate entries');

// Test 5: Add second server from another session
previewStore.addServer({
  session_id: 'session-next-2',
  url: 'http://localhost:3000',
  port: 3000,
});
assert.equal(previewStore.getState().servers.length, 2);
// Active server remains first server unless switched
assert.equal(previewStore.getState().activeServer?.port, 5173);

// Test 6: Switch active server
const nextServer = previewStore.getState().servers.find((s) => s.port === 3000);
assert(nextServer);
previewStore.setActiveServer(nextServer);
assert.equal(previewStore.getState().activeServer?.port, 3000);
assert.equal(previewStore.getState().currentUrl, 'http://localhost:3000');

// Test 7: Clear servers for specific session
previewStore.clearServers('session-vite-1');
assert.equal(previewStore.getState().servers.length, 1);
assert.equal(previewStore.getState().servers[0].session_id, 'session-next-2');

// Test 8: Reset
previewStore.reset();
assert.equal(previewStore.getState().servers.length, 0);
assert.equal(previewStore.getState().isOpen, false);

console.log('✅ All previewStore tests passed successfully!');
