import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-флоу email-верификации, сброса пароля и добавления источников.
 *
 * Требует поднятого стенда: web + api + postgres, причём API запущен с
 * `NODE_ENV=test` — иначе test-only эндпоинт выдачи токена недоступен.
 *
 * Адреса по умолчанию берутся из корневого `.env` (скрипт `test:e2e` запускается
 * через `dotenv -e ../../.env`), поэтому в worktree прогон идёт по своему стенду,
 * а не по стенду основного checkout. Переопределяются через PLAYWRIGHT_BASE_URL
 * и PLAYWRIGHT_API_URL.
 *
 * Для e2e/telegram-source.spec.ts API дополнительно должен быть перезапущен с
 * TELEGRAM_PREVIEW_BASE_URL="http://127.0.0.1:4310" (см. .env.example).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  use: {
    // NEXTAUTH_URL — это адрес стенда для браузера (в копии — slug-хост);
    // он же должен быть baseURL, иначе сессия next-auth не установится.
    baseURL:
      process.env['PLAYWRIGHT_BASE_URL'] ??
      process.env['NEXTAUTH_URL'] ??
      `http://localhost:${process.env['WEB_PORT'] ?? '3000'}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
