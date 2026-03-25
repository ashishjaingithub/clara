import { defineConfig, devices } from '@playwright/test'
import path from 'path'

/**
 * Playwright E2E configuration for Clara AI Receptionist.
 *
 * Server setup:
 *   - Runs `next build && next start` (production mode) on port 3003.
 *   - Production mode is required because `next dev` uses webpack eval which violates
 *     the app's CSP policy (no 'unsafe-eval'), breaking React hydration in tests.
 *   - A fresh server is always started (reuseExistingServer: false) so the test env
 *     vars are always in effect and the :memory: DB is always clean.
 *
 * Environment contract for the test server:
 *   - DATABASE_PATH=:memory:              — fresh SQLite per test run (auto-migrated at startup)
 *   - GROQ_API_KEY=test-key               — real Groq calls will fail; page-level tests mock
 *                                           /api/chat via page.route()
 *   - CLARA_OPERATOR_API_KEY=e2e-test-operator-key — tests send this as the Bearer token
 *   - HUNTER_API_URL=http://localhost:9999 — unreachable; tests the Hunter fallback path
 *   - LANGSMITH_TRACING=true + LANGSMITH_API_KEY=test-key — satisfies startup.ts prod checks;
 *                                           trace upload to LangSmith will fail silently
 *   - NODE_ENV=production                 — required for production startup checks
 *   - NEXT_PUBLIC_BASE_URL                — required by startup.ts in production
 *
 * Rate-limiting note:
 *   - The in-memory rate limiter allows 10 POST /api/demo per IP per minute.
 *     Tests are serialized (workers=1) to avoid hitting this limit with parallel workers.
 */
export default defineConfig({
  testDir: path.join(__dirname, 'tests/e2e'),
  testMatch: ['**/*.spec.ts'],

  /* Run tests serially to avoid hitting the in-memory rate limiter (10 req/min/IP).
   * With 5 parallel workers, 5 simultaneous POST /api/demo calls from the same IP
   * can exhaust the limit before all tests complete. */
  fullyParallel: false,
  workers: 1,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry once to catch transient flakiness (server boot, timing) */
  retries: 1,

  /* Reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  /* Shared settings for all projects */
  use: {
    baseURL: 'http://localhost:3003',

    /* Collect traces on first retry to aid debugging */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Per-action timeout */
    actionTimeout: 15000,

    /* Navigation timeout */
    navigationTimeout: 30000,
  },

  /* Global test timeout — page tests can take up to 20s due to typing indicator delays */
  timeout: 45000,

  /* Assertion timeout */
  expect: {
    timeout: 15000,
  },

  /* Configure projects for desktop and mobile viewports */
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
  ],

  /* Build then start the production server on port 3003 (isolated from the dev server on 3002).
   * Always starts fresh — reuseExistingServer is only allowed in CI where the server is
   * not started separately.
   */
  webServer: {
    command: 'next build && next start -p 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: false,
    timeout: 300000, // 5 minutes — next build takes ~60s on first run
    env: {
      DATABASE_PATH: ':memory:',
      GROQ_API_KEY: 'test-key',
      CLARA_OPERATOR_API_KEY: 'e2e-test-operator-key',
      HUNTER_API_URL: 'http://localhost:9999',
      LANGSMITH_TRACING: 'true',
      LANGSMITH_API_KEY: 'test-langsmith-key',
      PORT: '3003',
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3003',
    },
  },
})
