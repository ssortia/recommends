import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-флоу email-верификации и сброса пароля.
 *
 * Требует поднятого стенда: web (3000) + api (3001) + postgres, причём API
 * запущен с `NODE_ENV=test` — иначе test-only эндпоинт выдачи токена недоступен.
 * Адреса переопределяются через PLAYWRIGHT_BASE_URL и PLAYWRIGHT_API_URL.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
