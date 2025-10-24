/**
 * Playwright E2E Test Configuration
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially to avoid port conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid backend conflicts
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run backend server before starting tests */
  webServer: [
    {
      command: 'cd ../.. && pnpm --filter @claude-code-manager/server dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:1420',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
