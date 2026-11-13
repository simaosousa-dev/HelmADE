import { defineConfig } from '@playwright/test';

// The end-to-end suite drives the real Rust backend through its test bridge
// (see docs/adr/2026-11-13-0012-e2e-bridge.md). Build it first:
//   cargo build --features e2e-bridge
const BRIDGE_URL = 'http://127.0.0.1:47831';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    // The system Chrome locally; CI installs Playwright's Chromium instead.
    channel: process.env.CI ? undefined : 'chrome',
    viewport: { width: 1600, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    env: { VITE_E2E_BRIDGE_URL: BRIDGE_URL },
  },
});
