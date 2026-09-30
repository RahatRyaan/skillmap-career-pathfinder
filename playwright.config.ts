import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests.
 *
 * The suite runs against a real server, a real in-memory MongoDB, and the
 * production client build, so it exercises the same code path a user does.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // A fresh context per test, so a session saved by one test cannot leak
  // into the next. Isolation comes from here, not from manual clearing.
  testIdAttribute: 'data-testid',
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4010',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The port is set inline because Playwright's `env` is merged with the
    // parent process, where a local .env has already set PORT.
    command: 'PORT=4010 NODE_ENV=test AI_MODE=demo npm run test:e2e:server',
    url: 'http://127.0.0.1:4010/api/health',
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
